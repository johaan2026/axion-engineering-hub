import { validateForm } from "../framework/validation.js";
import { success, error, warning } from "../framework/notifications.js";
import { addCalculationHistory, toggleFavouriteCalculator, getFavouriteCalculators, recordRecentCalculator } from "../framework/storage.js";
import { ExportService } from "../framework/exporters.js";
import { createResultCard as createFrameworkResultCard } from "../framework/results.js";
import { copyToClipboard, downloadFile } from "../framework/utilities.js";
import { getCalculatorById } from "../data/calculators.js";

const exporter = new ExportService();

const calculatorDefinition = {
  id: "gear-ratio",
  name: "Gear Ratio",
  description: "Compute gear ratio, speed, torque, power, and rotation direction for spur gears.",
};

const form = document.getElementById("gear-form");
const resultsGrid = document.getElementById("results-grid");
const formulaList = document.getElementById("formula-list");
const svg = document.getElementById("gear-animation");
const status = document.getElementById("animation-status");
const metricRatio = document.getElementById("metric-ratio");
const metricInputRpm = document.getElementById("metric-input-rpm");
const metricOutputRpm = document.getElementById("metric-output-rpm");
const metricDirection = document.getElementById("metric-direction");
const copyButton = document.getElementById("copy-results");
const saveButton = document.getElementById("save-calculation");
const favouriteButton = document.getElementById("toggle-favourite");
const printButton = document.getElementById("print-results");
const resetButton = document.getElementById("reset-form");
const exportCsvButton = document.getElementById("export-csv");
const exportPdfButton = document.getElementById("export-pdf");

const fieldIds = [
  "driver-teeth",
  "driven-teeth",
  "driver-speed",
  "driver-torque",
  "efficiency",
  "pressure-angle",
];

const fieldErrorMap = {
  driverTeeth: "error-driver-teeth",
  drivenTeeth: "error-driven-teeth",
  driverSpeed: "error-driver-speed",
  driverTorque: "error-driver-torque",
  efficiency: "error-efficiency",
  pressureAngle: "error-pressure-angle",
};

let lastResult = null;
let animationFrame = null;
let lastAnimationState = null;
let animationStartTime = null;
let liveCalculationFrame = null;
let isInitialized = false;

function getFormValues() {
  return {
    driverTeeth: Number(document.getElementById("driver-teeth").value),
    drivenTeeth: Number(document.getElementById("driven-teeth").value),
    driverSpeed: Number(document.getElementById("driver-speed").value),
    driverTorque: Number(document.getElementById("driver-torque").value),
    efficiency: Number(document.getElementById("efficiency").value),
    pressureAngle: Number(document.getElementById("pressure-angle").value),
  };
}

function resetErrors() {
  fieldIds.forEach((id) => {
    const errorEl = document.getElementById(`error-${id}`);
    if (errorEl) {
      errorEl.textContent = "";
    }
  });
}

function showFieldErrors(results) {
  Object.entries(results).forEach(([name, result]) => {
    const errorEl = document.getElementById(fieldErrorMap[name]);
    if (!errorEl) return;
    errorEl.textContent = result.errors[0] ?? "";
  });
}

function createMetricCard(title, value, unit, description) {
  const descriptionElement = document.createElement("p");
  descriptionElement.className = "result-card__meta";
  descriptionElement.textContent = description;
  const card = createFrameworkResultCard({
    title,
    value,
    meta: unit,
    tone: "success",
    icon: "",
    children: descriptionElement,
  });
  card.setAttribute("role", "listitem");

  const numericValue = Number.parseFloat(value);
  if (Number.isFinite(numericValue) && String(value).trim() !== "") {
    const valueElement = card.querySelector(".result-card__value");
    valueElement.dataset.countTo = String(numericValue);
    valueElement.dataset.countDecimals = String(String(value).split(".")[1]?.length ?? 0);
  }
  return card;
}

