import { ExportService } from "../framework/exporters.js";
import { success, error, warning } from "../framework/notifications.js";
import { addCalculationHistory, getFavouriteCalculators, recordRecentCalculator, toggleFavouriteCalculator, getUserSettings } from "../framework/storage.js";
import { copyToClipboard, downloadFile, formatNumber } from "../framework/utilities.js";
import { getCalculatorById } from "../data/calculators.js";

const exporter = new ExportService();
const $ = (id) => document.getElementById(id);
const fields = ["power", "torque", "rpm"];
const powerUnitFactors = {
  w: 1,
  kw: 1000,
  "hp-metric": 735.49875,
  "hp-mech": 745.699872,
};
const powerUnitLabels = {
  w: "W",
  kw: "kW",
  "hp-metric": "HP",
  "hp-mech": "Mechanical HP",
};
const conversions = {
  metric: { torqueFactor: 1, torqueUnit: "N·m" },
  imperial: { torqueFactor: 1.3558179483, torqueUnit: "lb·ft" },
};
let lastResult = null;
let previousSystem = "metric";
let previousPowerUnit = "kw";
let currentRpm = 0;
let targetRpm = 0;
let currentDirection = 1;
let targetDirection = 1;
let animationFrameId = null;
let drivetrainAngle = 0;
let drivetrainLastTimestamp = null;
let drivetrainRotors = [];
let powerParticles = [];
let powerParticlePhase = 0;
let numberAnimations = [];
const drivetrainSelector = ".pt-motor-rotor, .pt-coupling, .pt-shaft-keyway, .pt-load-rotor";
const maximumVisualRpm = 120;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function unitSystem() {
  return document.querySelector('input[name="unit-system"]:checked')?.value || "metric";
}

function powerUnit() {
  return $("power-unit-select")?.value || "kw";
}

function rawValue(id) {
  const value = $(id)?.value?.trim();
  return value === "" ? null : Number(value);
}

function values() {
  return {
    power: rawValue("power"),
    torque: rawValue("torque"),
    rpm: rawValue("rpm"),
    efficiency: rawValue("efficiency"),
    system: unitSystem(),
    powerUnit: powerUnit(),
  };
}

function getDisplayPrecision() {
  try {
    const settings = getUserSettings();
    return Number.isFinite(Number(settings?.decimalPrecision)) ? Number(settings.decimalPrecision) : 2;
  } catch {
    return 2;
  }
}

function clearErrors() {
  [...fields, "efficiency"].forEach((id) => {
    const errorElement = $(`${id}-error`);
    const input = $(id);
    if (errorElement) errorElement.textContent = "";
    if (input?.closest(".pt-input")) input.closest(".pt-input").classList.remove("is-invalid");
  });
}

function setError(id, message) {
  const errorElement = $(`${id}-error`);
  const input = $(id);
  if (errorElement) errorElement.textContent = message;
  if (input?.closest(".pt-input")) input.closest(".pt-input").classList.add("is-invalid");
}

function validate(input) {
  clearErrors();
  let valid = true;
  const invalidEntries = [];

  fields.forEach((id) => {
    const value = input[id];
    if (value === null) return;
    if (!Number.isFinite(value) || value <= 0) {
      invalidEntries.push(id);
      valid = false;
      const message = id === "rpm" ? "RPM must be greater than zero." : id === "torque" ? "Torque must be greater than zero." : "Power must be greater than zero.";
      setError(id, message);
    }
  });

  if (!Number.isFinite(input.efficiency) || input.efficiency <= 0 || input.efficiency > 100) {
    setError("efficiency", "Efficiency must be greater than 0 and no more than 100%.");
    valid = false;
  }

  const entered = fields.filter((id) => input[id] !== null);
  if (entered.length !== 2) {
    const target = entered.length < 2 ? fields.find((id) => input[id] === null) : fields[2];
    if (target && !invalidEntries.includes(target)) {
      setError(target, entered.length < 2 ? "Enter exactly two primary values." : "Leave one primary value blank to solve it.");
    }
    valid = false;
  }

  return valid;
}

