/**
 * Calculator metadata — used by hub, dashboard, and quick launch.
 * Replace usage tracking with LocalStorage in Phase 2.
 */

export const CALCULATORS = [
  {
    id: "gear-ratio",
    name: "Gear Ratio",
    description: "Compute gear ratio, output speed, torque, and mechanical advantage for meshing spur gears.",
    category: "Mechanisms",
    icon: "gear",
    slug: "gear-ratio",
  },
  {
    id: "power-torque",
    name: "Power & Torque",
    description: "Convert between power, torque, and rotational speed for drive systems.",
    category: "Power Transmission",
    icon: "power",
    slug: "power-torque",
  },
  {
    id: "stress",
    name: "Stress",
    description: "Calculate normal and shear stress for common mechanical loading cases.",
    category: "Strength of Materials",
    icon: "stress",
    slug: "stress",
  },
  {
    id: "strain",
    name: "Strain",
    description: "Determine engineering strain and deformation from stress and material properties.",
    category: "Strength of Materials",
    icon: "strain",
    slug: "strain",
  },
  {
    id: "beam-deflection",
    name: "Beam Deflection",
    description: "Estimate deflection for standard beam supports and loading conditions.",
    category: "Structural",
    icon: "beam",
    slug: "beam-deflection",
  },
  {
    id: "pulley-ratio",
    name: "Pulley Ratio",
    description: "Calculate speed and torque ratios for belt and pulley drive systems.",
    category: "Power Transmission",
    icon: "pulley",
    slug: "pulley-ratio",
  },
  {
    id: "unit-converter",
    name: "Unit Converter",
    description: "Convert between SI and imperial units for common engineering quantities.",
    category: "Utilities",
    icon: "convert",
    slug: "unit-converter",
  },
];

export function getCalculatorById(id) {
  return CALCULATORS.find((calc) => calc.id === id);
}