function renderFormulas() {
  formulaList.innerHTML = `
    <div class="formula-card">
      <div class="formula-card__title">Gear Ratio</div>
      <div class="formula-card__body">i = N<sub>driven</sub> / N<sub>driver</sub></div>
    </div>
    <div class="formula-card">
      <div class="formula-card__title">Output RPM</div>
      <div class="formula-card__body">RPM<sub>out</sub> = RPM<sub>in</sub> / i</div>
    </div>
    <div class="formula-card">
      <div class="formula-card__title">Output Torque</div>
      <div class="formula-card__body">T<sub>out</sub> = T<sub>in</sub> × i × η</div>
    </div>
    <div class="formula-card">
      <div class="formula-card__title">Mechanical Advantage</div>
      <div class="formula-card__body">MA = T<sub>out</sub> / T<sub>in</sub></div>
    </div>
    <div class="formula-card">
      <div class="formula-card__title">Angular Velocity</div>
      <div class="formula-card__body">ω = 2π × RPM / 60</div>
    </div>
    <div class="formula-card">
      <div class="formula-card__title">Power</div>
      <div class="formula-card__body">P<sub>in</sub> = τ ω &nbsp;&nbsp; P<sub>out</sub> = P<sub>in</sub> × η</div>
    </div>
  `;
}

function getRotationDirection(gearRatio) {
  return gearRatio > 1 ? "Counterclockwise" : "Clockwise";
}

function calculate(values) {
  const driverTeeth = values.driverTeeth;
  const drivenTeeth = values.drivenTeeth;
  const driverSpeed = values.driverSpeed;
  const driverTorque = values.driverTorque;
  const efficiency = values.efficiency / 100;
  const pressureAngle = values.pressureAngle;

  const gearRatio = drivenTeeth / driverTeeth;
  const outputRpm = driverSpeed / gearRatio;
  const outputTorque = driverTorque * gearRatio * efficiency;
  const mechanicalAdvantage = outputTorque / driverTorque;
  const inputAngularVelocity = (2 * Math.PI * driverSpeed) / 60;
  const inputPower = driverTorque * inputAngularVelocity;
  const outputPower = inputPower * efficiency;
  const direction = gearRatio > 1 ? "Counterclockwise" : "Clockwise";

  return {
    driverTeeth,
    drivenTeeth,
    driverSpeed,
    driverTorque,
    efficiency: values.efficiency,
    pressureAngle,
    gearRatio,
    outputRpm,
    outputTorque,
    mechanicalAdvantage,
    inputAngularVelocity,
    inputPower,
    outputPower,
    direction,
  };
}

function updateResults(result) {
  lastResult = result;
  const sections = [
    {
      title: "Primary Results",
      cards: [
        ["Gear Ratio", result.gearRatio.toFixed(3), "i", "Driven teeth ÷ driver teeth."],
        ["Output RPM", result.outputRpm.toFixed(2), "rpm", "Driven shaft rotational speed."],
        ["Output Torque", result.outputTorque.toFixed(2), "Nm", "Torque delivered to the driven shaft."],
      ],
    },
    {
      title: "Performance",
      cards: [
        ["Mechanical Advantage", result.mechanicalAdvantage.toFixed(3), "-", "Torque multiplication ratio."],
        ["Input Power", result.inputPower.toFixed(2), "W", "Power supplied to the driver shaft."],
        ["Output Power", result.outputPower.toFixed(2), "W", "Useful power at the driven shaft."],
      ],
    },
    {
      title: "Motion",
      cards: [
        ["Angular Velocity", result.inputAngularVelocity.toFixed(2), "rad/s", "Driver shaft angular velocity."],
        ["Rotation Direction", result.direction, "-", "External spur gears rotate oppositely."],
        ["Gear Mesh Type", "External Spur", "-", `${result.pressureAngle.toFixed(1)}° pressure angle`],
      ],
    },
  ];

  resultsGrid.replaceChildren(...sections.map(({ title, cards }) => {
    const section = document.createElement("div");
    section.className = "result-section";
    const heading = document.createElement("h4");
    heading.className = "result-section__title";
    heading.textContent = title;
    const grid = document.createElement("div");
    grid.className = "result-grid";
    grid.append(...cards.map((card) => createMetricCard(...card)));
    section.append(heading, grid);
    return section;
  }));
  animateResultValues();

  metricRatio.textContent = `${result.gearRatio.toFixed(2)}:1`;
  metricInputRpm.textContent = `${result.driverSpeed.toFixed(0)} rpm`;
  metricOutputRpm.textContent = `${result.outputRpm.toFixed(0)} rpm`;
  metricDirection.textContent = result.direction;
  const gearMesh = document.getElementById('metric-gear-mesh');
  if (gearMesh) gearMesh.textContent = 'External Spur';

  status.textContent = `Loaded: ${result.driverTeeth} tooth driver driving a ${result.drivenTeeth} tooth gear.`;
  renderGearSvg(result);
  // update worked example and warnings
  renderWorkedExample(getFormValues(), result);
  renderEngineeringWarnings(getFormValues(), result);
}

