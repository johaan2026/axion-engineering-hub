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

function ensureTopLevelGroup(id, className) {
  if (!svgElement) return null;
  let group = svgElement.querySelector(`#${id}`);
  if (!group) {
    group = createSvgElement("g", { id });
    if (className) {
      group.setAttribute("class", className);
    }
    svgElement.appendChild(group);
  }
  return group;
}

function ensureChildGroup(parent, id, className) {
  if (!parent) return null;
  let group = parent.querySelector(`#${id}`);
  if (!group) {
    group = createSvgElement("g", { id });
    if (className) {
      group.setAttribute("class", className);
    }
    parent.appendChild(group);
  }
  return group;
}

function attachElementToTarget(element, target) {
  if (!element || !target || element === target) return;
  if (element.parentNode) {
    element.parentNode.removeChild(element);
  }
  target.appendChild(element);
}

function createGauge(group, label, valueLabel, x, y) {
  const ring = createSvgElement("circle", {
    cx: x,
    cy: y,
    r: 42,
    class: "pt-gauge__ring",
  });
  const core = createSvgElement("circle", {
    cx: x,
    cy: y,
    r: 30,
    class: "pt-gauge__core",
  });
  const needle = createSvgElement("line", {
    x1: x,
    y1: y,
    x2: x,
    y2: y - 28,
    class: "pt-gauge__needle",
  });
  const needleBase = createSvgElement("line", {
    x1: x,
    y1: y,
    x2: x,
    y2: y - 32,
    class: "pt-gauge__needle pt-gauge__needle--base",
  });
  const title = createSvgElement("text", {
    x,
    y: y + 60,
    "text-anchor": "middle",
    class: "pt-gauge__title",
  });
  title.textContent = label;
  const value = createSvgElement("text", {
    x,
    y: y + 80,
    "text-anchor": "middle",
    class: "pt-gauge__value",
  });
  value.textContent = valueLabel;
  group.append(ring, core, needleBase, needle, title, value);
  return { ring, core, needle, needleBase, title, value };
}

