import {
  RECENT_CALCULATORS,
  FAVOURITE_CALCULATORS,
  QUICK_LAUNCH,
  formatRelativeTime,
} from "../data/dashboard.js";
import { FORMULA_OF_THE_DAY } from "../data/formulas.js";
import { getCalculatorById } from "../data/calculators.js";
import { resolvePage } from "../data/site.js";
import { getIcon } from "../components/icons.js";

function renderRecent() {
  const container = document.getElementById("recent-calculators");
  if (!container) return;

  container.innerHTML = RECENT_CALCULATORS.map((item) => {
    const calc = getCalculatorById(item.id);
    return `
      <div class="list-item">
        <div class="list-item__main">
          <p class="list-item__title">${item.label}</p>
          <p class="list-item__subtitle">Last used ${formatRelativeTime(item.lastUsed)}</p>
        </div>
        <span class="badge badge--muted">${calc?.category ?? "Calculator"}</span>
      </div>
    `;
  }).join("");
}

function renderFavourites() {
  const container = document.getElementById("favourite-calculators");
  if (!container) return;

  container.innerHTML = FAVOURITE_CALCULATORS.map(
    (item) => `
      <div class="list-item">
        <div class="list-item__main">
          <p class="list-item__title">${item.label}</p>
          <p class="list-item__subtitle">Favourite calculator</p>
        </div>
        <span aria-hidden="true">${getIcon("star")}</span>
      </div>
    `
  ).join("");
}

function renderFormulaOfTheDay() {
  const container = document.getElementById("formula-of-the-day");
  if (!container) return;

  const formula = FORMULA_OF_THE_DAY;
  container.innerHTML = `
    <p class="badge badge--accent">Formula of the Day</p>
    <h3 class="widget__title" style="margin-top: 1rem;">${formula.name}</h3>
    <p class="formula-highlight__equation">${formula.equation}</p>
    <p class="formula-highlight__desc">${formula.description}</p>
    <p class="formula-highlight__desc" style="margin-top: 1rem;">
      <strong>Applications:</strong> ${formula.applications.join(", ")}
    </p>
  `;
}

function renderQuickLaunch() {
  const container = document.getElementById("quick-launch");
  if (!container) return;

  container.innerHTML = QUICK_LAUNCH.map(
    (item) => `
      <a class="quick-launch-card" href="${resolvePage("calculators.html")}#${item.id}" aria-label="Open ${item.label} calculator hub">
        <span class="quick-launch-card__icon">${getIcon(item.icon)}</span>
        <span class="quick-launch-card__label">${item.label}</span>
      </a>
    `
  ).join("");
}

export function init() {
  renderRecent();
  renderFavourites();
  renderFormulaOfTheDay();
  renderQuickLaunch();
}