function animateResultValues() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  resultsGrid.querySelectorAll("[data-count-to]").forEach((element) => {
    const target = Number(element.dataset.countTo);
    const decimals = Number(element.dataset.countDecimals);
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / 520, 1);
      element.textContent = (target * (1 - Math.pow(1 - progress, 3))).toFixed(decimals);
      if (progress < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

function renderGearSvg(result) {
  if (!svg) return;

  // radii scale roughly with tooth count (proportional)
  const minRadius = 36;
  const driverRadius = Math.max(minRadius, Math.round((result.driverTeeth / Math.max(result.driverTeeth, result.drivenTeeth)) * 72));
  const drivenRadius = Math.max(minRadius, Math.round((result.drivenTeeth / Math.max(result.driverTeeth, result.drivenTeeth)) * 72));

  const driverTeeth = result.driverTeeth;
  const drivenTeeth = result.drivenTeeth;

  svg.innerHTML = `
    <defs>
      <linearGradient id="gear-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#60a5fa"></stop>
        <stop offset="100%" stop-color="#1d4ed8"></stop>
      </linearGradient>
    </defs>
    <g id="gear-scene">
      <line x1="160" y1="40" x2="160" y2="180" stroke="rgba(255,255,255,0.06)" stroke-width="1"></line>
      <g id="driver-gear" transform="translate(100,110)">
        <circle r="${driverRadius}" fill="rgba(255,255,255,0.03)" stroke="#60a5fa" stroke-width="2"></circle>
        <g id="driver-teeth-group">
          ${Array.from({ length: Math.max(8, driverTeeth) }, (_, index) => {
            const teethCount = Math.max(8, driverTeeth);
            const angle = (index / teethCount) * Math.PI * 2;
            const outer = driverRadius + 4;
            const inner = driverRadius - 8;
            return `<rect x="${Math.cos(angle) * inner - 2}" y="${Math.sin(angle) * inner - 6}" width="4" height="${outer - inner + 8}" rx="1" transform="rotate(${(angle * 180 / Math.PI)} ${Math.cos(angle) * inner} ${Math.sin(angle) * inner})" fill="#93c5fd"></rect>`;
          }).join('')}
        </g>
      </g>

      <g id="driven-gear" transform="translate(220,110)">
        <circle r="${drivenRadius}" fill="rgba(255,255,255,0.03)" stroke="#93c5fd" stroke-width="2"></circle>
        <g id="driven-teeth-group">
          ${Array.from({ length: Math.max(8, drivenTeeth) }, (_, index) => {
            const teethCount = Math.max(8, drivenTeeth);
            const angle = (index / teethCount) * Math.PI * 2;
            const outer = drivenRadius + 4;
            const inner = drivenRadius - 8;
            return `<rect x="${Math.cos(angle) * inner - 2}" y="${Math.sin(angle) * inner - 6}" width="4" height="${outer - inner + 8}" rx="1" transform="rotate(${(angle * 180 / Math.PI)} ${Math.cos(angle) * inner} ${Math.sin(angle) * inner})" fill="#60a5fa"></rect>`;
          }).join('')}
        </g>
      </g>

      <text x="100" y="30" text-anchor="middle" fill="#cbd5e1" font-size="12">Driver Gear</text>
      <text x="220" y="30" text-anchor="middle" fill="#cbd5e1" font-size="12">Driven Gear</text>
      <text x="100" y="140" text-anchor="middle" fill="#e6eef8" font-size="11">Teeth: ${driverTeeth}</text>
      <text x="220" y="140" text-anchor="middle" fill="#e6eef8" font-size="11">Teeth: ${drivenTeeth}</text>
    </g>
    <text x="160" y="200" text-anchor="middle" fill="#f8fafc" font-size="12">Driver and driven gears rotate in opposite directions.</text>
  `;

  // Prepare continuous animation based on RPM values
  lastAnimationState = {
    driverDegPerSec: result.driverSpeed * 6, // RPM -> deg/s
    drivenDegPerSec: result.outputRpm * 6,
  };

  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame);
  }
  animationPhase = 0;
  animationStartTime = null;
  window.requestAnimationFrame(animateGearsTimestamp);
}

