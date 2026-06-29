import { ExportService } from "../framework/exporters.js";
import { success, error, warning } from "../framework/notifications.js";
import { addCalculationHistory, getFavouriteCalculators, recordRecentCalculator, toggleFavouriteCalculator } from "../framework/storage.js";
import { copyToClipboard, downloadFile } from "../framework/utilities.js";
import { getCalculatorById } from "../data/calculators.js";

const exporter = new ExportService();
const $ = (id) => document.getElementById(id);
const conversions = {
    metric: { lengthUnit: "m", forceUnit: "N", momentUnit: "N·m", deflectionUnit: "mm" },
    imperial: { lengthUnit: "ft", forceUnit: "lbf", momentUnit: "lbf·ft", deflectionUnit: "in" },
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
        beamType: $("beam-type").value,
        length: rawValue("beam-length"),
        loadType: $("load-type").value,
        loadMagnitude: rawValue("load-magnitude"),
        loadPosition: rawValue("load-position"),
        elasticModulus: rawValue("elastic-modulus"),
        momentInertia: rawValue("moment-inertia"),
        system: unitSystem(),
    };
}

function clearErrors() {
    ["beam-length", "load-magnitude", "load-position", "elastic-modulus", "moment-inertia"].forEach((id) => {
        $(`${id}-error`).textContent = "";
        $(id).closest(".form-group").classList.remove("is-invalid");
    });
}

function setError(id, message) {
    $(`${id}-error`).textContent = message;
    $(id).closest(".form-group").classList.add("is-invalid");
}

function validate(input) {
    clearErrors();
    let valid = true;

    if (!input.length || input.length <= 0) {
        setError("beam-length", "Enter a valid beam length.");
        valid = false;
    }

    if (!input.loadMagnitude || input.loadMagnitude <= 0) {
        setError("load-magnitude", "Enter a load greater than zero.");
        valid = false;
    }

    if (input.loadPosition !== null && (input.loadPosition < 0 || input.loadPosition > input.length)) {
        setError("load-position", `Load position must be between 0 and ${input.length} m.`);
        valid = false;
    }

    if (!input.elasticModulus || input.elasticModulus <= 0) {
        setError("elastic-modulus", "Enter a valid elastic modulus.");
        valid = false;
    }

    if (!input.momentInertia || input.momentInertia <= 0) {
        setError("moment-inertia", "Enter a valid moment of inertia.");
        valid = false;
    }

    return valid;
}