function calculate(input) {
  const basePowerFactor = powerUnitFactors[input.powerUnit] ?? powerUnitFactors.kw;
  let powerW = input.power === null ? null : input.power * basePowerFactor;
  let torqueNm = input.torque === null ? null : input.torque * conversions[input.system].torqueFactor;
  let rpm = input.rpm;
  let solved = "rpm";

  if (powerW === null) {
    solved = "power";
    powerW = torqueNm * ((2 * Math.PI * rpm) / 60);
  } else if (torqueNm === null) {
    solved = "torque";
    torqueNm = powerW / ((2 * Math.PI * rpm) / 60);
  } else {
    solved = "rpm";
    rpm = (powerW * 60) / (2 * Math.PI * torqueNm);
  }

  if (!Number.isFinite(powerW) || !Number.isFinite(torqueNm) || !Number.isFinite(rpm) || rpm <= 0 || torqueNm <= 0 || powerW <= 0) {
    return null;
  }

  const angularVelocity = (2 * Math.PI * rpm) / 60;
  const usefulPowerW = powerW * (input.efficiency / 100);
  const powerLossW = powerW - usefulPowerW;
  const torqueDisplayFactor = conversions[input.system].torqueFactor;
  return {
    solved,
    solvedLabel: solved === "power" ? "Power" : solved === "torque" ? "Torque" : "RPM",
    system: input.system,
    efficiency: input.efficiency,
    powerW,
    torqueNm,
    rpm,
    angularVelocity,
    usefulPowerW,
    powerLossW,
    displayPower: powerW / basePowerFactor,
    displayTorque: torqueNm / torqueDisplayFactor,
    displayUsefulPower: usefulPowerW / basePowerFactor,
    displayPowerLoss: powerLossW / basePowerFactor,
    powerUnit: powerUnitLabels[input.powerUnit] || "kW",
    torqueUnit: conversions[input.system].torqueUnit,
    inputPowerUnit: input.powerUnit,
  };
}

function fmt(value, digits = null) {
  const precision = digits ?? getDisplayPrecision();
  return formatNumber(value, precision);
}

function renderMath(targetId, expression, fallback = "Engineering equation") {
  const target = $(targetId);
  if (!target) return;
  if (window.katex?.renderToString) {
    target.innerHTML = window.katex.renderToString(expression, { throwOnError: false, displayMode: false });
  } else {
    target.textContent = fallback;
  }
}

function animateNumber(element, target, digits) {
  if (prefersReducedMotion.matches) {
    element.textContent = fmt(target, digits);
    return;
  }
  numberAnimations.push({ element, target, digits, started: performance.now() });
}

function updateDrivetrainAnimation(rpm) {
  targetRpm = Math.abs(rpm);
  targetDirection = rpm >= 0 ? 1 : -1;
  currentRpm = targetRpm;
  currentDirection = targetDirection;

  stopDrivetrainAnimation();
  drivetrainRotors = Array.from(document.querySelectorAll(drivetrainSelector));
  powerParticles = Array.from(document.querySelectorAll(".pt-power-particles circle"));

  if (!document.querySelector(".pt-motor-rotor")) {
    console.warn("[Power & Torque] Motor rotor element '.pt-motor-rotor' was not found; motor animation cannot start.");
  }

  if (prefersReducedMotion.matches || document.hidden) {
    return;
  }

  drivetrainLastTimestamp = null;
  animationFrameId = requestAnimationFrame(animateDrivetrain);
}

function getVisualRpm(actualRpm) {
  // Use square root scaling for smooth visual representation
  // 0 RPM = stopped, 3000 RPM = maximum visual speed
  const maxRpm = 3000;
  if (actualRpm <= 0) return 0;
  const normalized = Math.min(actualRpm / maxRpm, 1);
  return maximumVisualRpm * Math.sqrt(normalized);
}

function stopDrivetrainAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  drivetrainLastTimestamp = null;
}

function resetDrivetrainOrientation() {
  stopDrivetrainAnimation();
  drivetrainAngle = 0;
  powerParticlePhase = 0;
  numberAnimations = [];
  drivetrainRotors = Array.from(document.querySelectorAll(drivetrainSelector));
  powerParticles = Array.from(document.querySelectorAll(".pt-power-particles circle"));
  drivetrainRotors.forEach((element) => {
    element.style.transform = "rotate(0deg)";
  });
  powerParticles.forEach((element) => {
    element.style.transform = "translateX(0px)";
  });
}

