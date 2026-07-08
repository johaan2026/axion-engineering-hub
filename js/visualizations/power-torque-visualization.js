const SVG_NS = "http://www.w3.org/2000/svg";

let svgElement = null;
let rafId = null;
let lastTimestamp = 0;
let isActive = false;
let reducedMotionQuery = null;
let groups = {};
let gauges = {};
let particles = [];
let state = {
    rpm: 0,
    angularVelocity: 0,
    torqueNm: 0,
    powerW: 0,
    efficiency: 100,
    visualRpm: 0,
    torqueIntensity: 0,
    powerIntensity: 0,
    rotorAngle: 0,
    drivetrainAngle: 0,
    particleOffset: 0,
    status: "Normal",
};

function createSvgElement(tagName, attributes = {}) {
    const element = document.createElementNS(SVG_NS, tagName);
    Object.entries(attributes).forEach(([name, value]) => {
        element.setAttribute(name, value);
    });
    return element;
}

function ensureGroup(id, className) {
    if (!svgElement) return null;
    let group = svgElement.querySelector(`#${id}`);
    if (!group) {
        group = createSvgElement("g", { id });
        if (className) group.setAttribute("class", className);
        svgElement.appendChild(group);
    }
    return group;
}

function createDefs() {
    const defs = createSvgElement("defs");

    // Motor body gradient - industrial blue-gray
    const motorGradient = createSvgElement("linearGradient", {
        id: "motorBodyGradient",
        x1: "0%", y1: "0%", x2: "100%", y2: "0%"
    });
    motorGradient.innerHTML = `
    <stop offset="0%" stop-color="#1a2f3f" />
    <stop offset="30%" stop-color="#2a4a5a" />
    <stop offset="70%" stop-color="#1e3d4d" />
    <stop offset="100%" stop-color="#0f1f2a" />
  `;
    defs.appendChild(motorGradient);

    // Steel shaft gradient
    const shaftGradient = createSvgElement("linearGradient", {
        id: "shaftGradient",
        x1: "0%", y1: "0%", x2: "0%", y2: "100%"
    });
    shaftGradient.innerHTML = `
    <stop offset="0%" stop-color="#b8c5d0" />
    <stop offset="25%" stop-color="#e8eef3" />
    <stop offset="50%" stop-color="#9aa8b5" />
    <stop offset="75%" stop-color="#d0d8e0" />
    <stop offset="100%" stop-color="#7a8a98" />
  `;
    defs.appendChild(shaftGradient);

    // Flywheel metallic gradient
    const flywheelGradient = createSvgElement("radialGradient", {
        id: "flywheelGradient",
        cx: "35%", cy: "30%", r: "70%"
    });
    flywheelGradient.innerHTML = `
    <stop offset="0%" stop-color="#e8eef3" />
    <stop offset="30%" stop-color="#c5d0d8" />
    <stop offset="60%" stop-color="#8a9aa8" />
    <stop offset="100%" stop-color="#4a5a68" />
  `;
    defs.appendChild(flywheelGradient);

    // Coupling gradient
    const couplingGradient = createSvgElement("linearGradient", {
        id: "couplingGradient",
        x1: "0%", y1: "0%", x2: "100%", y2: "100%"
    });
    couplingGradient.innerHTML = `
    <stop offset="0%" stop-color="#5a6a78" />
    <stop offset="50%" stop-color="#8a9aa8" />
    <stop offset="100%" stop-color="#4a5a68" />
  `;
    defs.appendChild(couplingGradient);

    // Glow filters
    const glowFilter = createSvgElement("filter", { id: "glow", x: "-50%", y: "-50%", width: "200%", height: "200%" });
    glowFilter.innerHTML = `
    <feGaussianBlur stdDeviation="2" result="blur" />
    <feMerge>
      <feMergeNode in="blur" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  `;
    defs.appendChild(glowFilter);

    return defs;
}

