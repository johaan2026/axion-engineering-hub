import { FORMULAS } from "../data/formulas.js";

function renderFormulas(filter = "") {
  const list = document.getElementById("formula-list");
  const empty = document.getElementById("formula-empty");
  if (!list) return;

  const query = filter.trim().toLowerCase();
  const filtered = FORMULAS.filter(
    (formula) =>
      !query ||
      formula.name.toLowerCase().includes(query) ||
      formula.category.toLowerCase().includes(query) ||
      formula.equation.toLowerCase().includes(query) ||
      formula.applications.toLowerCase().includes(query)
  );

  list.innerHTML = filtered
    .map(
      (formula) => `
        <article class="card">
          <div class="card__meta">${formula.category}</div>
          <h2 class="card__title" style="margin-top: 0.5rem;">${formula.name}</h2>
          <p class="formula-highlight__equation" style="font-size: 1.125rem; margin: 1rem 0;">${formula.equation}</p>
          <p class="card__text"><strong>Variables:</strong> ${formula.variables}</p>
          <p class="card__text" style="margin-top: 0.5rem;"><strong>Applications:</strong> ${formula.applications}</p>
        </article>
      `
    )
    .join("");

  if (empty) {
    empty.hidden = filtered.length > 0;
  }
}

export function init() {
  const search = document.getElementById("formula-search");
  renderFormulas();

  if (search) {
    search.addEventListener("input", (event) => {
      renderFormulas(event.target.value);
    });
  }
}