function animateDrivetrain(timestamp) {
  if (document.hidden) {
    stopDrivetrainAnimation();
    return;
  }

  if (drivetrainLastTimestamp !== null) {
    const elapsedSeconds = Math.min((timestamp - drivetrainLastTimestamp) / 1000, 0.1);
    const visualRpm = getVisualRpm(targetRpm);
    drivetrainAngle = (drivetrainAngle + targetDirection * visualRpm * 6 * elapsedSeconds) % 360;

    // Power flow particles - represent transmitted power
    const particleSpeed = lastResult ? 28 + Math.min(92, 18 * Math.log10(1 + lastResult.powerW / 1000)) : 0;
    powerParticlePhase = (powerParticlePhase + particleSpeed * elapsedSeconds) % 319;
  }
  drivetrainLastTimestamp = timestamp;

  const gaugeNeedle = $("pt-gauge-needle");
  numberAnimations = numberAnimations.filter((animation) => {
    const progress = Math.min((timestamp - animation.started) / 450, 1);
    animation.element.textContent = fmt(animation.target * (1 - ((1 - progress) ** 3)), animation.digits);
    return progress < 1;
  });

  // Rotate all drivetrain components
  drivetrainRotors.forEach((element) => {
    element.style.transform = `rotate(${drivetrainAngle}deg)`;
  });

  // Animate power flow particles
  powerParticles.forEach((element, index) => {
    const offset = (powerParticlePhase + index * 79.75) % 319;
    element.style.transform = `translateX(${offset}px)`;
  });

  // Update gauge needle
  if (gaugeNeedle) {
    const angle = Math.max(-110, Math.min(110, (currentRpm / 1800) * 110));
    gaugeNeedle.style.transform = `rotate(${currentDirection >= 0 ? angle : -angle}deg)`;
  }

  animationFrameId = requestAnimationFrame(animateDrivetrain);
}

function resultCard(icon, title, value, unit, description, digits = 2, tone = "blue") {
  return `<article class="pt-result pt-result--${tone}"><div class="pt-result__top"><span class="pt-result__icon" aria-hidden="true">${icon}</span><h3>${title}</h3></div><p class="pt-result__value"><b data-result-number="${value}" data-digits="${digits}">${fmt(value, digits)}</b> <span>${unit}</span></p><p>${description}</p></article>`;
}

function updateMechanicalVisualization(result) {
  // Torque intensity for visual effects (logarithmic scaling)
  const torqueIntensity = Math.min(1, Math.log10(1 + result.torqueNm) / 4);
  const powerIntensity = Math.min(1, Math.log10(1 + result.powerW / 100) / 3);

  const torqueArrow = $("pt-torque-arrow");
  const powerFlow = $("pt-power-flow");
  const shaft = $("pt-shaft-body");
  const loadRim = $("pt-load-rim");
  const loadHub = $("pt-load-hub");

  // Torque arrow - thicker for higher torque
  if (torqueArrow) {
    torqueArrow.style.strokeWidth = String(2.5 + torqueIntensity * 5);
    torqueArrow.style.opacity = String(0.6 + torqueIntensity * 0.4);
  }

  // Power flow line - thicker for higher power
  if (powerFlow) {
    powerFlow.style.strokeWidth = String(2 + powerIntensity * 4);
    powerFlow.style.opacity = String(0.5 + powerIntensity * 0.5);
  }

  // Shaft glow - stronger for higher torque
  if (shaft) {
    shaft.style.filter = torqueIntensity > 0.15 ? "url(#shaftGlow)" : "none";
    shaft.style.opacity = String(0.82 + torqueIntensity * 0.18);
  }

  // Load rim - thicker stroke for higher torque
  if (loadRim) {
    loadRim.style.strokeWidth = String(2.5 + torqueIntensity * 3.5);
    loadRim.style.filter = torqueIntensity > 0.3 ? "url(#machineGlow)" : "none";
  }

  // Load hub glow
  if (loadHub) {
    loadHub.style.filter = torqueIntensity > 0.4 ? "url(#shaftGlow)" : "none";
  }
}