function createBasePlate() {
    const basePlate = createSvgElement("g", { id: "base-plate", class: "base-plate" });

    // Main base plate
    const plate = createSvgElement("rect", {
        x: "20", y: "175", width: "580", height: "20", rx: "2",
        fill: "#2a3a48", stroke: "#4a5a68", "stroke-width": "1.5"
    });
    basePlate.appendChild(plate);

    // Mounting holes
    const holes = [
        { x: 40, y: 185 }, { x: 160, y: 185 }, { x: 310, y: 185 },
        { x: 460, y: 185 }, { x: 580, y: 185 }
    ];
    holes.forEach(hole => {
        const circle = createSvgElement("circle", {
            cx: hole.x, cy: hole.y, r: "3",
            fill: "#0f1f2a", stroke: "#6a7a88", "stroke-width": "1"
        });
        basePlate.appendChild(circle);
    });

    // Base plate detail lines
    const detailLine = createSvgElement("line", {
        x1: "30", y1: "180", x2: "590", y2: "180",
        stroke: "#5a6a78", "stroke-width": "0.5"
    });
    basePlate.appendChild(detailLine);

    return basePlate;
}

function createBearings() {
    const bearingsGroup = createSvgElement("g", { id: "bearings", class: "bearings" });

    // Left bearing (motor side)
    const leftBearing = createSvgElement("g", { class: "bearing" });
    leftBearing.innerHTML = `
    <rect x="175" y="115" width="25" height="30" rx="3" fill="#3a4a58" stroke="#6a7a88" stroke-width="1.5" />
    <circle cx="187.5" cy="130" r="10" fill="#2a3a48" stroke="#8a9aa8" stroke-width="1" />
    <circle cx="187.5" cy="130" r="6" fill="#1a2a38" />
    <line x1="180" y1="118" x2="180" y2="142" stroke="#5a6a78" stroke-width="0.5" />
    <line x1="195" y1="118" x2="195" y2="142" stroke="#5a6a78" stroke-width="0.5" />
  `;
    bearingsGroup.appendChild(leftBearing);

    // Right bearing (flywheel side)
    const rightBearing = createSvgElement("g", { class: "bearing" });
    rightBearing.innerHTML = `
    <rect x="490" y="115" width="25" height="30" rx="3" fill="#3a4a58" stroke="#6a7a88" stroke-width="1.5" />
    <circle cx="502.5" cy="130" r="10" fill="#2a3a48" stroke="#8a9aa8" stroke-width="1" />
    <circle cx="502.5" cy="130" r="6" fill="#1a2a38" />
    <line x1="495" y1="118" x2="495" y2="142" stroke="#5a6a78" stroke-width="0.5" />
    <line x1="510" y1="118" x2="510" y2="142" stroke="#5a6a78" stroke-width="0.5" />
  `;
    bearingsGroup.appendChild(rightBearing);

    return bearingsGroup;
}

function createMotor() {
    const motorGroup = createSvgElement("g", { id: "motor", class: "motor" });

    // Motor housing - cylindrical body
    const housing = createSvgElement("rect", {
        x: "40", y: "60", width: "140", height: "100", rx: "8",
        fill: "url(#motorBodyGradient)", stroke: "#5a8aaa", "stroke-width": "2"
    });
    motorGroup.appendChild(housing);

    // Cooling fins
    for (let i = 0; i < 8; i++) {
        const fin = createSvgElement("line", {
            x1: "55", y1: `${70 + i * 11}`, x2: "165", y2: `${70 + i * 11}`,
            stroke: "#4a7a8a", "stroke-width": "1", opacity: "0.6"
        });
        motorGroup.appendChild(fin);
    }

    // Motor end bell (left side)
    const endBell = createSvgElement("circle", {
        cx: "40", cy: "110", r: "35",
        fill: "#2a4a5a", stroke: "#5a8aaa", "stroke-width": "2"
    });
    motorGroup.appendChild(endBell);

    // End bell detail
    const endBellDetail = createSvgElement("circle", {
        cx: "40", cy: "110", r: "25",
        fill: "none", stroke: "#4a7a8a", "stroke-width": "1"
    });
    motorGroup.appendChild(endBellDetail);

    // Terminal box (top)
    const terminalBox = createSvgElement("rect", {
        x: "90", y: "55", width: "40", height: "15", rx: "2",
        fill: "#2a3a48", stroke: "#5a8aaa", "stroke-width": "1.5"
    });
    motorGroup.appendChild(terminalBox);

    // Motor label
    const label = createSvgElement("text", {
        x: "110", y: "175", "text-anchor": "middle",
        fill: "#8aa5ba", "font-size": "10", "font-weight": "600", "letter-spacing": "0.1em"
    });
    label.textContent = "MOTOR";
    motorGroup.appendChild(label);

    return motorGroup;
}

