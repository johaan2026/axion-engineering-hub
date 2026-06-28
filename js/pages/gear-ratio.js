import { validateForm } from "../framework/validation.js";
import { notify, success, error, warning } from "../framework/notifications.js";
import { addCalculationHistory, toggleFavouriteCalculator, getFavouriteCalculators } from "../framework/storage.js";
import { ExportService } from "../framework/exporters.js";
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
let animationPhase = 0;
let lastAnimationState = null;

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

function createResultCard(title, value, unit, description) {
  return `
    <article class="result-card result-card--success" role="listitem">
      <div class="result-card__icon">⚙️</div>
      <h3 class="result-card__title">${title}</h3>
      <p class="result-card__value">${value}</p>
      <p class="result-card__meta">${unit}</p>
      <p class="result-card__meta">${description}</p>
    </article>
  `;
}

function renderFormulas() {
  formulaList.innerHTML = `
    <div class="formula-card">
      <div class="formula-card__title">Gear Ratio</div>
      <div class="formula-card__body">$i = N_{driven} / N_{driver}$</div>
    </div>
    <div class="formula-card">
      <div class="formula-card__title">Output RPM</div>
      <div class="formula-card__body">$RPM_{out} = RPM_{in} / i$</div>
    </div>
    <div class="formula-card">
      <div class="formula-card__title">Output Torque</div>
      <div class="formula-card__body">$T_{out} = T_{in} \times i \times \eta$</div>
    </div>
    <div class="formula-card">
      <div class="formula-card__title">Mechanical Advantage</div>
      <div class="formula-card__body">$MA = T_{out} / T_{in}$</div>
    </div>
    <div class="formula-card">
      <div class="formula-card__title">Angular Velocity</div>
      <div class="formula-card__body">$\omega = 2\pi \times RPM / 60$</div>
    </div>
    <div class="formula-card">
      <div class="formula-card__title">Power</div>
      <div class="formula-card__body">$P_{in} = \tau \omega$ and $P_{out} = P_{in} \times \eta$</div>
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

  resultsGrid.innerHTML = [
    createResultCard("Gear Ratio", result.gearRatio.toFixed(3), "-", "Driven teeth ÷ driver teeth."),
    createResultCard("Output RPM", result.outputRpm.toFixed(2), "rpm", "Driven shaft rotational speed."),
    createResultCard("Output Torque", result.outputTorque.toFixed(2), "Nm", "Torque delivered to the driven shaft."),
    createResultCard("Mechanical Advantage", result.mechanicalAdvantage.toFixed(3), "-", "Torque multiplication ratio."),
    createResultCard("Input Power", result.inputPower.toFixed(2), "W", "Power supplied to the driver shaft."),
    createResultCard("Output Power", result.outputPower.toFixed(2), "W", "Useful power at the driven shaft."),
    createResultCard("Angular Velocity", result.inputAngularVelocity.toFixed(2), "rad/s", "Driver shaft angular velocity."),
    createResultCard("Rotation Direction", result.direction, "-", "External spur gears rotate oppositely."),
  ].join("");

  metricRatio.textContent = `${result.gearRatio.toFixed(2)}:1`;
  metricInputRpm.textContent = `${result.driverSpeed.toFixed(0)} rpm`;
  metricOutputRpm.textContent = `${result.outputRpm.toFixed(0)} rpm`;
  metricDirection.textContent = result.direction;

  status.textContent = `Loaded: ${result.driverTeeth} tooth driver driving a ${result.drivenTeeth} tooth gear.`;
  renderAnimation(result);
}

function renderAnimation(result) {
  if (!svg) return;

  const driverRadius = 48 + (result.driverTeeth / 500) * 18;
  const drivenRadius = 48 + (result.drivenTeeth / 500) * 18;
  const speedRatio = result.outputRpm / result.driverSpeed;
  const animationSpeed = Math.max(0.2, Math.min(2.5, 1 / Math.max(speedRatio, 0.2)));
  const driverTeeth = result.driverTeeth;
  const drivenTeeth = result.drivenTeeth;

  svg.innerHTML = `
    <defs>
      <linearGradient id="gear-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#60a5fa"></stop>
        <stop offset="100%" stop-color="#1d4ed8"></stop>
      </linearGradient>
    </defs>
    <line x1="160" y1="60" x2="160" y2="160" stroke="rgba(255,255,255,0.15)" stroke-width="2"></line>
    <circle cx="100" cy="120" r="${driverRadius}" fill="rgba(255,255,255,0.06)" stroke="#60a5fa" stroke-width="3"></circle>
    <circle cx="220" cy="120" r="${drivenRadius}" fill="rgba(255,255,255,0.06)" stroke="#93c5fd" stroke-width="3"></circle>
    <g id="driver-gear" transform="translate(100,120)">
      <circle r="${driverRadius - 8}" fill="url(#gear-gradient)"></circle>
      <circle r="${driverRadius - 16}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"></circle>
      ${Array.from({ length: Math.max(8, Math.round(driverTeeth / 10)) }, (_, index) => {
        const angle = (index / (Math.max(8, Math.round(driverTeeth / 10)))) * Math.PI * 2;
        const outerRadius = driverRadius - 4;
        const innerRadius = driverRadius - 16;
        return `<rect x="${Math.cos(angle) * innerRadius - 3}" y="${Math.sin(angle) * innerRadius - 3}" width="6" height="${outerRadius - innerRadius + 6}" rx="2" transform="rotate(${angle * (180 / Math.PI)} ${Math.cos(angle) * innerRadius} ${Math.sin(angle) * innerRadius})"></rect>`;
      }).join("")}
    </g>
    <g id="driven-gear" transform="translate(220,120)">
      <circle r="${drivenRadius - 8}" fill="url(#gear-gradient)"></circle>
      <circle r="${drivenRadius - 16}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"></circle>
      ${Array.from({ length: Math.max(8, Math.round(drivenTeeth / 10)) }, (_, index) => {
        const angle = (index / (Math.max(8, Math.round(drivenTeeth / 10)))) * Math.PI * 2;
        const outerRadius = drivenRadius - 4;
        const innerRadius = drivenRadius - 16;
        return `<rect x="${Math.cos(angle) * innerRadius - 3}" y="${Math.sin(angle) * innerRadius - 3}" width="6" height="${outerRadius - innerRadius + 6}" rx="2" transform="rotate(${angle * (180 / Math.PI)} ${Math.cos(angle) * innerRadius} ${Math.sin(angle) * innerRadius})"></rect>`;
      }).join("")}
    </g>
    <text x="160" y="195" text-anchor="middle" fill="#f8fafc" font-size="13">Driver and driven gears rotate in opposite directions.</text>
  `;

  lastAnimationState = { result, animationSpeed, driverRadius, drivenRadius };
  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame);
  }
  animationPhase = 0;
  animateGears();
}

function animateGears() {
  if (!lastAnimationState || !svg) return;
  const { result, animationSpeed } = lastAnimationState;
  const driverGear = svg.querySelector("#driver-gear");
  const drivenGear = svg.querySelector("#driven-gear");

  if (driverGear) {
    driverGear.setAttribute("transform", `translate(100,120) rotate(${animationPhase * animationSpeed * 6} 0 0)`);
  }
  if (drivenGear) {
    drivenGear.setAttribute("transform", `translate(220,120) rotate(${-animationPhase * animationSpeed * 6} 0 0)`);
  }

  animationPhase += 1;
  animationFrame = window.requestAnimationFrame(animateGears);
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

  navigator.clipboard.writeText(payload).then(() => success("Results copied to clipboard."));
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
  window.print();
}

function exportCsv() {
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
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "gear-ratio-results.csv";
  link.click();
  success("CSV export created.");
}

function exportPdf() {
  if (!lastResult) {
    warning("Calculate a result before exporting.");
    return;
  }

  const values = getFormValues();
  const payload = `Gear Ratio Calculator\n\nInputs:\nDriver Teeth: ${values.driverTeeth}\nDriven Teeth: ${values.drivenTeeth}\nDriver Speed: ${values.driverSpeed} rpm\nDriver Torque: ${values.driverTorque} Nm\nEfficiency: ${values.efficiency}%\nPressure Angle: ${values.pressureAngle}°\n\nResults:\nGear Ratio: ${lastResult.gearRatio.toFixed(3)}\nOutput RPM: ${lastResult.outputRpm.toFixed(2)} rpm\nOutput Torque: ${lastResult.outputTorque.toFixed(2)} Nm\nMechanical Advantage: ${lastResult.mechanicalAdvantage.toFixed(3)}\nInput Power: ${lastResult.inputPower.toFixed(2)} W\nOutput Power: ${lastResult.outputPower.toFixed(2)} W\nAngular Velocity: ${lastResult.inputAngularVelocity.toFixed(2)} rad/s\nRotation Direction: ${lastResult.direction}`;

  exporter.exportPdf(payload, { filename: "gear-ratio-results.pdf" }).then(() => success("PDF export prepared."));
}

function initFavouriteState() {
  const calc = getCalculatorById(calculatorDefinition.id);
  if (!calc) return;
  const favorites = getFavouriteCalculators();
  const isFavourite = favorites.some((item) => item.id === calc.id);
  favouriteButton.textContent = isFavourite ? "★ Favourite" : "Favourite";
}

export function init() {
  renderFormulas();
  initFavouriteState();
  if (form) {
    form.addEventListener("submit", handleSubmit);
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
}