function renderResult(result) {
  lastResult = result;
  const primary = [
    resultCard("⚙", "Primary result", result.solved === "power" ? result.displayPower : result.solved === "torque" ? result.displayTorque : result.rpm, result.solved === "power" ? result.powerUnit : result.solved === "torque" ? result.torqueUnit : "rpm", `Calculated ${result.solvedLabel.toLowerCase()} from the supplied inputs.`, getDisplayPrecision(), "blue"),
    resultCard("↻", "Torque", result.displayTorque, result.torqueUnit, "Rotational force at the shaft.", getDisplayPrecision(), "green"),
  ].join("");
  const equivalents = [
    resultCard("W", "Power (W)", result.powerW, "W", "Equivalent power in watts.", getDisplayPrecision(), "blue"),
    resultCard("k", "Power (kW)", result.powerW / 1000, "kW", "Equivalent power in kilowatts.", getDisplayPrecision(), "blue"),
    resultCard("H", "Power (HP)", result.powerW / 735.49875, "HP", "Metric horsepower equivalent.", getDisplayPrecision(), "orange"),
    resultCard("M", "Power (Mechanical HP)", result.powerW / 745.699872, "HP", "Mechanical horsepower equivalent.", getDisplayPrecision(), "purple"),
  ].join("");
  const secondary = [
    resultCard("◴", "RPM", result.rpm, "rpm", "Calculated rotational speed.", getDisplayPrecision(), "orange"),
    resultCard("ω", "Angular velocity", result.angularVelocity, "rad/s", "Angular speed in SI units.", getDisplayPrecision(), "purple"),
    resultCard("⌁", "Mechanical power", result.displayUsefulPower, result.powerUnit, "Useful output after efficiency losses.", getDisplayPrecision(), "blue"),
    resultCard("Δ", "Power loss", result.displayPowerLoss, result.powerUnit, "Power dissipated by drivetrain inefficiency.", getDisplayPrecision(), "orange"),
    resultCard("η", "Efficiency", result.efficiency, "%", "Selected drivetrain efficiency.", 2, "green"),
  ].join("");

  $("results-grid").innerHTML = `
    <section class="pt-result-group" aria-labelledby="primary-results-title">
      <h3 class="pt-result-group__title" id="primary-results-title">Primary result</h3>
      <div class="pt-result-grid">${primary}</div>
    </section>
    <section class="pt-result-group" aria-labelledby="equivalent-results-title">
      <h3 class="pt-result-group__title" id="equivalent-results-title">Equivalent values</h3>
      <div class="pt-result-grid">${equivalents}</div>
    </section>
    <section class="pt-result-group" aria-labelledby="secondary-results-title">
      <h3 class="pt-result-group__title" id="secondary-results-title">Secondary results</h3>
      <div class="pt-result-grid">${secondary}</div>
    </section>`;

  const resultCards = $("results-grid").querySelectorAll(".pt-result");
  resultCards.forEach((card, index) => {
    card.style.animationDelay = `${index * 60}ms`;
    card.classList.add("is-visible");
  });

  $("results-grid").querySelectorAll("[data-result-number]").forEach((node) => {
    animateNumber(node, Number(node.dataset.resultNumber), Number(node.dataset.digits));
  });
  $("stat-direction").textContent = result.rpm >= 0 ? "Clockwise" : "Counter-Clockwise";
  $("stat-status").textContent = "✓ Normal Operation";
  $("stat-rpm").textContent = `${fmt(result.rpm, 1)} rpm`;
  $("stat-angular").textContent = `${fmt(result.angularVelocity)} rad/s`;
  $("stat-torque").textContent = `${fmt(result.displayTorque)} ${result.torqueUnit}`;
  $("stat-power").textContent = `${fmt(result.displayPower)} ${result.powerUnit}`;
  $("stat-efficiency").textContent = `${fmt(result.efficiency, 2)}%`;

  updateMechanicalVisualization(result);
  updateDrivetrainAnimation(result.rpm);
  renderWarnings(result);
  renderExample(result);
}

function renderWarnings(result) {
  const notes = [];
  if (result.efficiency < 70) notes.push("Low efficiency indicates significant heat loss; verify the drive selection.");
  if (result.efficiency > 98) notes.push("Efficiencies above 98% require validation against manufacturer test data.");
  if (result.rpm > 10000) notes.push("High rotational speed requires rotor balance, bearing, and critical-speed checks.");
  if (result.displayTorque > (result.system === "metric" ? 10000 : 7375)) notes.push("High torque may govern shaft diameter, key, and coupling selection.");
  if (!notes.length) notes.push("Inputs are within common operating ranges; verify against equipment ratings.");
  $("warnings-list").innerHTML = notes.map((note, index) => `<li class="${notes.length === 1 && index === 0 ? "is-ok" : ""}">${note}</li>`).join("");
}