function createRotor() {
    const rotorGroup = createSvgElement("g", { id: "rotor", class: "rotor" });

    // Rotor core
    const core = createSvgElement("circle", {
        cx: "40", cy: "110", r: "22",
        fill: "#1a2a38", stroke: "#38c7ff", "stroke-width": "2.5"
    });
    rotorGroup.appendChild(core);

    // Rotor laminations
    const lamination = createSvgElement("circle", {
        cx: "40", cy: "110", r: "18",
        fill: "none", stroke: "#2a4a5a", "stroke-width": "0.5"
    });
    rotorGroup.appendChild(lamination);

    // Rotor shaft extension
    const shaftExt = createSvgElement("rect", {
        x: "40", y: "106", width: "30", height: "8", rx: "1",
        fill: "url(#shaftGradient)", stroke: "#7a8a98", "stroke-width": "1"
    });
    rotorGroup.appendChild(shaftExt);

    // Rotor bars
    for (let i = 0; i < 6; i++) {
        const angle = (i * 60) * Math.PI / 180;
        const x1 = 40 + Math.cos(angle) * 8;
        const y1 = 110 + Math.sin(angle) * 8;
        const x2 = 40 + Math.cos(angle) * 16;
        const y2 = 110 + Math.sin(angle) * 16;
        const bar = createSvgElement("line", {
            x1, y1, x2, y2,
            stroke: "#c5d0d8", "stroke-width": "2"
        });
        rotorGroup.appendChild(bar);
    }

    // Center hub
    const hub = createSvgElement("circle", {
        cx: "40", cy: "110", r: "5",
        fill: "#4a5a68", stroke: "#8a9aa8", "stroke-width": "1"
    });
    rotorGroup.appendChild(hub);

    return rotorGroup;
}

function createShaft() {
    const shaftGroup = createSvgElement("g", { id: "shaft", class: "shaft" });

    // Main shaft
    const shaft = createSvgElement("rect", {
        x: "65", y: "122", width: "440", height: "16", rx: "8",
        fill: "url(#shaftGradient)", stroke: "#6a7a88", "stroke-width": "1.5"
    });
    shaftGroup.appendChild(shaft);

    // Shaft keyway
    const keyway = createSvgElement("rect", {
        x: "280", y: "126", width: "30", height: "8", rx: "1",
        fill: "#1a2a38", stroke: "#5a6a78", "stroke-width": "1"
    });
    shaftGroup.appendChild(keyway);

    // Shaft highlight
    const highlight = createSvgElement("line", {
        x1: "70", y1: "124", x2: "500", y2: "124",
        stroke: "#ffffff", "stroke-width": "1", opacity: "0.3"
    });
    shaftGroup.appendChild(highlight);

    return shaftGroup;
}