function animateGearsTimestamp(ts) {
  if (!lastAnimationState || !svg) return;
  if (!animationStartTime) animationStartTime = ts;
  const elapsed = (ts - animationStartTime) / 1000; // seconds

  const driverAngle = (lastAnimationState.driverDegPerSec * elapsed) % 360;
  const drivenAngle = (lastAnimationState.drivenDegPerSec * elapsed) % 360;

  const driverGroup = svg.querySelector('#driver-gear');
  const drivenGroup = svg.querySelector('#driven-gear');
  if (driverGroup) {
    driverGroup.setAttribute('transform', `translate(100,110) rotate(${driverAngle})`);
  }
  if (drivenGroup) {
    // opposite direction for external spur gears
    drivenGroup.setAttribute('transform', `translate(220,110) rotate(${-drivenAngle})`);
  }

  animationFrame = window.requestAnimationFrame(animateGearsTimestamp);
}

function handleSubmit(event) {
  event.preventDefault();
  resetErrors();
  const values = getFormValues();
  const formValidation = validateForm({
    driverTeeth: { value: values.driverTeeth, rules: { required: true, positive: true, integer: true, min: 6, max: 500 } },
    drivenTeeth: { value: values.drivenTeeth, rules: { required: true, positive: true, integer: true, min: 6, max: 500 } },
    driverSpeed: { value: values.driverSpeed, rules: { required: true, positive: true } },
    driverTorque: { value: values.driverTorque, rules: { required: true, positive: true } },
    efficiency: { value: values.efficiency, rules: { required: true, positive: true, min: 1, max: 100 } },
    pressureAngle: { value: values.pressureAngle, rules: { required: true, positive: true } },
  });

  if (!formValidation.isValid) {
    showFieldErrors(formValidation.results);
    warning("Please correct the highlighted validation errors.");
    return;
  }

  const result = calculate(values);
  updateResults(result);
  success("Gear ratio calculation completed.");
}

function handleLiveCalculation() {
  if (liveCalculationFrame) {
    window.cancelAnimationFrame(liveCalculationFrame);
  }

  liveCalculationFrame = window.requestAnimationFrame(() => {
    liveCalculationFrame = null;
    const values = getFormValues();
    const allValuesAreFinite = Object.values(values).every(Number.isFinite);
    const teethAreValid = Number.isInteger(values.driverTeeth)
      && Number.isInteger(values.drivenTeeth)
      && values.driverTeeth >= 6
      && values.driverTeeth <= 500
      && values.drivenTeeth >= 6
      && values.drivenTeeth <= 500;
    const operatingValuesAreValid = values.driverSpeed > 0
      && values.driverTorque > 0
      && values.efficiency >= 1
      && values.efficiency <= 100
      && values.pressureAngle > 0;

    if (allValuesAreFinite && teethAreValid && operatingValuesAreValid) {
      updateResults(calculate(values));
    }
  });
}

function resetForm() {
  if (form) {
    form.reset();
    document.getElementById("driver-teeth").value = "20";
    document.getElementById("driven-teeth").value = "60";
    document.getElementById("driver-speed").value = "1750";
    document.getElementById("driver-torque").value = "120";
    document.getElementById("efficiency").value = "95";
    document.getElementById("pressure-angle").value = "20";
  }
  resetErrors();
  resultsGrid.innerHTML = "";
  metricRatio.textContent = "—";
  metricInputRpm.textContent = "—";
  metricOutputRpm.textContent = "—";
  metricDirection.textContent = "—";
  status.textContent = "Ready to calculate.";
  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame);
  }
  lastResult = null;
  lastAnimationState = null;
  if (svg) {
    svg.innerHTML = "";
  }
  if (efficiencySlider) {
    efficiencySlider.value = "95";
  }
  updateResults(calculate(getFormValues()));
}

// Sync slider and numeric input for efficiency
const efficiencyInput = document.getElementById('efficiency');
const efficiencySlider = document.getElementById('efficiency-slider');
if (efficiencyInput && efficiencySlider) {
  efficiencySlider.addEventListener('input', () => {
    efficiencyInput.value = efficiencySlider.value;
  });
  efficiencyInput.addEventListener('input', () => {
    const v = Number(efficiencyInput.value);
    if (!Number.isNaN(v)) efficiencySlider.value = Math.min(100, Math.max(1, v));
  });
}