function renderExample(result) {
  const content = {
    power: {
      formula: "P = \\frac{2\\pi N T}{60}",
      substitution: `P = \\frac{2\\pi \\times ${fmt(result.rpm, 1)} \\times ${fmt(result.torqueNm)}}{60}`,
      calculation: `\\omega = ${fmt(result.angularVelocity)} \\text{ rad/s}; \\quad P = ${fmt(result.powerW)} \\text{ W}`,
      answer: `P = ${fmt(result.displayPower)} ${result.powerUnit}`,
    },
    torque: {
      formula: "T = \\frac{60P}{2\\pi N}",
      substitution: `T = \\frac{60 \\times ${fmt(result.powerW)}}{2\\pi \\times ${fmt(result.rpm, 1)}}`,
      calculation: `\\omega = ${fmt(result.angularVelocity)} \\text{ rad/s}; \\quad T = ${fmt(result.torqueNm)} \\text{ N·m}`,
      answer: `T = ${fmt(result.displayTorque)} ${result.torqueUnit}`,
    },
    rpm: {
      formula: "N = \\frac{60P}{2\\pi T}",
      substitution: `N = \\frac{60 \\times ${fmt(result.powerW)}}{2\\pi \\times ${fmt(result.torqueNm)}}`,
      calculation: `N = ${fmt(result.rpm, 3)} \\text{ revolutions per minute}`,
      answer: `N = ${fmt(result.rpm, 1)} rpm`,
    },
  }[result.solved];

  $("example-given").textContent = [
    result.solved === "power" ? `P = ${fmt(result.displayPower)} ${result.powerUnit}` : `P = ${fmt(result.powerW)} W`,
    result.solved === "torque" ? `T = ${fmt(result.displayTorque)} ${result.torqueUnit}` : `T = ${fmt(result.torqueNm)} N·m`,
    result.solved === "rpm" ? `N = ${fmt(result.rpm, 1)} rpm` : `N = ${fmt(result.rpm, 1)} rpm`,
  ].join("; ");
  const plain = {
    power: {
      formula: "P = (2πNT) / 60",
      substitution: `P = (2π × ${fmt(result.rpm, 1)} × ${fmt(result.torqueNm)}) / 60`,
      calculation: `ω = ${fmt(result.angularVelocity)} rad/s; P = ${fmt(result.powerW)} W`,
      answer: `P = ${fmt(result.displayPower)} ${result.powerUnit}`,
    },
    torque: {
      formula: "T = (60P) / (2πN)",
      substitution: `T = (60 × ${fmt(result.powerW)}) / (2π × ${fmt(result.rpm, 1)})`,
      calculation: `ω = ${fmt(result.angularVelocity)} rad/s; T = ${fmt(result.torqueNm)} N·m`,
      answer: `T = ${fmt(result.displayTorque)} ${result.torqueUnit}`,
    },
    rpm: {
      formula: "N = (60P) / (2πT)",
      substitution: `N = (60 × ${fmt(result.powerW)}) / (2π × ${fmt(result.torqueNm)})`,
      calculation: `N = ${fmt(result.rpm, 3)} revolutions per minute`,
      answer: `N = ${fmt(result.rpm, 1)} rpm`,
    },
  }[result.solved];
  renderMath("example-formula", content.formula, plain.formula);
  renderMath("example-substitution", content.substitution, plain.substitution);
  renderMath("example-calculation", content.calculation, plain.calculation);
  renderMath("example-answer", content.answer, plain.answer);
}

function renderFormulaCards() {
  renderMath("formula-power", "P = \\frac{2\\pi N T}{60}", "P = (2πNT) / 60");
  renderMath("formula-angular", "\\omega = \\frac{2\\pi N}{60}", "ω = (2πN) / 60");
  renderMath("formula-torque", "T = \\frac{60P}{2\\pi N}", "T = (60P) / (2πN)");
}

function run(showMessage = false) {
  const input = values();
  if (!validate(input)) {
    stopDrivetrainAnimation();
    lastResult = null;
    $("results-grid").innerHTML = "";
    if ($("stat-status")) $("stat-status").textContent = "Check Inputs";
    return false;
  }
  const result = calculate(input);
  if (!result) {
    stopDrivetrainAnimation();
    lastResult = null;
    $("results-grid").innerHTML = "";
    if ($("stat-status")) $("stat-status").textContent = "Calculation Error";
    return false;
  }
  renderResult(result);
  if (showMessage) success(`${result.solvedLabel} calculated.`);
  return true;
}

function convertUnitSystem() {
  const next = unitSystem();
  const from = conversions[previousSystem];
  const to = conversions[next];
  const torque = rawValue("torque");
  if (torque !== null) {
    $("torque").value = (torque * from.torqueFactor / to.torqueFactor).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  }
  previousSystem = next;
  run();
}

function handlePowerUnitChange() {
  const next = powerUnit();
  const power = rawValue("power");
  if (power !== null && previousPowerUnit !== next) {
    const previousFactor = powerUnitFactors[previousPowerUnit] ?? powerUnitFactors.kw;
    const nextFactor = powerUnitFactors[next] ?? powerUnitFactors.kw;
    $("power").value = (power * previousFactor / nextFactor).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  }
  previousPowerUnit = next;
  run();
}