function createCoupling() {
    const couplingGroup = createSvgElement("g", { id: "coupling", class: "coupling" });

    // Jaw coupling - left hub
    const leftHub = createSvgElement("rect", {
        x: "200", y: "108", width: "35", height: "44", rx: "4",
        fill: "url(#couplingGradient)", stroke: "#7a9aa8", "stroke-width": "2"
    });
    couplingGroup.appendChild(leftHub);

    // Jaw coupling - right hub
    const rightHub = createSvgElement("rect", {
        x: "260", y: "108", width: "35", height: "44", rx: "4",
        fill: "url(#couplingGradient)", stroke: "#7a9aa8", "stroke-width": "2"
    });
    couplingGroup.appendChild(rightHub);

    // Spider element (center)
    const spider = createSvgElement("rect", {
        x: "235", y: "115", width: "25", height: "30", rx: "3",
        fill: "#3a4a58", stroke: "#6a8a98", "stroke-width": "1.5"
    });
    couplingGroup.appendChild(spider);

    // Jaw teeth
    for (let i = 0; i < 4; i++) {
        const tooth = createSvgElement("rect", {
            x: `${207 + i * 8}`, y: "112", width: "4", height: "6", rx: "1",
            fill: "#5a7a88", stroke: "#8a9aa8", "stroke-width": "0.5"
        });
        couplingGroup.appendChild(tooth);

        const tooth2 = createSvgElement("rect", {
            x: `${267 + i * 8}`, y: "112", width: "4", height: "6", rx: "1",
            fill: "#5a7a88", stroke: "#8a9aa8", "stroke-width": "0.5"
        });
        couplingGroup.appendChild(tooth2);
    }

    // Coupling label
    const label = createSvgElement("text", {
        x: "247", y: "165", "text-anchor": "middle",
        fill: "#8aa5ba", "font-size": "9", "font-weight": "600", "letter-spacing": "0.08em"
    });
    label.textContent = "COUPLING";
    couplingGroup.appendChild(label);

    return couplingGroup;
}

function createFlywheel() {
    const flywheelGroup = createSvgElement("g", { id: "flywheel", class: "flywheel" });

    // Flywheel outer rim
    const rim = createSvgElement("circle", {
        cx: "530", cy: "130", r: "35",
        fill: "url(#flywheelGradient)", stroke: "#7a9aa8", "stroke-width": "3"
    });
    flywheelGroup.appendChild(rim);

    // Rim thickness indicator
    const rimInner = createSvgElement("circle", {
        cx: "530", cy: "130", r: "28",
        fill: "none", stroke: "#5a7a88", "stroke-width": "1"
    });
    flywheelGroup.appendChild(rimInner);

    // Flywheel hub
    const hub = createSvgElement("circle", {
        cx: "530", cy: "130", r: "15",
        fill: "#3a4a58", stroke: "#8a9aa8", "stroke-width": "2"
    });
    flywheelGroup.appendChild(hub);

    // Hub center
    const hubCenter = createSvgElement("circle", {
        cx: "530", cy: "130", r: "6",
        fill: "#2a3a48", stroke: "#6a7a88", "stroke-width": "1"
    });
    flywheelGroup.appendChild(hubCenter);

    // Flywheel spokes
    for (let i = 0; i < 6; i++) {
        const angle = (i * 60) * Math.PI / 180;
        const x1 = 530 + Math.cos(angle) * 15;
        const y1 = 130 + Math.sin(angle) * 15;
        const x2 = 530 + Math.cos(angle) * 28;
        const y2 = 130 + Math.sin(angle) * 28;
        const spoke = createSvgElement("line", {
            x1, y1, x2, y2,
            stroke: "#8a9aa8", "stroke-width": "2"
        });
        flywheelGroup.appendChild(spoke);
    }

    // Flywheel detail ring
    const detailRing = createSvgElement("circle", {
        cx: "530", cy: "130", r: "32",
        fill: "none", stroke: "#5a7a88", "stroke-width": "0.5", "stroke-dasharray": "2 2"
    });
    flywheelGroup.appendChild(detailRing);

    // Flywheel label
    const label = createSvgElement("text", {
        x: "530", y: "175", "text-anchor": "middle",
        fill: "#8aa5ba", "font-size": "10", "font-weight": "600", "letter-spacing": "0.1em"
    });
    label.textContent = "FLYWHEEL";
    flywheelGroup.appendChild(label);

    return flywheelGroup;
}