function buildStructure() {
  if (!svgElement) return;

  const motorBodyGroup = ensureTopLevelGroup("motor-body", "pt-motor");
  const legacyMotor = svgElement.querySelector(".pt-motor");
  if (legacyMotor && legacyMotor !== motorBodyGroup) {
    legacyMotor.setAttribute("id", "motor-body");
    legacyMotor.setAttribute("class", "pt-motor");
    attachElementToTarget(legacyMotor, motorBodyGroup);
  }

  const legacyRotor = svgElement.querySelector("#pt-motor-rotor, .pt-motor-rotor");
  const motorRotorGroup = ensureTopLevelGroup("motor-rotor", "pt-motor-rotor");
  if (legacyRotor && legacyRotor.parentNode && legacyRotor !== motorRotorGroup) {
    legacyRotor.setAttribute("id", "motor-rotor");
    legacyRotor.classList.add("pt-motor-rotor");
    attachElementToTarget(legacyRotor, motorRotorGroup);
  }
  if (motorRotorGroup && !motorRotorGroup.hasAttribute("class")) {
    motorRotorGroup.setAttribute("class", "pt-motor-rotor");
  }
  groups.motorRotor = motorRotorGroup;

  const drivetrainGroup = ensureTopLevelGroup("drivetrain", "pt-drivetrain");
  const legacyDrivetrain = svgElement.querySelector("#pt-drivetrain, .pt-drivetrain");
  if (legacyDrivetrain && legacyDrivetrain !== drivetrainGroup) {
    legacyDrivetrain.setAttribute("id", "drivetrain");
    legacyDrivetrain.setAttribute("class", "pt-drivetrain");
    attachElementToTarget(legacyDrivetrain, drivetrainGroup);
  }
  if (drivetrainGroup && !drivetrainGroup.hasAttribute("class")) {
    drivetrainGroup.setAttribute("class", "pt-drivetrain");
  }
  groups.drivetrain = drivetrainGroup;

  groups.shaft = ensureChildGroup(drivetrainGroup, "shaft", "pt-shaft");
  groups.coupling = ensureChildGroup(drivetrainGroup, "coupling", "pt-coupling");
  groups.flywheel = ensureChildGroup(drivetrainGroup, "flywheel", "pt-flywheel");

  const shaftBody = svgElement.querySelector("#pt-shaft-body");
  const shaftHighlight = svgElement.querySelector(".pt-shaft-highlight");
  const shaftKeyway = svgElement.querySelector(".pt-shaft-keyway");
  if (shaftBody && groups.shaft) attachElementToTarget(shaftBody, groups.shaft);
  if (shaftHighlight && groups.shaft) attachElementToTarget(shaftHighlight, groups.shaft);
  if (shaftKeyway && groups.shaft) attachElementToTarget(shaftKeyway, groups.shaft);

  const couplingNode = svgElement.querySelector(".pt-coupling");
  if (couplingNode && groups.coupling) attachElementToTarget(couplingNode, groups.coupling);

  const flywheelNode = svgElement.querySelector(".pt-load");
  if (flywheelNode && groups.flywheel) attachElementToTarget(flywheelNode, groups.flywheel);

  groups.powerFlow = ensureTopLevelGroup("power-flow", "pt-power-particles");
  groups.powerFlow.setAttribute("aria-hidden", "true");
  if (groups.powerFlow.childNodes.length === 0) {
    for (let index = 0; index < 10; index += 1) {
      const particle = createSvgElement("circle", {
        cx: 185,
        cy: 126,
        r: 1.75,
        fill: "#67d8ff",
      });
      particle.style.filter = "drop-shadow(0 0 4px rgba(56, 199, 255, 0.9))";
      groups.powerFlow.appendChild(particle);
      particles.push(particle);
    }
  }

  groups.rpmGauge = ensureTopLevelGroup("rpm-gauge", "pt-gauge pt-gauge--rpm");
  groups.torqueGauge = ensureTopLevelGroup("torque-gauge", "pt-gauge pt-gauge--torque");
  groups.rpmGauge.innerHTML = "";
  groups.torqueGauge.innerHTML = "";
  gauges.rpm = createGauge(groups.rpmGauge, "RPM", "0 rpm", 108, 170);
  gauges.torque = createGauge(groups.torqueGauge, "Torque", "0 N·m", 108, 170);

  const legacyPowerFlow = svgElement.querySelector("#pt-power-flow");
  if (legacyPowerFlow && legacyPowerFlow !== groups.powerFlow) {
    attachElementToTarget(legacyPowerFlow, groups.powerFlow);
  }

  const legacyArrow = svgElement.querySelector("#pt-torque-arrow");
  if (legacyArrow && drivetrainGroup && legacyArrow.parentNode !== drivetrainGroup) {
    drivetrainGroup.appendChild(legacyArrow);
  }

  if (motorBodyGroup) {
    motorBodyGroup.setAttribute("data-role", "motor-body");
  }
  if (drivetrainGroup) {
    drivetrainGroup.setAttribute("data-role", "drivetrain");
  }
}

function getOrigin(groupId) {
  switch (groupId) {
    case "motor-rotor":
      return { x: 192, y: 130 };
    case "drivetrain":
      return { x: 344, y: 130 };
    default:
      return { x: 0, y: 0 };
  }
}

function mapVisualRpm(actualRpm) {
  if (!Number.isFinite(actualRpm) || actualRpm <= 0) {
    return 0;
  }
  return Math.min(240, Math.sqrt(actualRpm) * 5);
}

function computeTorqueIntensity(torqueNm) {
  if (!Number.isFinite(torqueNm) || torqueNm <= 0) {
    return 0;
  }
  return Math.min(1, Math.log10(1 + torqueNm) / 4);
}

function computePowerIntensity(powerW) {
  if (!Number.isFinite(powerW) || powerW <= 0) {
    return 0;
  }
  return Math.min(1, Math.log10(1 + powerW / 100) / 3);
}

function deriveStatus(rpm, torqueNm) {
  if (!Number.isFinite(rpm) || rpm <= 0) {
    return { label: "Stopped", tone: "green" };
  }
  if (rpm > 6000 || torqueNm > 8000) {
    return { label: "Overload", tone: "red" };
  }
  if (torqueNm > 4000) {
    return { label: "High Torque", tone: "orange" };
  }
  if (rpm > 3000) {
    return { label: "High Speed", tone: "yellow" };
  }
  return { label: "Normal", tone: "green" };
}

function formatGaugeValue(value, suffix) {
  if (!Number.isFinite(value)) {
    return `0 ${suffix}`;
  }
  const compact = value >= 1000 ? value.toLocaleString("en-US", { maximumFractionDigits: 0 }) : value.toFixed(value >= 100 ? 0 : 1);
  return `${compact} ${suffix}`;
}

