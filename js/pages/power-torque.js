import { ExportService } from "../framework/exporters.js";
import { success, error, warning } from "../framework/notifications.js";
import { addCalculationHistory, getFavouriteCalculators, recordRecentCalculator, toggleFavouriteCalculator } from "../framework/storage.js";
import { copyToClipboard, downloadFile } from "../framework/utilities.js";
import { getCalculatorById } from "../data/calculators.js";

const exporter = new ExportService();
const $ = (id) => document.getElementById(id);
const fields = ["power", "torque", "rpm"];
const conversions = {
  metric: { powerFactor: 1000, torqueFactor: 1, powerUnit: "kW", torqueUnit: "N·m" },
  imperial: { powerFactor: 745.699872, torqueFactor: 1.3558179483, powerUnit: "hp", torqueUnit: "lb·ft" },
};
let lastResult = null;
let previousSystem = "metric";

function unitSystem() {
  return document.querySelector('input[name="unit-system"]:checked')?.value || "metric";
}

function rawValue(id) {
  const value = $(id).value.trim();
  return value === "" ? null : Number(value);
}

function values() {
  return {
    power: rawValue("power"),
    torque: rawValue("torque"),
    rpm: rawValue("rpm"),
    efficiency: rawValue("efficiency"),
    system: unitSystem(),
  };
}

function clearErrors() {
  [...fields, "efficiency"].forEach((id) => {
    $(`${id}-error`).textContent = "";
    $(id).closest(".pt-input").classList.remove("is-invalid");
  });
}

function setError(id, message) {
  $(`${id}-error`).textContent = message;
  $(id).closest(".pt-input").classList.add("is-invalid");
}

function validate(input) {
  clearErrors();
  let valid = true;
  fields.forEach((id) => {
    if (input[id] !== null && (!Number.isFinite(input[id]) || input[id] <= 0)) {
      setError(id, "Enter a value greater than zero.");
      valid = false;
    }
  });
  if (!Number.isFinite(input.efficiency) || input.efficiency <= 0 || input.efficiency > 100) {
    setError("efficiency", "Efficiency must be greater than 0 and no more than 100%.");
    valid = false;
  }
  const entered = fields.filter((id) => input[id] !== null);
  if (entered.length !== 2) {
    const target = entered.length < 2 ? fields.find((id) => input[id] === null) : entered[2];
    if (target) setError(target, entered.length < 2 ? "Enter exactly two primary values." : "Leave one primary value blank to solve it.");
    valid = false;
  }
  return valid;
}

function calculate(input) {
  const unit = conversions[input.system];
  let powerW = input.power === null ? null : input.power * unit.powerFactor;
  let torqueNm = input.torque === null ? null : input.torque * unit.torqueFactor;
  let rpm = input.rpm;
  let solved;

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

  const angularVelocity = (2 * Math.PI * rpm) / 60;
  const usefulPowerW = powerW * (input.efficiency / 100);
  return {
    solved,
    system: input.system,
    efficiency: input.efficiency,
    powerW,
    torqueNm,
    rpm,
    angularVelocity,
    usefulPowerW,
    displayPower: powerW / unit.powerFactor,
    displayTorque: torqueNm / unit.torqueFactor,
    displayUsefulPower: usefulPowerW / unit.powerFactor,
    powerUnit: unit.powerUnit,
    torqueUnit: unit.torqueUnit,
  };
}

function fmt(value, digits = 3) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function animateNumber(element, target, digits) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.textContent = fmt(target, digits);
    return;
  }
  const started = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - started) / 450, 1);
    element.textContent = fmt(target * (1 - ((1 - progress) ** 3)), digits);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function resultCard(icon, title, value, unit, description, digits = 3, tone = "blue") {
  return `<article class="pt-result pt-result--${tone}"><div class="pt-result__top"><span class="pt-result__icon" aria-hidden="true">${icon}</span><h3>${title}</h3></div><p class="pt-result__value"><b data-result-number="${value}" data-digits="${digits}">${fmt(value, digits)}</b> <span>${unit}</span></p><p>${description}</p></article>`;
}

