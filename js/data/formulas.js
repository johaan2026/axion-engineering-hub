/**
 * Formula library and formula-of-the-day content.
 */

export const FORMULA_OF_THE_DAY = {
  id: "power-torque",
  name: "Power–Torque Relationship",
  equation: "P = τ × ω",
  description:
    "Mechanical power equals torque multiplied by angular velocity. Convert RPM to rad/s using ω = 2πN/60 before applying this equation.",
  variables: [
    { symbol: "P", name: "Power", unit: "W" },
    { symbol: "τ", name: "Torque", unit: "N·m" },
    { symbol: "ω", name: "Angular velocity", unit: "rad/s" },
  ],
  applications: ["Motor sizing", "Drive train analysis", "Pump and compressor loads"],
};

export const FORMULAS = [
  {
    id: "gear-ratio",
    name: "Gear Ratio",
    equation: "i = N_driver / N_driven",
    category: "Mechanisms",
    variables: "N = number of teeth",
    applications: "Speed reducers, transmissions, robotics",
  },
  {
    id: "power-torque",
    name: "Power & Torque",
    equation: "P = τ × ω",
    category: "Power Transmission",
    variables: "P (W), τ (N·m), ω (rad/s)",
    applications: "Motor selection, shaft sizing",
  },
  {
    id: "hooke-law",
    name: "Hooke's Law",
    equation: "σ = E × ε",
    category: "Strength of Materials",
    variables: "σ (Pa), E (Pa), ε (dimensionless)",
    applications: "Elastic deformation, spring design",
  },
  {
    id: "axial-stress",
    name: "Axial Stress",
    equation: "σ = F / A",
    category: "Strength of Materials",
    variables: "F (N), A (m²)",
    applications: "Tension members, bolts, columns",
  },
  {
    id: "shear-stress",
    name: "Shear Stress",
    equation: "τ = V / A",
    category: "Strength of Materials",
    variables: "V (N), A (m²)",
    applications: "Pins, rivets, bolted joints",
  },
  {
    id: "beam-deflection-ss",
    name: "Simply Supported — Center Load",
    equation: "δ = F L³ / (48 E I)",
    category: "Structural",
    variables: "F (N), L (m), E (Pa), I (m⁴)",
    applications: "Machine frames, support beams",
  },
  {
    id: "beam-deflection-cantilever",
    name: "Cantilever — End Load",
    equation: "δ = F L³ / (3 E I)",
    category: "Structural",
    variables: "F (N), L (m), E (Pa), I (m⁴)",
    applications: "Tool holders, overhung loads",
  },
  {
    id: "pulley-ratio",
    name: "Pulley Speed Ratio",
    equation: "N_out / N_in = D_driver / D_driven",
    category: "Power Transmission",
    variables: "N (rpm), D (diameter)",
    applications: "Belt drives, conveyor systems",
  },
  {
    id: "poisson",
    name: "Poisson's Ratio",
    equation: "ν = −ε_lateral / ε_axial",
    category: "Material Properties",
    variables: "ν (dimensionless)",
    applications: "FEA material models, strain analysis",
  },
  {
    id: "thermal-expansion",
    name: "Linear Thermal Expansion",
    equation: "ΔL = α L₀ ΔT",
    category: "Thermodynamics",
    variables: "α (1/K), L₀ (m), ΔT (K)",
    applications: "Fit tolerances, piping, assemblies",
  },
];