function updateGauge(gauge, value, maxValue, unitLabel, label) {
  if (!gauge || !gauge.needle) return;
  const safeValue = Math.max(0, Math.min(maxValue, value));
  const ratio = maxValue > 0 ? safeValue / maxValue : 0;
  const angle = -120 + ratio * 240;
  gauge.needle.setAttribute("transform", `rotate(${angle} ${gauge.needle.getAttribute("x1")} ${gauge.needle.getAttribute("y1")})`);
  gauge.title.textContent = label;
  gauge.value.textContent = formatGaugeValue(value, unitLabel);
}

function updateVisualStyles() {
  const torqueArrow = svgElement?.querySelector("#pt-torque-arrow");
  const powerFlowPath = svgElement?.querySelector("#pt-power-flow");
  const shaftBody = svgElement?.querySelector("#pt-shaft-body");
  const loadRim = svgElement?.querySelector("#pt-load-rim");
  const loadHub = svgElement?.querySelector("#pt-load-hub");

  if (torqueArrow) {
    torqueArrow.setAttribute("stroke-width", String(2.5 + state.torqueIntensity * 4.5));
    torqueArrow.setAttribute("opacity", String(0.6 + state.torqueIntensity * 0.35));
  }

  if (powerFlowPath) {
    powerFlowPath.setAttribute("stroke-width", String(2 + state.powerIntensity * 4));
    powerFlowPath.setAttribute("opacity", String(0.45 + state.powerIntensity * 0.45));
    powerFlowPath.setAttribute("stroke", state.powerIntensity > 0.6 ? "#7fe7ff" : "#4ade80");
  }

  if (shaftBody) {
    shaftBody.style.filter = state.torqueIntensity > 0.15 ? "url(#shaftGlow)" : "none";
    shaftBody.setAttribute("opacity", String(0.84 + state.torqueIntensity * 0.16));
  }

  if (loadRim) {
    loadRim.setAttribute("stroke-width", String(2.5 + state.torqueIntensity * 3.5));
    loadRim.style.filter = state.torqueIntensity > 0.3 ? "url(#machineGlow)" : "none";
  }

  if (loadHub) {
    loadHub.style.filter = state.torqueIntensity > 0.35 ? "url(#shaftGlow)" : "none";
    loadHub.setAttribute("opacity", String(0.8 + state.torqueIntensity * 0.2));
  }
}

function updateParticleStream() {
  if (!groups.powerFlow || !particles.length) return;
  const activeParticles = Math.max(2, Math.round(2 + state.powerIntensity * 8));
  const flowStart = 185;
  const flowEnd = 500;
  const travelDistance = flowEnd - flowStart;
  const phase = (state.particleOffset + (0.16 + state.powerIntensity * 0.3)) % 1;
  state.particleOffset = phase;

  particles.forEach((particle, index) => {
    const visible = index < activeParticles;
    const particlePhase = (phase + index / particles.length * 0.24) % 1;
    const x = flowStart + particlePhase * travelDistance;
    const y = 126 + Math.sin((particlePhase + index / activeParticles) * Math.PI * 2) * 2.2;
    particle.setAttribute("cx", String(x));
    particle.setAttribute("cy", String(y));
    particle.setAttribute("r", String(visible ? 1.1 + state.powerIntensity * 1.4 : 0));
    particle.setAttribute("opacity", String(visible ? 0.25 + state.powerIntensity * 0.7 : 0));
  });
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

  const rotorOrigin = getOrigin("motor-rotor");
  const drivetrainOrigin = getOrigin("drivetrain");
  if (groups.motorRotor) {
    groups.motorRotor.setAttribute("transform", `rotate(${state.rotorAngle} ${rotorOrigin.x} ${rotorOrigin.y})`);
  }
  if (groups.drivetrain) {
    groups.drivetrain.setAttribute("transform", `rotate(${state.drivetrainAngle} ${drivetrainOrigin.x} ${drivetrainOrigin.y})`);
  }

  updateParticleStream();
  updateVisualStyles();
  if (gauges.rpm) {
    updateGauge(gauges.rpm, state.rpm, 6000, "rpm", "RPM");
  }
  if (gauges.torque) {
    updateGauge(gauges.torque, state.torqueNm, 10000, "N·m", "Torque");
  }

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
  buildStructure();
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
  updateVisualStyles();
  if (groups.powerFlow) {
    updateParticleStream();
  }
  if (groups.motorRotor || groups.drivetrain) {
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