function renderResult(result) {
  lastResult = result;
  const primary = [
    resultCard("⚡", "Power", result.displayPower, result.powerUnit, "Power transmitted at the shaft.", 3, "blue"),
    resultCard("↻", "Torque", result.displayTorque, result.torqueUnit, "Rotational force at the shaft.", 3, "green"),
  ].join("");
  const secondary = [
    resultCard("◴", "RPM", result.rpm, "rpm", "Calculated rotational speed.", 1, "orange"),
    resultCard("ω", "Angular Velocity", result.angularVelocity, "rad/s", "Speed expressed in SI angular units.", 3, "purple"),
    resultCard("⌁", "Mechanical Power", result.displayUsefulPower, result.powerUnit, "Useful output after efficiency losses.", 3, "blue"),
    resultCard("η", "Efficiency", result.efficiency, "%", "Selected drivetrain efficiency.", 2, "green"),
  ].join("");
  $("results-grid").innerHTML = `
    <section class="pt-result-group" aria-labelledby="primary-results-title">
      <h3 class="pt-result-group__title" id="primary-results-title">Primary results</h3>
      <div class="pt-result-grid">${primary}</div>
    </section>
    <section class="pt-result-group" aria-labelledby="secondary-results-title">
      <h3 class="pt-result-group__title" id="secondary-results-title">Secondary results</h3>
      <div class="pt-result-grid">${secondary}</div>
    </section>`;
  $("results-grid").querySelectorAll("[data-result-number]").forEach((node) => {
    animateNumber(node, Number(node.dataset.resultNumber), Number(node.dataset.digits));
  });
  $("stat-power").textContent = `${fmt(result.displayPower)} ${result.powerUnit}`;
  $("stat-torque").textContent = `${fmt(result.displayTorque)} ${result.torqueUnit}`;
  $("stat-rpm").textContent = `${fmt(result.rpm, 1)} rpm`;
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
  const unit = conversions[result.system];
  const given = fields.filter((id) => id !== result.solved).map((id) => {
    if (id === "power") return `P = ${fmt(result.displayPower)} ${unit.powerUnit}`;
    if (id === "torque") return `τ = ${fmt(result.displayTorque)} ${unit.torqueUnit}`;
    return `N = ${fmt(result.rpm, 1)} rpm`;
  }).join(", ");
  const content = {
    power: {
      formula: "P = τ × (2πN / 60)",
      substitution: `P = ${fmt(result.torqueNm)} × (2π × ${fmt(result.rpm, 1)} / 60)`,
      calculation: `ω = ${fmt(result.angularVelocity)} rad/s; P = ${fmt(result.powerW)} W`,
      answer: `P = ${fmt(result.displayPower)} ${result.powerUnit}`,
    },
    torque: {
      formula: "τ = P / (2πN / 60)",
      substitution: `τ = ${fmt(result.powerW)} / (2π × ${fmt(result.rpm, 1)} / 60)`,
      calculation: `ω = ${fmt(result.angularVelocity)} rad/s; τ = ${fmt(result.torqueNm)} N·m`,
      answer: `τ = ${fmt(result.displayTorque)} ${result.torqueUnit}`,
    },
    rpm: {
      formula: "N = 60P / (2πτ)",
      substitution: `N = (60 × ${fmt(result.powerW)}) / (2π × ${fmt(result.torqueNm)})`,
      calculation: `N = ${fmt(result.rpm, 3)} revolutions per minute`,
      answer: `N = ${fmt(result.rpm, 1)} rpm`,
    },
  }[result.solved];
  $("example-given").textContent = given;
  $("example-formula").textContent = content.formula;
  $("example-substitution").textContent = content.substitution;
  $("example-calculation").textContent = content.calculation;
  $("example-answer").textContent = content.answer;
}

function run(showMessage = false) {
  const input = values();
  if (!validate(input)) {
    lastResult = null;
    return false;
  }
  const result = calculate(input);
  if (!Object.values(result).filter((value) => typeof value === "number").every(Number.isFinite)) {
    warning("The selected values produce an invalid result.");
    return false;
  }
  renderResult(result);
  if (showMessage) success(`${result.solved[0].toUpperCase()}${result.solved.slice(1)} calculated.`);
  return true;
}

function convertUnitSystem() {
  const next = unitSystem();
  const from = conversions[previousSystem];
  const to = conversions[next];
  const power = rawValue("power");
  const torque = rawValue("torque");
  if (power !== null) $("power").value = (power * from.powerFactor / to.powerFactor).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (torque !== null) $("torque").value = (torque * from.torqueFactor / to.torqueFactor).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  $("power-unit").textContent = to.powerUnit;
  $("torque-unit").textContent = to.torqueUnit;
  previousSystem = next;
  run();
}