function calculateDeflection(input) {
    const { beamType, length, loadType, loadMagnitude, loadPosition, elasticModulus, momentInertia } = input;
    const E = elasticModulus * 1e9; // Convert GPa to Pa
    const I = momentInertia;
    const L = length;
    const P = loadMagnitude;
    const a = loadPosition || L / 2;
    const w = loadType === "uniform-load" ? loadMagnitude / L : 0;

    let maxDeflection = 0;
    let deflectionAtMidspan = 0;
    let bendingMomentMax = 0;
    let shearForceMax = 0;
    let formula = "";
    let description = "";

    if (beamType === "cantilever") {
        if (loadType === "point-load") {
            // Cantilever with end point load
            maxDeflection = (P * L ** 3) / (3 * E * I);
            deflectionAtMidspan = (P * L ** 3) / (8 * E * I);
            bendingMomentMax = P * L;
            shearForceMax = P;
            formula = "δ_max = PL³ / (3EI)";
            description = "Cantilever beam with end point load";
        } else if (loadType === "uniform-load") {
            // Cantilever with uniform load
            maxDeflection = (w * L ** 4) / (8 * E * I);
            deflectionAtMidspan = (5 * w * L ** 4) / (384 * E * I);
            bendingMomentMax = w * L ** 2 / 2;
            shearForceMax = w * L;
            formula = "δ_max = wL⁴ / (8EI)";
            description = "Cantilever beam with uniform load";
        } else if (loadType === "moment") {
            // Cantilever with end moment
            maxDeflection = (P * L ** 2) / (2 * E * I);
            deflectionAtMidspan = (P * L ** 2) / (16 * E * I);
            bendingMomentMax = P;
            shearForceMax = 0;
            formula = "δ_max = ML² / (2EI)";
            description = "Cantilever beam with end moment";
        }
    } else if (beamType === "simply-supported") {
        if (loadType === "point-load") {
            // Simply supported with center point load
            maxDeflection = (P * L ** 3) / (48 * E * I);
            deflectionAtMidspan = maxDeflection;
            bendingMomentMax = P * L / 4;
            shearForceMax = P / 2;
            formula = "δ_max = PL³ / (48EI)";
            description = "Simply supported beam with center point load";
        } else if (loadType === "uniform-load") {
            // Simply supported with uniform load
            maxDeflection = (5 * w * L ** 4) / (384 * E * I);
            deflectionAtMidspan = maxDeflection;
            bendingMomentMax = w * L ** 2 / 8;
            shearForceMax = w * L / 2;
            formula = "δ_max = 5wL⁴ / (384EI)";
            description = "Simply supported beam with uniform load";
        } else if (loadType === "moment") {
            // Simply supported with center moment
            maxDeflection = (P * L ** 2) / (16 * E * I);
            deflectionAtMidspan = maxDeflection;
            bendingMomentMax = P / 4;
            shearForceMax = 0;
            formula = "δ_max = ML² / (16EI)";
            description = "Simply supported beam with center moment";
        }
    }

    return {
        beamType,
        loadType,
        description,
        formula,
        maxDeflection,
        deflectionAtMidspan,
        bendingMomentMax,
        shearForceMax,
        length: L,
        loadMagnitude: P,
        loadPosition: a,
        elasticModulus: input.elasticModulus,
        momentInertia: I,
        system: input.system,
    };
}