function copyResults() {
  if (!lastResult) return warning("Enter two valid values before copying.");
  const timestamp = new Date();
  const input = values();
  const text = [
    "═══════════════════════════════════════════════════════════════",
    "AXION ENGINEERING SUITE",
    "Power & Torque - Engineering Calculation Report",
    "═══════════════════════════════════════════════════════════════",
    "",
    "REPORT INFORMATION",
    "───────────────────────────────────────────────────────────────",
    `Generated:        ${timestamp.toLocaleString()}`,
    `Calculator:       Power & Torque Calculator`,
    `Version:          1.0`,
    "",
    "INPUT PARAMETERS",
    "───────────────────────────────────────────────────────────────",
    `Power:            ${input.power === null ? "Calculated" : `${fmt(input.power)} ${lastResult.powerUnit}`}`,
    `Torque:           ${input.torque === null ? "Calculated" : `${fmt(input.torque)} ${lastResult.torqueUnit}`}`,
    `RPM:              ${input.rpm === null ? "Calculated" : `${fmt(input.rpm, 1)} rpm`}`,
    `Efficiency:       ${fmt(input.efficiency, 2)}%`,
    `Unit System:      ${input.system === "metric" ? "SI (Metric)" : "Imperial (US)"}`,
    "",
    "CALCULATED RESULTS",
    "───────────────────────────────────────────────────────────────",
    `Primary Result:   ${fmt(lastResult.solved === "power" ? lastResult.displayPower : lastResult.solved === "torque" ? lastResult.displayTorque : lastResult.rpm)} ${lastResult.solved === "power" ? lastResult.powerUnit : lastResult.solved === "torque" ? lastResult.torqueUnit : "rpm"}`,
    `Power:            ${fmt(lastResult.displayPower)} ${lastResult.powerUnit}`,
    `Torque:           ${fmt(lastResult.displayTorque)} ${lastResult.torqueUnit}`,
    `RPM:              ${fmt(lastResult.rpm, 1)} rpm`,
    `Angular Velocity: ${fmt(lastResult.angularVelocity)} rad/s`,
    `Mechanical Power: ${fmt(lastResult.displayUsefulPower)} ${lastResult.powerUnit}`,
    `Power Loss:       ${fmt(lastResult.displayPowerLoss)} ${lastResult.powerUnit}`,
    `Efficiency:       ${fmt(lastResult.efficiency, 2)}%`,
    "",
    "FORMULA USED",
    "───────────────────────────────────────────────────────────────",
    lastResult.solved === "power" ? "P = (2πNT) / 60" : lastResult.solved === "torque" ? "T = (60P) / (2πN)" : "N = (60P) / (2πT)",
    "",
    "ENGINEERING NOTES",
    "───────────────────────────────────────────────────────────────",
    "• Verify service factor, duty cycle, and thermal limits",
    "• Check shaft stress, coupling capacity, and bearing ratings",
    "• Confirm manufacturer specifications before implementation",
    "• Consider safety factors for critical applications",
    "",
    "═══════════════════════════════════════════════════════════════",
    "Report generated by Axion Engineering Suite",
    "═══════════════════════════════════════════════════════════════",
  ].join("\n");
  copyToClipboard(text).then(() => success("Professional report copied to clipboard.")).catch(() => error("Clipboard access is unavailable."));
}

function saveCalculation() {
  if (!lastResult) return warning("Enter two valid values before saving.");
  addCalculationHistory({ calculatorId: "power-torque", calculatorName: "Power & Torque", inputs: values(), outputs: lastResult });
  recordRecentCalculator({ id: "power-torque", label: "Power & Torque" });
  success("Calculation saved to history.");
}

function toggleFavourite() {
  const calculator = getCalculatorById("power-torque");
  const favourites = toggleFavouriteCalculator(calculator);
  const active = favourites.some((item) => item.id === "power-torque");
  $("toggle-favourite").textContent = active ? "★ Favourite" : "☆ Favourite";
  $("toggle-favourite").classList.toggle("is-active", active);
  $("toggle-favourite").setAttribute("aria-pressed", String(active));
  success(active ? "Added to favourites." : "Removed from favourites.");
}

function initFavourite() {
  const active = getFavouriteCalculators().some((item) => item.id === "power-torque");
  $("toggle-favourite").textContent = active ? "★ Favourite" : "☆ Favourite";
  $("toggle-favourite").classList.toggle("is-active", active);
  $("toggle-favourite").setAttribute("aria-pressed", String(active));
}

