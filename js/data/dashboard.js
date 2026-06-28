/**
 * Placeholder dashboard data — replace with LocalStorage in Phase 2.
 */

export const RECENT_CALCULATORS = [
  {
    id: "gear-ratio",
    lastUsed: "2026-06-27T14:32:00",
    label: "Gear Ratio",
  },
  {
    id: "power-torque",
    lastUsed: "2026-06-26T09:15:00",
    label: "Power & Torque",
  },
  {
    id: "unit-converter",
    lastUsed: "2026-06-25T16:48:00",
    label: "Unit Converter",
  },
];

export const FAVOURITE_CALCULATORS = [
  { id: "gear-ratio", label: "Gear Ratio" },
  { id: "beam-deflection", label: "Beam Deflection" },
  { id: "stress", label: "Stress" },
];

export const QUICK_LAUNCH = [
  { id: "gear-ratio", label: "Gear Ratio", icon: "gear" },
  { id: "power-torque", label: "Power & Torque", icon: "power" },
  { id: "stress", label: "Stress", icon: "stress" },
  { id: "unit-converter", label: "Units", icon: "convert" },
];

export function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