function fmt(value, digits = 4) {
    if (value === null || value === undefined) return "—";
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtScientific(value, digits = 3) {
    if (value === null || value === undefined) return "—";
    return Number(value).toExponential(digits);
}

function animateNumber(element, target, digits = 4) {
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

function resultCard(icon, title, value, unit, description, digits = 4, tone = "blue") {
    return `<article class="bd-result bd-result--${tone}"><div class="bd-result__top"><span class="bd-result__icon" aria-hidden="true">${icon}</span><h3>${title}</h3></div><p class="bd-result__value"><b data-result-number="${value}" data-digits="${digits}">${fmt(value, digits)}</b> <span>${unit}</span></p><p>${description}</p></article>`;
}

function renderResult(result) {
    lastResult = result;
    const primary = [
        resultCard("↯", "Max Deflection", result.maxDeflection * 1000, "mm", "Maximum deflection along the beam.", 4, "blue"),
        resultCard("M", "Max Bending Moment", result.bendingMomentMax, "N·m", "Maximum bending moment in the beam.", 2, "green"),
    ].join("");
    const secondary = [
        resultCard("V", "Max Shear Force", result.shearForceMax, "N", "Maximum shear force in the beam.", 2, "orange"),
        resultCard("δ", "Deflection at Midspan", result.deflectionAtMidspan * 1000, "mm", "Deflection at the midpoint of the span.", 4, "purple"),
    ].join("");

    $("results-container").innerHTML = `
    <section class="bd-result-group" aria-labelledby="primary-results-title">
      <h3 class="bd-result-group__title" id="primary-results-title">Primary results</h3>
      <div class="bd-result-grid">${primary}</div>
    </section>
    <section class="bd-result-group" aria-labelledby="secondary-results-title">
      <h3 class="bd-result-group__title" id="secondary-results-title">Secondary results</h3>
      <div class="bd-result-grid">${secondary}</div>
    </section>
    <section class="bd-formula-section" aria-labelledby="formula-title">
      <h3 class="bd-formula-section__title" id="formula-title">Engineering Formula</h3>
      <div class="bd-formula-box">
        <p class="bd-formula">${result.formula}</p>
        <p class="bd-formula-description">${result.description}</p>
      </div>
    </section>
    <section class="bd-diagram-section" aria-labelledby="diagram-title">
      <h3 class="bd-diagram-section__title" id="diagram-title">Beam Diagram</h3>
      <div class="bd-diagram-container">
        ${renderBeamDiagram(result)}
      </div>
    </section>`;

    // Trigger fade-in animation
    const resultCards = $("results-container").querySelectorAll(".bd-result");
    resultCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 60}ms`;
        requestAnimationFrame(() => {
            card.classList.add("is-visible");
        });
    });

    $("results-container").querySelectorAll("[data-result-number]").forEach((node) => {
        animateNumber(node, Number(node.dataset.resultNumber), Number(node.dataset.digits));
    });

    renderWarnings(result);
    renderExample(result);
}

function renderBeamDiagram(result) {
    const { beamType, loadType, length, loadMagnitude, loadPosition } = result;
    const svgWidth = 600;
    const svgHeight = 300;
    const margin = 60;
    const beamY = 180;
    const beamLength = svgWidth - 2 * margin;
    const scale = beamLength / length;

    let beamPath = "";
    let supports = "";
    let loadArrows = "";
    let labels = "";

    // Draw beam
    beamPath = `<line x1="${margin}" y1="${beamY}" x2="${margin + beamLength}" y2="${beamY}" stroke="#334155" stroke-width="4" stroke-linecap="round"/>`;

    // Draw supports
    if (beamType === "cantilever") {
        // Fixed support at left
        supports = `
      <rect x="${margin - 5}" y="${beamY - 30}" width="10" height="60" fill="#475569"/>
      <line x1="${margin - 15}" y1="${beamY - 30}" x2="${margin + 15}" y2="${beamY - 30}" stroke="#475569" stroke-width="3"/>
      ${Array.from({ length: 6 }, (_, i) => `<line x1="${margin - 15 + i * 5}" y1="${beamY - 30}" x2="${margin - 10 + i * 5}" y2="${beamY - 20}" stroke="#475569" stroke-width="2"/>`).join("")}
    `;
    } else {
        // Simply supported - triangle at left, circle at right
        supports = `
      <polygon points="${margin},${beamY + 20} ${margin - 15},${beamY + 50} ${margin + 15},${beamY + 50}" fill="#475569"/>
      <circle cx="${margin + beamLength}" cy="${beamY + 20}" r="12" fill="#475569"/>
    `;
    }

    // Draw load arrows
    const arrowY = beamY - 60;
    if (loadType === "point-load") {
        const loadPositionActual = loadPosition ?? length / 2;
        const loadX = margin + loadPositionActual * scale;
        loadArrows = `
      <line x1="${loadX}" y1="${arrowY - 40}" x2="${loadX}" y2="${beamY - 5}" stroke="#ef4444" stroke-width="3" marker-end="url(#arrowhead)"/>
      <text x="${loadX}" y="${arrowY - 50}" text-anchor="middle" fill="#ef4444" font-size="14" font-weight="600">P = ${fmt(loadMagnitude, 2)} N</text>
    `;
    } else if (loadType === "uniform-load") {
        const numArrows = 8;
        const startX = margin + 10;
        const endX = margin + beamLength - 10;
        const step = (endX - startX) / (numArrows - 1);
        loadArrows = Array.from({ length: numArrows }, (_, i) => {
            const x = startX + i * step;
            return `<line x1="${x}" y1="${arrowY - 30}" x2="${x}" y2="${beamY - 5}" stroke="#ef4444" stroke-width="2" marker-end="url(#arrowhead)"/>`;
        }).join("");
        loadArrows += `<text x="${margin + beamLength / 2}" y="${arrowY - 45}" text-anchor="middle" fill="#ef4444" font-size="14" font-weight="600">w = ${fmt(loadMagnitude / length, 2)} N/m</text>`;
    } else if (loadType === "moment") {
        const momentX = margin + beamLength / 2;
        loadArrows = `
      <path d="M ${momentX - 30} ${arrowY - 20} A 30 30 0 0 1 ${momentX + 30} ${arrowY - 20}" fill="none" stroke="#ef4444" stroke-width="3" marker-end="url(#arrowhead)"/>
      <text x="${momentX}" y="${arrowY - 35}" text-anchor="middle" fill="#ef4444" font-size="14" font-weight="600">M = ${fmt(loadMagnitude, 2)} N·m</text>
    `;
    }

    // Labels
    labels = `
    <text x="${margin + beamLength / 2}" y="${beamY + 45}" text-anchor="middle" fill="#64748b" font-size="13">L = ${fmt(length, 3)} m</text>
    <text x="${margin - 25}" y="${beamY + 5}" text-anchor="end" fill="#64748b" font-size="12">${beamType === "cantilever" ? "Fixed" : "Pin"}</text>
    ${beamType === "simply-supported" ? `<text x="${margin + beamLength + 25}" y="${beamY + 5}" text-anchor="start" fill="#64748b" font-size="12">Roller</text>` : ""}
  `;

    return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="bd-diagram-svg">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444"/>
        </marker>
      </defs>
      ${beamPath}
      ${supports}
      ${loadArrows}
      ${labels}
    </svg>
  `;
}

function renderWarnings(result) {
    const notes = [];
    const deflectionMm = result.maxDeflection * 1000;
    const spanRatio = deflectionMm / (result.length * 1000);

    if (spanRatio > 1 / 250) notes.push("Deflection exceeds L/250 limit; verify serviceability requirements.");
    if (spanRatio > 1 / 180) notes.push("Deflection exceeds L/180 limit; consider increasing beam stiffness.");
    if (result.bendingMomentMax > 10000) notes.push("High bending moment; verify section modulus and material yield strength.");
    if (result.shearForceMax > 5000) notes.push("High shear force; check shear stress and web thickness.");
    if (!notes.length) notes.push("Results are within common serviceability limits; verify against project specifications.");

    $("warnings-list").innerHTML = notes.map((note, index) => `<li class="${notes.length === 1 && index === 0 ? "is-ok" : ""}">${note}</li>`).join("");
}

function renderExample(result) {
    const content = {
        "cantilever-point-load": {
            formula: "δ_max = PL³ / (3EI)",
            substitution: `δ_max = (${fmt(result.loadMagnitude)} × ${fmt(result.length)}³) / (3 × ${fmt(result.elasticModulus)}×10⁹ × ${fmt(result.momentInertia)})`,
            calculation: `δ_max = ${fmt(result.maxDeflection * 1000, 6)} m = ${fmt(result.maxDeflection * 1000, 4)} mm`,
            answer: `δ_max = ${fmt(result.maxDeflection * 1000, 4)} mm`,
        },
        "cantilever-uniform-load": {
            formula: "δ_max = wL⁴ / (8EI)",
            substitution: `δ_max = (${fmt(result.loadMagnitude / result.length)} × ${fmt(result.length)}⁴) / (8 × ${fmt(result.elasticModulus)}×10⁹ × ${fmt(result.momentInertia)})`,
            calculation: `δ_max = ${fmt(result.maxDeflection * 1000, 6)} m = ${fmt(result.maxDeflection * 1000, 4)} mm`,
            answer: `δ_max = ${fmt(result.maxDeflection * 1000, 4)} mm`,
        },
        "cantilever-moment": {
            formula: "δ_max = ML² / (2EI)",
            substitution: `δ_max = (${fmt(result.loadMagnitude)} × ${fmt(result.length)}²) / (2 × ${fmt(result.elasticModulus)}×10⁹ × ${fmt(result.momentInertia)})`,
            calculation: `δ_max = ${fmt(result.maxDeflection * 1000, 6)} m = ${fmt(result.maxDeflection * 1000, 4)} mm`,
            answer: `δ_max = ${fmt(result.maxDeflection * 1000, 4)} mm`,
        },
        "simply-supported-point-load": {
            formula: "δ_max = PL³ / (48EI)",
            substitution: `δ_max = (${fmt(result.loadMagnitude)} × ${fmt(result.length)}³) / (48 × ${fmt(result.elasticModulus)}×10⁹ × ${fmt(result.momentInertia)})`,
            calculation: `δ_max = ${fmt(result.maxDeflection * 1000, 6)} m = ${fmt(result.maxDeflection * 1000, 4)} mm`,
            answer: `δ_max = ${fmt(result.maxDeflection * 1000, 4)} mm`,
        },
        "simply-supported-uniform-load": {
            formula: "δ_max = 5wL⁴ / (384EI)",
            substitution: `δ_max = (5 × ${fmt(result.loadMagnitude / result.length)} × ${fmt(result.length)}⁴) / (384 × ${fmt(result.elasticModulus)}×10⁹ × ${fmt(result.momentInertia)})`,
            calculation: `δ_max = ${fmt(result.maxDeflection * 1000, 6)} m = ${fmt(result.maxDeflection * 1000, 4)} mm`,
            answer: `δ_max = ${fmt(result.maxDeflection * 1000, 4)} mm`,
        },
        "simply-supported-moment": {
            formula: "δ_max = ML² / (16EI)",
            substitution: `δ_max = (${fmt(result.loadMagnitude)} × ${fmt(result.length)}²) / (16 × ${fmt(result.elasticModulus)}×10⁹ × ${fmt(result.momentInertia)})`,
            calculation: `δ_max = ${fmt(result.maxDeflection * 1000, 6)} m = ${fmt(result.maxDeflection * 1000, 4)} mm`,
            answer: `δ_max = ${fmt(result.maxDeflection * 1000, 4)} mm`,
        },
    }[`${result.beamType}-${result.loadType}`];

    if (content) {
        $("example-formula").textContent = content.formula;
        $("example-substitution").textContent = content.substitution;
        $("example-calculation").textContent = content.calculation;
        $("example-answer").textContent = content.answer;
    }
}

function run(showMessage = false) {
    const input = values();
    if (!validate(input)) {
        lastResult = null;
        return false;
    }
    const result = calculateDeflection(input);
    if (!Object.values(result).filter((value) => typeof value === "number").every(Number.isFinite)) {
        warning("The selected values produce an invalid result.");
        return false;
    }
    renderResult(result);
    if (showMessage) success("Beam deflection calculated.");
    return true;
}

function copyResults() {
    if (!lastResult) return warning("Calculate results before copying.");
    const text = [
        "Axion Engineering Suite — Beam Deflection",
        `Beam type: ${lastResult.beamType}`,
        `Load type: ${lastResult.loadType}`,
        `Length: ${fmt(lastResult.length)} m`,
        `Max deflection: ${fmt(lastResult.maxDeflection * 1000)} mm`,
        `Deflection at midspan: ${fmt(lastResult.deflectionAtMidspan * 1000)} mm`,
        `Max bending moment: ${fmt(lastResult.bendingMomentMax)} N·m`,
        `Max shear force: ${fmt(lastResult.shearForceMax)} N`,
        `Elastic modulus: ${fmt(lastResult.elasticModulus)} GPa`,
        `Moment of inertia: ${fmt(lastResult.momentInertia)} m⁴`,
    ].join("\n");
    copyToClipboard(text).then(() => success("Results copied to clipboard.")).catch(() => error("Clipboard access is unavailable."));
}

function saveCalculation() {
    if (!lastResult) return warning("Calculate results before saving.");
    addCalculationHistory({ calculatorId: "beam-deflection", calculatorName: "Beam Deflection", inputs: values(), outputs: lastResult });
    recordRecentCalculator({ id: "beam-deflection", label: "Beam Deflection" });
    success("Calculation saved to history.");
}

function toggleFavourite() {
    const calculator = getCalculatorById("beam-deflection");
    const favourites = toggleFavouriteCalculator(calculator);
    const active = favourites.some((item) => item.id === "beam-deflection");
    $("toggle-favourite").textContent = active ? "★ Favourite" : "☆ Favourite";
    $("toggle-favourite").classList.toggle("is-active", active);
    $("toggle-favourite").setAttribute("aria-pressed", String(active));
    success(active ? "Added to favourites." : "Removed from favourites.");
}

function initFavourite() {
    const active = getFavouriteCalculators().some((item) => item.id === "beam-deflection");
    $("toggle-favourite").textContent = active ? "★ Favourite" : "☆ Favourite";
    $("toggle-favourite").classList.toggle("is-active", active);
    $("toggle-favourite").setAttribute("aria-pressed", String(active));
}

function exportCsv() {
    if (!lastResult) return warning("Calculate results before exporting.");
    const rows = [
        ["Parameter", "Value", "Unit"],
        ["Beam Type", lastResult.beamType, ""],
        ["Load Type", lastResult.loadType, ""],
        ["Length", lastResult.length, "m"],
        ["Max Deflection", lastResult.maxDeflection * 1000, "mm"],
        ["Deflection at Midspan", lastResult.deflectionAtMidspan * 1000, "mm"],
        ["Max Bending Moment", lastResult.bendingMomentMax, "N·m"],
        ["Max Shear Force", lastResult.shearForceMax, "N"],
        ["Elastic Modulus", lastResult.elasticModulus, "GPa"],
        ["Moment of Inertia", lastResult.momentInertia, "m⁴"],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    exporter.exportCsv(csv, { filename: "beam-deflection-results.csv" }).then((file) => {
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
    if (!lastResult) return warning("Calculate results before exporting.");
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
            ["Beam Type", lastResult.beamType],
            ["Load Type", lastResult.loadType],
            ["Length", `${lastResult.length} m`],
            ["Load Magnitude", `${lastResult.loadMagnitude} N`],
            ["Elastic Modulus", `${lastResult.elasticModulus} GPa`],
            ["Moment of Inertia", `${lastResult.momentInertia} m⁴`],
        ];
        const results = [
            ["Max Deflection", `${fmt(lastResult.maxDeflection * 1000)} mm`],
            ["Deflection at Midspan", `${fmt(lastResult.deflectionAtMidspan * 1000)} mm`],
            ["Max Bending Moment", `${fmt(lastResult.bendingMomentMax)} N·m`],
            ["Max Shear Force", `${fmt(lastResult.shearForceMax)} N`],
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
            doc.text("Beam Deflection Calculation Report", margin, 63);
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
            ["Beam deflection", "δ = PL³ / (3EI) for cantilever"],
            ["Bending moment", "M = P × L for cantilever"],
            ["Shear force", "V = P for cantilever"],
            ["Note", "Formulas vary by beam type and load condition"],
        ]);
        sectionTitle("Engineering disclaimer");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(77, 92, 108);
        const disclaimer = "Results are provided for engineering estimation. Verify against building codes, material specifications, and professional engineering judgment before design implementation.";
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
        downloadFile(blob, `beam-deflection-report-${generatedAt.toISOString().slice(0, 10)}.pdf`, "application/pdf");
        success("PDF report created.");
    } catch (reason) {
        error(reason.message || "PDF export failed.");
    }
}

function reset() {
    $("beam-deflection-form").reset();
    $("beam-type").value = "cantilever";
    $("load-type").value = "point-load";
    $("beam-length").value = "2";
    $("load-magnitude").value = "1000";
    $("load-position").value = "";
    $("elastic-modulus").value = "200";
    $("moment-inertia").value = "0.0001";
    previousSystem = "metric";
    lastResult = null;
    $("results-container").innerHTML = `
    <div class="results-placeholder">
      <svg class="results-placeholder__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 17H5a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14a2 2 0 0 0 2-2 2 2 0 0 0-2-2h-4M9 17v4M15 17v4M9 17H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4"/>
      </svg>
      <p>Enter beam parameters and click Calculate to see results</p>
    </div>`;
}

export function init() {
    const form = $("beam-deflection-form");
    if (!form) return;
    form.addEventListener("submit", (event) => { event.preventDefault(); run(true); });
    form.addEventListener("input", () => run());
    $("copy-results").addEventListener("click", copyResults);
    $("save-calculation").addEventListener("click", saveCalculation);
    $("toggle-favourite").addEventListener("click", toggleFavourite);
    $("print-results").addEventListener("click", () => window.print());
    $("reset-form").addEventListener("click", reset);
    $("export-csv").addEventListener("click", exportCsv);
    $("export-pdf").addEventListener("click", exportPdf);
    initFavourite();
    reset();
}