function createGauges() {
    const gaugesGroup = createSvgElement("g", { id: "gauges", class: "gauges" });

    // RPM Gauge
    const rpmGauge = createSvgElement("g", { id: "rpm-gauge", class: "gauge" });

    // Gauge background
    const rpmBg = createSvgElement("circle", {
        cx: "90", cy: "130", r: "40",
        fill: "rgba(10, 20, 30, 0.9)", stroke: "#4a6a7a", "stroke-width": "2"
    });
    rpmGauge.appendChild(rpmBg);

    // Gauge arc
    const rpmArc = createSvgElement("path", {
        d: "M 55 130 A 35 35 0 0 1 125 130",
        fill: "none", stroke: "#3a5a6a", "stroke-width": "3", "stroke-linecap": "round"
    });
    rpmGauge.appendChild(rpmArc);

    // Gauge tick marks
    for (let i = 0; i <= 6; i++) {
        const angle = -180 + (i * 30);
        const rad = angle * Math.PI / 180;
        const x1 = 90 + Math.cos(rad) * 28;
        const y1 = 130 + Math.sin(rad) * 28;
        const x2 = 90 + Math.cos(rad) * 32;
        const y2 = 130 + Math.sin(rad) * 32;
        const tick = createSvgElement("line", {
            x1, y1, x2, y2,
            stroke: "#8aa5ba", "stroke-width": "1.5"
        });
        rpmGauge.appendChild(tick);
    }

    // RPM needle
    const rpmNeedle = createSvgElement("line", {
        x1: "90", y1: "130", x2: "90", y2: "102",
        stroke: "#ffca28", "stroke-width": "2.5", "stroke-linecap": "round",
        class: "gauge-needle", id: "rpm-needle"
    });
    rpmGauge.appendChild(rpmNeedle);

    // Needle center
    const rpmCenter = createSvgElement("circle", {
        cx: "90", cy: "130", r: "4",
        fill: "#ffca28", stroke: "#ffffff", "stroke-width": "1"
    });
    rpmGauge.appendChild(rpmCenter);

    // RPM label
    const rpmLabel = createSvgElement("text", {
        x: "90", y: "150", "text-anchor": "middle",
        fill: "#8aa5ba", "font-size": "9", "font-weight": "600"
    });
    rpmLabel.textContent = "RPM";
    rpmGauge.appendChild(rpmLabel);

    // RPM value
    const rpmValue = createSvgElement("text", {
        x: "90", y: "162", "text-anchor": "middle",
        fill: "#ffffff", "font-size": "11", "font-weight": "700", id: "rpm-value"
    });
    rpmValue.textContent = "0";
    rpmGauge.appendChild(rpmValue);

    gaugesGroup.appendChild(rpmGauge);

    // Torque Gauge
    const torqueGauge = createSvgElement("g", { id: "torque-gauge", class: "gauge" });

    const torqueBg = createSvgElement("circle", {
        cx: "530", cy: "60", r: "35",
        fill: "rgba(10, 20, 30, 0.9)", stroke: "#4a6a7a", "stroke-width": "2"
    });
    torqueGauge.appendChild(torqueBg);

    const torqueArc = createSvgElement("path", {
        d: "M 498 60 A 32 32 0 0 1 562 60",
        fill: "none", stroke: "#3a5a6a", "stroke-width": "3", "stroke-linecap": "round"
    });
    torqueGauge.appendChild(torqueArc);

    // Torque tick marks
    for (let i = 0; i <= 6; i++) {
        const angle = -180 + (i * 30);
        const rad = angle * Math.PI / 180;
        const x1 = 530 + Math.cos(rad) * 25;
        const y1 = 60 + Math.sin(rad) * 25;
        const x2 = 530 + Math.cos(rad) * 29;
        const y2 = 60 + Math.sin(rad) * 29;
        const tick = createSvgElement("line", {
            x1, y1, x2, y2,
            stroke: "#8aa5ba", "stroke-width": "1.5"
        });
        torqueGauge.appendChild(tick);
    }

    // Torque needle
    const torqueNeedle = createSvgElement("line", {
        x1: "530", y1: "60", x2: "530", y2: "35",
        stroke: "#ffca28", "stroke-width": "2.5", "stroke-linecap": "round",
        class: "gauge-needle", id: "torque-needle"
    });
    torqueGauge.appendChild(torqueNeedle);

    const torqueCenter = createSvgElement("circle", {
        cx: "530", cy: "60", r: "4",
        fill: "#ffca28", stroke: "#ffffff", "stroke-width": "1"
    });
    torqueGauge.appendChild(torqueCenter);

    const torqueLabel = createSvgElement("text", {
        x: "530", y: "78", "text-anchor": "middle",
        fill: "#8aa5ba", "font-size": "8", "font-weight": "600"
    });
    torqueLabel.textContent = "TORQUE";
    torqueGauge.appendChild(torqueLabel);

    const torqueValue = createSvgElement("text", {
        x: "530", y: "90", "text-anchor": "middle",
        fill: "#ffffff", "font-size": "10", "font-weight": "700", id: "torque-value"
    });
    torqueValue.textContent = "0";
    torqueGauge.appendChild(torqueValue);

    gaugesGroup.appendChild(torqueGauge);

    return gaugesGroup;
}

