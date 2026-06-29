import { CALCULATORS } from "../data/calculators.js";
import { getIcon } from "../components/icons.js";

export function init() {
  const grid = document.getElementById("calculator-grid");
  if (!grid) return;

  grid.innerHTML = CALCULATORS.map(
    (calc) => `
      <a class="card card--link" id="${calc.slug}" href="${calc.id === "gear-ratio" ? "calculators/gear-ratio.html" : calc.id === "power-torque" ? "calculators/power-torque.html" : "#"}" aria-labelledby="calc-${calc.id}-title">
        <div class="card__icon">${getIcon(calc.icon)}</div>
        <h2 class="card__title" id="calc-${calc.id}-title">${calc.name}</h2>
        <p class="card__text">${calc.description}</p>
        <p class="card__meta">${calc.category}</p>
        <p style="margin-top: 1rem;">
          <span class="badge badge--${["gear-ratio", "power-torque"].includes(calc.id) ? "accent" : "soon"}">${["gear-ratio", "power-torque"].includes(calc.id) ? "Available" : "Phase 3"}</span>
        </p>
      </a>
    `
  ).join("");
}