function exportCsv() {
  if (!lastResult) return warning("Enter two valid values before exporting.");
  const rows = [
    ["Axion Engineering Suite - Power & Torque Report", "", ""],
    ["Generated", new Date().toISOString(), ""],
    ["Solved quantity", lastResult.solvedLabel, ""],
    ["Parameter", "Value", "Unit"],
    ["Power", lastResult.displayPower, lastResult.powerUnit],
    ["Torque", lastResult.displayTorque, lastResult.torqueUnit],
    ["RPM", lastResult.rpm, "rpm"],
    ["Angular Velocity", lastResult.angularVelocity, "rad/s"],
    ["Mechanical Power", lastResult.displayUsefulPower, lastResult.powerUnit],
    ["Power Loss", lastResult.displayPowerLoss, lastResult.powerUnit],
    ["Efficiency", lastResult.efficiency, "%"],
    ["Formula Used", lastResult.solved === "power" ? "P = (2*pi*N*T)/60" : lastResult.solved === "torque" ? "T = (60*P)/(2*pi*N)" : "N = (60*P)/(2*pi*T)", ""],
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  exporter.exportCsv(csv, { filename: "power-torque-results.csv" }).then((file) => {
    downloadFile(file.content, file.filename, "text/csv;charset=utf-8");
    success("CSV export created.");
  });
}

function loadJsPdf() {
  if (window.jspdf?.jsPDF || window.jspdf) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("PDF library could not be loaded."));
    document.head.appendChild(script);
  });
}

async function exportPdf() {
  if (!lastResult) return warning("Enter two valid values before exporting.");
  try {
    await loadJsPdf();
    const input = values();
    const jsPDF = window.jspdf?.jsPDF ?? window.jspdf;
    if (!jsPDF) throw new Error("PDF library is unavailable.");

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const margin = 42;
    const generatedAt = new Date();
    const inputs = [
      ["Power", input.power === null ? "Calculated" : `${fmt(input.power)} ${lastResult.powerUnit}`],
      ["Torque", input.torque === null ? "Calculated" : `${fmt(input.torque)} ${lastResult.torqueUnit}`],
      ["Rotational speed", input.rpm === null ? "Calculated" : `${fmt(input.rpm, 1)} rpm`],
      ["Efficiency", `${fmt(input.efficiency, 2)}%`],
      ["Unit system", input.system === "metric" ? "SI (Metric)" : "Imperial (US)"],
      ["Power unit", powerUnitLabels[input.powerUnit] || "kW"],
    ];
    const results = [
      ["Primary result", `${fmt(lastResult.solved === "power" ? lastResult.displayPower : lastResult.solved === "torque" ? lastResult.displayTorque : lastResult.rpm)} ${lastResult.solved === "power" ? lastResult.powerUnit : lastResult.solved === "torque" ? lastResult.torqueUnit : "rpm"}`],
      ["Power", `${fmt(lastResult.displayPower)} ${lastResult.powerUnit}`],
      ["Torque", `${fmt(lastResult.displayTorque)} ${lastResult.torqueUnit}`],
      ["RPM", `${fmt(lastResult.rpm, 1)} rpm`],
      ["Angular velocity", `${fmt(lastResult.angularVelocity)} rad/s`],
      ["Mechanical power", `${fmt(lastResult.displayUsefulPower)} ${lastResult.powerUnit}`],
      ["Power loss", `${fmt(lastResult.displayPowerLoss)} ${lastResult.powerUnit}`],
      ["Efficiency", `${fmt(lastResult.efficiency, 2)}%`],
    ];
    const formulas = [
      ["Power", "P = (2πNT)/60"],
      ["Torque", "T = (60P)/(2πN)"],
      ["RPM", "N = (60P)/(2πT)"],
    ];

    let y = 116;
    const drawHeader = () => {
      doc.setFillColor(5, 18, 35);
      doc.rect(0, 0, width, 92, "F");
      doc.setDrawColor(48, 187, 247);
      doc.setLineWidth(2);
      doc.circle(margin + 12, 29, 11);
      doc.line(margin + 5, 29, margin + 19, 29);
      doc.line(margin + 12, 22, margin + 12, 36);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text("AXION ENGINEERING SUITE", margin + 32, 33);
      doc.setFontSize(19);
      doc.text("Power & Torque Calculation Report", margin, 63);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(168, 190, 209);
      doc.text(`Generated ${generatedAt.toLocaleDateString()} at ${generatedAt.toLocaleTimeString()}`, margin, 79);
      doc.text("Version 1.0", width - margin, 79, { align: "right" });
    };

    const sectionTitle = (title) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(24, 119, 194);
      doc.text(title.toUpperCase(), margin, y);
      y += 10;
      doc.setDrawColor(203, 218, 231);
      doc.setLineWidth(0.6);
      doc.line(margin, y, width - margin, y);
      y += 13;
    };

    const table = (rows, highlight = false) => {
      rows.forEach(([label, value], index) => {
        const rowY = y;
        doc.setFillColor(...(highlight ? (index < 2 ? [226, 244, 255] : [246, 249, 252]) : (index % 2 ? [248, 250, 252] : [241, 246, 250])));
        doc.roundedRect(margin, rowY, width - margin * 2, 25, 2, 2, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(58, 74, 91);
        doc.text(label, margin + 10, rowY + 16);
        doc.setFont("helvetica", highlight ? "bold" : "normal");
        doc.setTextColor(...(highlight ? [10, 94, 162] : [20, 35, 50]));
        doc.text(String(value), width - margin - 10, rowY + 16, { align: "right" });
        y += 29;
      });
      y += 12;
    };

    drawHeader();
    sectionTitle("Input parameters");
    table(inputs);
    sectionTitle("Calculated results");
    table(results, true);
    doc.addPage();
    y = 50;
    sectionTitle("Engineering equations");
    table(formulas.map(([label, equation]) => [label, equation]));
    sectionTitle("Worked example");
    table([
      ["Given", `P = ${fmt(lastResult.powerW)} W; T = ${fmt(lastResult.torqueNm)} N m; N = ${fmt(lastResult.rpm, 1)} rpm`],
      ["Formula used", formulas.find(([label]) => label === lastResult.solvedLabel)?.[1] || formulas[0][1]],
      ["Final answer", `${lastResult.solvedLabel} = ${fmt(lastResult.solved === "power" ? lastResult.displayPower : lastResult.solved === "torque" ? lastResult.displayTorque : lastResult.rpm)} ${lastResult.solved === "power" ? lastResult.powerUnit : lastResult.solved === "torque" ? lastResult.torqueUnit : "rpm"}`],
    ]);
    sectionTitle("Engineering notes");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(77, 92, 108);
    const disclaimer = "Results are provided for engineering estimation. Verify duty cycle, service factor, thermal limits, shaft stress, coupling capacity, bearing speed and manufacturer ratings before release.";
    doc.text(doc.splitTextToSize(disclaimer, width - margin * 2), margin, y, { lineHeightFactor: 1.45 });

    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(210, 221, 230);
      doc.line(margin, height - 38, width - margin, height - 38);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(104, 122, 139);
      doc.text("Axion Engineering Suite", margin, height - 23);
      doc.text(`Page ${page} of ${pages}`, width - margin, height - 23, { align: "right" });
    }

    const blob = doc.output("blob");
    if (!(blob instanceof Blob) || blob.type !== "application/pdf" || blob.size < 1000) throw new Error("Invalid PDF output.");
    downloadFile(blob, `power-torque-report-${generatedAt.toISOString().slice(0, 10)}.pdf`, "application/pdf");
    success("PDF report created.");
  } catch (reason) {
    error(reason.message || "PDF export failed.");
  }
}