function copyResults() {
  if (!lastResult) {
    warning("Calculate a result before copying.");
    return;
  }

  const payload = [
    `Gear Ratio: ${lastResult.gearRatio.toFixed(3)}`,
    `Output RPM: ${lastResult.outputRpm.toFixed(2)} rpm`,
    `Output Torque: ${lastResult.outputTorque.toFixed(2)} Nm`,
    `Mechanical Advantage: ${lastResult.mechanicalAdvantage.toFixed(3)}`,
    `Input Power: ${lastResult.inputPower.toFixed(2)} W`,
    `Output Power: ${lastResult.outputPower.toFixed(2)} W`,
    `Angular Velocity: ${lastResult.inputAngularVelocity.toFixed(2)} rad/s`,
    `Rotation Direction: ${lastResult.direction}`,
  ].join("\n");

  copyToClipboard(payload)
    .then(() => success("Results copied to clipboard."))
    .catch(() => error("Clipboard access is unavailable in this browser."));
}

function renderWorkedExample(values, result) {
  const given = `Driver teeth = ${values.driverTeeth}, driven teeth = ${values.drivenTeeth}, driver speed = ${values.driverSpeed} rpm, driver torque = ${values.driverTorque} Nm, efficiency = ${values.efficiency}%`;
  const substitution = `i = ${values.drivenTeeth} / ${values.driverTeeth} = ${result.gearRatio.toFixed(3)} and T_out = ${values.driverTorque} × ${result.gearRatio.toFixed(3)} × ${ (values.efficiency/100).toFixed(3) } = ${result.outputTorque.toFixed(2)} Nm`;
  const answer = `Output RPM = ${result.outputRpm.toFixed(2)} rpm; Output Torque ≈ ${result.outputTorque.toFixed(2)} Nm.`;

  const elGiven = document.getElementById('example-given');
  const elFormula = document.getElementById('example-formula');
  const elSub = document.getElementById('example-sub');
  const elAnswer = document.getElementById('example-answer');
  if (elGiven) elGiven.textContent = given;
  if (elFormula) elFormula.innerHTML = 'i = N<sub>driven</sub> / N<sub>driver</sub> &nbsp;&nbsp; T<sub>out</sub> = T<sub>in</sub> × i × η';
  if (elSub) elSub.innerHTML = substitution;
  if (elAnswer) elAnswer.textContent = answer;
}