function createPowerFlowArrows() {
    const arrowsGroup = createSvgElement("g", { id: "power-flow", class: "power-flow" });

    // Arrow from motor to coupling
    const arrow1 = createSvgElement("path", {
        d: "M 165 95 L 195 95",
        fill: "none", stroke: "#4ade80", "stroke-width": "2.5",
        "stroke-dasharray": "6 3", "marker-end": "url(#arrowhead)"
    });
    arrowsGroup.appendChild(arrow1);

    // Arrow from coupling to flywheel
    const arrow2 = createSvgElement("path", {
        d: "M 300 95 L 490 95",
        fill: "none", stroke: "#4ade80", "stroke-width": "2.5",
        "stroke-dasharray": "6 3", "marker-end": "url(#arrowhead)"
    });
    arrowsGroup.appendChild(arrow2);

    // Power flow label
    const label = createSvgElement("text", {
        x: "330", y: "90", "text-anchor": "middle",
        fill: "#4ade80", "font-size": "9", "font-weight": "600", "letter-spacing": "0.1em"
    });
    label.textContent = "POWER FLOW →";
    arrowsGroup.appendChild(label);

    return arrowsGroup;
}

function createArrowMarker() {
    const marker = createSvgElement("marker", {
        id: "arrowhead", markerWidth: "10", markerHeight: "7",
        refX: "9", refY: "3.5", orient: "auto"
    });
    const polygon = createSvgElement("polygon", {
        points: "0 0, 10 3.5, 0 7",
        fill: "#4ade80"
    });
    marker.appendChild(polygon);
    return marker;
}

function buildVisualization() {
    if (!svgElement) return;

    // Clear existing content
    svgElement.innerHTML = "";

    // Set viewBox
    svgElement.setAttribute("viewBox", "0 0 620 210");
    svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");

    // Add title and description
    const title = createSvgElement("title", { id: "machine-title" });
    title.textContent = "Motor drivetrain visualization";
    svgElement.appendChild(title);

    const desc = createSvgElement("desc", { id: "machine-description" });
    desc.textContent = "An electric motor drives a mechanical load through a flexible coupling and rotating shaft.";
    svgElement.appendChild(desc);

    // Add defs
    const defs = createDefs();
    defs.appendChild(createArrowMarker());
    svgElement.appendChild(defs);

    // Create component groups
    groups.basePlate = ensureGroup("base-plate", "base-plate");
    groups.bearings = ensureGroup("bearings", "bearings");
    groups.motor = ensureGroup("motor", "motor");
    groups.rotor = ensureGroup("rotor", "rotor");
    groups.shaft = ensureGroup("shaft", "shaft");
    groups.coupling = ensureGroup("coupling", "coupling");
    groups.flywheel = ensureGroup("flywheel", "flywheel");
    groups.gauges = ensureGroup("gauges", "gauges");
    groups.powerFlow = ensureGroup("power-flow", "power-flow");

    // Build components
    if (groups.basePlate) groups.basePlate.appendChild(createBasePlate());
    if (groups.bearings) groups.bearings.appendChild(createBearings());
    if (groups.motor) groups.motor.appendChild(createMotor());
    if (groups.rotor) groups.rotor.appendChild(createRotor());
    if (groups.shaft) groups.shaft.appendChild(createShaft());
    if (groups.coupling) groups.coupling.appendChild(createCoupling());
    if (groups.flywheel) groups.flywheel.appendChild(createFlywheel());
    if (groups.gauges) groups.gauges.appendChild(createGauges());
    if (groups.powerFlow) groups.powerFlow.appendChild(createPowerFlowArrows());
}