function copyResults() {
  if (!lastResult) return warning("Enter two valid values before copying.");
  const text = [
    "Axion Engineering Suite — Power & Torque",
    `Power: ${fmt(lastResult.displayPower)} ${lastResult.powerUnit}`,
    `Torque: ${fmt(lastResult.displayTorque)} ${lastResult.torqueUnit}`,
    `Speed: ${fmt(lastResult.rpm, 1)} rpm`,
    `Angular velocity: ${fmt(lastResult.angularVelocity)} rad/s`,
    `Useful mechanical power: ${fmt(lastResult.displayUsefulPower)} ${lastResult.powerUnit}`,
    `Efficiency: ${fmt(lastResult.efficiency, 2)}%`,
  ].join("\n");
  copyToClipboard(text).then(() => success("Results copied to clipboard.")).catch(() => error("Clipboard access is unavailable."));
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
    ["Metric", "Value", "Unit"],
    ["Power", lastResult.displayPower, lastResult.powerUnit],
    ["Torque", lastResult.displayTorque, lastResult.torqueUnit],
    ["RPM", lastResult.rpm, "rpm"],
    ["Angular Velocity", lastResult.angularVelocity, "rad/s"],
    ["Mechanical Power", lastResult.displayUsefulPower, lastResult.powerUnit],
    ["Efficiency", lastResult.efficiency, "%"],
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
      ["Power", input.power === null ? "Calculated" : `${input.power} ${lastResult.powerUnit}`],
      ["Torque", input.torque === null ? "Calculated" : `${input.torque} ${lastResult.torqueUnit}`],
      ["Rotational speed", input.rpm === null ? "Calculated" : `${input.rpm} rpm`],
      ["Efficiency", `${input.efficiency}%`],
      ["Unit system", input.system === "metric" ? "SI (Metric)" : "Imperial (US)"],
    ];
    const results = [
      ["Power", `${fmt(lastResult.displayPower)} ${lastResult.powerUnit}`],
      ["Torque", `${fmt(lastResult.displayTorque)} ${lastResult.torqueUnit}`],
      ["RPM", `${fmt(lastResult.rpm, 1)} rpm`],
      ["Angular velocity", `${fmt(lastResult.angularVelocity)} rad/s`],
      ["Useful mechanical power", `${fmt(lastResult.displayUsefulPower)} ${lastResult.powerUnit}`],
      ["Efficiency", `${fmt(lastResult.efficiency, 2)}%`],
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
        doc.roundedRect(margin, rowY, width - (margin * 2), 25, 2, 2, "F");
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
    sectionTitle("Engineering equations");
    table([
      ["Power relationship", "P = torque x angular velocity"],
      ["Angular velocity", "angular velocity = 2 x pi x RPM / 60"],
      ["Torque relationship", "torque = P / angular velocity"],
    ]);
    sectionTitle("Engineering disclaimer");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(77, 92, 108);
    const disclaimer = "Results are provided for engineering estimation. Verify duty cycle, service factor, thermal limits, shaft stress, coupling capacity, bearing speed and manufacturer ratings before design release or equipment operation.";
    doc.text(doc.splitTextToSize(disclaimer, width - (margin * 2)), margin, y, { lineHeightFactor: 1.45 });

    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(210, 221, 230);
      doc.line(margin, height - 38, width - margin, height - 38);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(104, 122, 139);
      doc.text("Generated by Axion Engineering Suite", margin, height - 23);
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
  previousSystem = "metric";
  $("power-unit").textContent = "kW";
  $("torque-unit").textContent = "N·m";
  run();
}

export function init() {
  const form = $("power-torque-form");
  if (!form) return;
  form.addEventListener("submit", (event) => { event.preventDefault(); run(true); });
  form.addEventListener("input", (event) => {
    if (event.target.name === "unit-system") convertUnitSystem();
    else run();
  });
  $("copy-results").addEventListener("click", copyResults);
  $("save-calculation").addEventListener("click", saveCalculation);
  $("toggle-favourite").addEventListener("click", toggleFavourite);
  $("print-results").addEventListener("click", () => window.print());
  $("reset-form").addEventListener("click", reset);
  $("export-csv").addEventListener("click", exportCsv);
  $("export-pdf").addEventListener("click", exportPdf);
  initFavourite();
  run();
}