function reset() {
  $("power-torque-form").reset();
  $("power").value = "15";
  $("torque").value = "";
  $("rpm").value = "1500";
  $("efficiency").value = "92";
  $("power-unit-select").value = "kw";
  previousSystem = "metric";
  previousPowerUnit = "kw";
  currentRpm = 0;
  targetRpm = 0;
  currentDirection = 1;
  targetDirection = 1;
  run();
  resetDrivetrainOrientation();
}

export function init() {
  const form = $("power-torque-form");
  if (!form || form.dataset.initialized === "true") return;
  form.dataset.initialized = "true";
  renderFormulaCards();
  form.addEventListener("submit", (event) => { event.preventDefault(); run(true); });
  form.addEventListener("input", (event) => {
    if (event.target.name === "unit-system") convertUnitSystem();
    else if (event.target.id === "power-unit-select") handlePowerUnitChange();
    else run();
  });
  $("copy-results").addEventListener("click", copyResults);
  $("save-calculation").addEventListener("click", saveCalculation);
  $("toggle-favourite").addEventListener("click", toggleFavourite);
  $("print-results").addEventListener("click", () => window.print());
  $("reset-form").addEventListener("click", reset);
  $("export-csv").addEventListener("click", exportCsv);
  $("export-pdf").addEventListener("click", exportPdf);

  prefersReducedMotion.addEventListener("change", () => {
    if (prefersReducedMotion.matches) {
      stopDrivetrainAnimation();
    } else if (lastResult) {
      updateDrivetrainAnimation(lastResult.rpm);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopDrivetrainAnimation();
    } else if (lastResult && !prefersReducedMotion.matches) {
      updateDrivetrainAnimation(lastResult.rpm);
    }
  });
  window.addEventListener("pagehide", stopDrivetrainAnimation);

  initFavourite();
  run();
}