function getOrigin(groupId) {
    switch (groupId) {
        case "rotor":
            return { x: 40, y: 110 };
        case "shaft":
            return { x: 285, y: 130 };
        case "coupling":
            return { x: 247, y: 130 };
        case "flywheel":
            return { x: 530, y: 130 };
        default:
            return { x: 0, y: 0 };
    }
}

function mapVisualRpm(actualRpm) {
    if (!Number.isFinite(actualRpm) || actualRpm <= 0) return 0;
    return Math.min(240, Math.sqrt(actualRpm) * 5);
}

function computeTorqueIntensity(torqueNm) {
    if (!Number.isFinite(torqueNm) || torqueNm <= 0) return 0;
    return Math.min(1, Math.log10(1 + torqueNm) / 4);
}

function computePowerIntensity(powerW) {
    if (!Number.isFinite(powerW) || powerW <= 0) return 0;
    return Math.min(1, Math.log10(1 + powerW / 100) / 3);
}

function deriveStatus(rpm, torqueNm) {
    if (!Number.isFinite(rpm) || rpm <= 0) return { label: "Stopped", tone: "green" };
    if (rpm > 6000 || torqueNm > 8000) return { label: "Overload", tone: "red" };
    if (torqueNm > 4000) return { label: "High Torque", tone: "orange" };
    if (rpm > 3000) return { label: "High Speed", tone: "yellow" };
    return { label: "Normal", tone: "green" };
}

function updateGauge(gaugeId, value, maxValue, unit) {
    const needle = document.getElementById(gaugeId);
    const valueText = document.getElementById(gaugeId.replace("-needle", "-value"));
    if (!needle) return;

    const safeValue = Math.max(0, Math.min(maxValue, value));
    const ratio = maxValue > 0 ? safeValue / maxValue : 0;
    const angle = -180 + ratio * 180;

    const origin = gaugeId === "rpm-needle" ? { x: 90, y: 130 } : { x: 530, y: 60 };
    needle.setAttribute("transform", `rotate(${angle} ${origin.x} ${origin.y})`);

    if (valueText) {
        valueText.textContent = Math.round(safeValue);
    }
}

function updateParticleStream() {
    // Particle stream implementation if needed
}

function renderFrame(timestamp) {
    if (!svgElement) return;
    if (document.hidden || (reducedMotionQuery && reducedMotionQuery.matches)) {
        rafId = null;
        return;
    }

    if (!lastTimestamp) {
        lastTimestamp = timestamp;
    }
    const deltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
    lastTimestamp = timestamp;

    const angularVelocity = state.visualRpm * 6;
    state.rotorAngle = (state.rotorAngle + angularVelocity * deltaSeconds) % 360;
    state.drivetrainAngle = (state.drivetrainAngle + angularVelocity * deltaSeconds) % 360;

    // Rotate rotor
    const rotorOrigin = getOrigin("rotor");
    if (groups.rotor) {
        groups.rotor.setAttribute("transform", `rotate(${state.rotorAngle} ${rotorOrigin.x} ${rotorOrigin.y})`);
    }

    // Rotate drivetrain (shaft, coupling, flywheel)
    const drivetrainOrigin = getOrigin("shaft");
    if (groups.shaft) {
        groups.shaft.setAttribute("transform", `rotate(${state.drivetrainAngle} ${drivetrainOrigin.x} ${drivetrainOrigin.y})`);
    }
    if (groups.coupling) {
        const couplingOrigin = getOrigin("coupling");
        groups.coupling.setAttribute("transform", `rotate(${state.drivetrainAngle} ${couplingOrigin.x} ${couplingOrigin.y})`);
    }
    if (groups.flywheel) {
        const flywheelOrigin = getOrigin("flywheel");
        groups.flywheel.setAttribute("transform", `rotate(${state.drivetrainAngle} ${flywheelOrigin.x} ${flywheelOrigin.y})`);
    }

    // Update gauges
    updateGauge("rpm-needle", state.rpm, 6000, "rpm");
    updateGauge("torque-needle", state.torqueNm, 10000, "N·m");

    rafId = window.requestAnimationFrame(renderFrame);
}