function renderEngineeringWarnings(values, result) {
  const container = document.getElementById('engineering-warnings');
  if (!container) return;
  const warnings = [];
  if (Number(values.efficiency) < 90) {
    warnings.push('Efficiency below 90% may reduce gearset performance and thermal stability.');
  }
  if (result.gearRatio > 6) {
    warnings.push('High gear ratios above 6:1 may require multi-stage gearing for reliable operation.');
  }
  if (Number(values.driverTeeth) < 6 || Number(values.drivenTeeth) < 6 || Number(values.driverSpeed) <= 0 || Number(values.driverTorque) <= 0) {
    warnings.push('Invalid input values detected. Ensure all fields are positive and within the allowed range.');
  }

  if (warnings.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = warnings.map((w) => `
    <div class="note-card note-card--warning" role="alert">
      <strong>Warning</strong>
      <p>${w}</p>
    </div>
  `).join('');
}

function saveCalculation() {
  if (!lastResult) {
    warning("Calculate a result before saving.");
    return;
  }

  const entry = {
    calculatorId: calculatorDefinition.id,
    calculatorName: calculatorDefinition.name,
    inputs: getFormValues(),
    outputs: lastResult,
    timestamp: new Date().toISOString(),
  };

  addCalculationHistory(entry);
  recordRecentCalculator({ id: calculatorDefinition.id, label: calculatorDefinition.name });
  success("Calculation saved to history.");
}

function toggleFavourite() {
  const calc = getCalculatorById(calculatorDefinition.id);
  if (!calc) {
    error("Calculator metadata could not be found.");
    return;
  }

  const favorites = toggleFavouriteCalculator(calc);
  const isFavourite = favorites.some((item) => item.id === calc.id);
  favouriteButton.textContent = isFavourite ? "★ Favourite" : "Favourite";
  success(isFavourite ? "Added to favourites." : "Removed from favourites.");
}

function printResults() {
  exporter.exportPrint(lastResult, { window });
}

async function exportCsv() {
  if (!lastResult) {
    warning("Calculate a result before exporting.");
    return;
  }

  const values = getFormValues();
  const data = [
    ["metric", "value"],
    ["gearRatio", lastResult.gearRatio.toFixed(6)],
    ["outputRpm", lastResult.outputRpm.toFixed(6)],
    ["outputTorque", lastResult.outputTorque.toFixed(6)],
    ["mechanicalAdvantage", lastResult.mechanicalAdvantage.toFixed(6)],
    ["inputPower", lastResult.inputPower.toFixed(6)],
    ["outputPower", lastResult.outputPower.toFixed(6)],
    ["inputAngularVelocity", lastResult.inputAngularVelocity.toFixed(6)],
    ["rotationDirection", lastResult.direction],
    ["driverTeeth", values.driverTeeth],
    ["drivenTeeth", values.drivenTeeth],
    ["driverSpeed", values.driverSpeed],
    ["driverTorque", values.driverTorque],
    ["efficiency", values.efficiency],
    ["pressureAngle", values.pressureAngle],
  ];
  const csv = data.map((row) => row.join(",")).join("\n");
  const exported = await exporter.exportCsv(csv, { filename: "gear-ratio-results.csv" });
  downloadFile(exported.content, exported.filename, "text/csv;charset=utf-8");
  success("CSV export created.");
}

async function exportPdf() {
  if (!lastResult) {
    warning("Calculate a result before exporting.");
    return;
  }

  const values = getFormValues();
  const payload = `Gear Ratio Calculator\n\nInputs:\nDriver Teeth: ${values.driverTeeth}\nDriven Teeth: ${values.drivenTeeth}\nDriver Speed: ${values.driverSpeed} rpm\nDriver Torque: ${values.driverTorque} Nm\nEfficiency: ${values.efficiency}%\nPressure Angle: ${values.pressureAngle}°\n\nResults:\nGear Ratio: ${lastResult.gearRatio.toFixed(3)}\nOutput RPM: ${lastResult.outputRpm.toFixed(2)} rpm\nOutput Torque: ${lastResult.outputTorque.toFixed(2)} Nm\nMechanical Advantage: ${lastResult.mechanicalAdvantage.toFixed(3)}\nInput Power: ${lastResult.inputPower.toFixed(2)} W\nOutput Power: ${lastResult.outputPower.toFixed(2)} W\nAngular Velocity: ${lastResult.inputAngularVelocity.toFixed(2)} rad/s\nRotation Direction: ${lastResult.direction}`;

  const exported = await exporter.exportPdf(payload, { filename: "gear-ratio-results.pdf" });
  downloadFile(exported.content, exported.filename, "application/pdf");
  success("PDF export prepared.");
}

function initFavouriteState() {
  const calc = getCalculatorById(calculatorDefinition.id);
  if (!calc) return;
  const favorites = getFavouriteCalculators();
  const isFavourite = favorites.some((item) => item.id === calc.id);
  favouriteButton.textContent = isFavourite ? "★ Favourite" : "Favourite";
}

function bindKeyboardShortcuts() {
  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (form) form.requestSubmit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      resetForm();
    }
  });
}

export function init() {
  if (isInitialized) return;
  isInitialized = true;

  renderFormulas();
  initFavouriteState();
  bindKeyboardShortcuts();
  if (form) {
    form.addEventListener("submit", handleSubmit);
    form.addEventListener("input", handleLiveCalculation);
  }
  if (resetButton) {
    resetButton.addEventListener("click", resetForm);
  }
  if (copyButton) {
    copyButton.addEventListener("click", copyResults);
  }
  if (saveButton) {
    saveButton.addEventListener("click", saveCalculation);
  }
  if (favouriteButton) {
    favouriteButton.addEventListener("click", toggleFavourite);
  }
  if (printButton) {
    printButton.addEventListener("click", printResults);
  }
  if (exportCsvButton) {
    exportCsvButton.addEventListener("click", exportCsv);
  }
  if (exportPdfButton) {
    exportPdfButton.addEventListener("click", exportPdf);
  }
  if (form) {
    updateResults(calculate(getFormValues()));
  }
}