function syncState(data) {
    if (!data) {
        state = {
            ...state,
            rpm: 0,
            angularVelocity: 0,
            torqueNm: 0,
            powerW: 0,
            efficiency: 100,
            visualRpm: 0,
            torqueIntensity: 0,
            powerIntensity: 0,
            status: "Stopped",
        };
        return;
    }

    state.rpm = Number(data.rpm) || 0;
    state.angularVelocity = Number(data.angularVelocity) || 0;
    state.torqueNm = Number(data.torqueNm) || 0;
    state.powerW = Number(data.powerW) || 0;
    state.efficiency = Number(data.efficiency) || 100;
    state.visualRpm = mapVisualRpm(state.rpm);
    state.torqueIntensity = computeTorqueIntensity(state.torqueNm);
    state.powerIntensity = computePowerIntensity(state.powerW);
    state.status = deriveStatus(state.rpm, state.torqueNm).label;
}

function updateStatusText(data) {
    if (!data) {
        const status = document.getElementById("stat-status");
        if (status) status.textContent = "Stopped";
        return;
    }
    const status = document.getElementById("stat-status");
    if (status) status.textContent = state.status;
    const angular = document.getElementById("stat-angular");
    if (angular) angular.textContent = `${Number(data.angularVelocity || 0).toFixed(2)} rad/s`;
    const rpm = document.getElementById("stat-rpm");
    if (rpm) rpm.textContent = `${Number(data.rpm || 0).toFixed(0)} rpm`;
    const torque = document.getElementById("stat-torque");
    if (torque) torque.textContent = `${Number(data.displayTorque || 0).toFixed(2)} ${data.torqueUnit || "N·m"}`;
    const power = document.getElementById("stat-power");
    if (power) power.textContent = `${Number(data.displayPower || 0).toFixed(2)} ${data.powerUnit || "kW"}`;
    const efficiency = document.getElementById("stat-efficiency");
    if (efficiency) efficiency.textContent = `${Number(data.efficiency || 0).toFixed(2)}%`;
}

function startLoop() {
    if (rafId || !svgElement) return;
    if (reducedMotionQuery?.matches || document.hidden) {
        renderFrame(0);
        return;
    }
    isActive = true;
    lastTimestamp = 0;
    rafId = window.requestAnimationFrame(renderFrame);
}

function stopLoop() {
    if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
    }
    isActive = false;
}

function bindLifecycle() {
    if (svgElement?.dataset.visualized === "true") return;
    svgElement.dataset.visualized = "true";
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleVisibility = () => {
        if (document.hidden || reducedMotionQuery.matches) {
            stopLoop();
        } else if (svgElement) {
            startLoop();
        }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotionQuery.addEventListener?.("change", handleVisibility);
    window.addEventListener("pagehide", destroyPowerVisualization);
}

export function initPowerVisualization(svg) {
    if (!svg || !(svg instanceof SVGElement)) {
        return null;
    }
    svgElement = svg;
    buildVisualization();
    bindLifecycle();
    if (!isActive) {
        startLoop();
    }
    return svgElement;
}

export function updatePowerVisualization(data) {
    if (!svgElement) {
        return;
    }
    syncState(data);
    updateStatusText(data);
    if (groups.rotor || groups.shaft || groups.coupling || groups.flywheel) {
        startLoop();
    }
}

export function destroyPowerVisualization() {
    stopLoop();
    if (svgElement) {
        svgElement.removeAttribute("data-visualized");
    }
    svgElement = null;
    groups = {};
    gauges = {};
    particles = [];
    state = {
        rpm: 0,
        angularVelocity: 0,
        torqueNm: 0,
        powerW: 0,
        efficiency: 100,
        visualRpm: 0,
        torqueIntensity: 0,
        powerIntensity: 0,
        rotorAngle: 0,
        drivetrainAngle: 0,
        particleOffset: 0,
        status: "Stopped",
    };
}