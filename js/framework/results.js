export function createResultCard({ title, value, meta, tone = "default", icon = "↗", children }) {
  const card = document.createElement("article");
  card.className = `result-card result-card--${tone}`;

  const heading = document.createElement("h3");
  heading.className = "result-card__title";
  heading.textContent = title;
  card.appendChild(heading);

  const valueElement = document.createElement("p");
  valueElement.className = "result-card__value";
  valueElement.textContent = value;
  card.appendChild(valueElement);

  if (meta) {
    const metaElement = document.createElement("p");
    metaElement.className = "result-card__meta";
    metaElement.textContent = meta;
    card.appendChild(metaElement);
  }

  if (icon) {
    const iconElement = document.createElement("span");
    iconElement.className = "result-card__icon";
    iconElement.textContent = icon;
    card.prepend(iconElement);
  }

  if (children) {
    const content = document.createElement("div");
    content.className = "result-card__content";
    content.appendChild(children);
    card.appendChild(content);
  }

  return card;
}

export function createResultsLayout({ primary, secondary = [], notes = [], warnings = [], formula, workedExample, status = "success", loading = false, error = null }) {
  const container = document.createElement("div");
  container.className = "result-stack";

  if (loading) {
    const loadingCard = createResultCard({ title: "Calculating", value: "Working…", meta: "Results are being prepared", tone: "loading" });
    container.appendChild(loadingCard);
    return container;
  }

  if (error) {
    const errorCard = createResultCard({ title: "Calculation error", value: error, meta: "Please review inputs", tone: "error" });
    container.appendChild(errorCard);
    return container;
  }

  if (primary) {
    container.appendChild(createResultCard({ title: primary.title, value: primary.value, meta: primary.meta, tone: status, icon: primary.icon }));
  }

  if (secondary.length) {
    const secondaryGrid = document.createElement("div");
    secondaryGrid.className = "result-grid";
    secondary.forEach((entry) => {
      secondaryGrid.appendChild(createResultCard({ title: entry.title, value: entry.value, meta: entry.meta, tone: entry.tone || "default" }));
    });
    container.appendChild(secondaryGrid);
  }

  if (notes.length) {
    const notesSection = document.createElement("section");
    notesSection.className = "result-section";
    notesSection.innerHTML = `<h3 class="result-section__title">Engineering Notes</h3>`;
    const list = document.createElement("ul");
    list.className = "result-list";
    notes.forEach((note) => {
      const item = document.createElement("li");
      item.textContent = note;
      list.appendChild(item);
    });
    notesSection.appendChild(list);
    container.appendChild(notesSection);
  }

  if (warnings.length) {
    const warningSection = document.createElement("section");
    warningSection.className = "result-section result-section--warning";
    warningSection.innerHTML = `<h3 class="result-section__title">Warnings</h3>`;
    const list = document.createElement("ul");
    list.className = "result-list";
    warnings.forEach((warning) => {
      const item = document.createElement("li");
      item.textContent = warning;
      list.appendChild(item);
    });
    warningSection.appendChild(list);
    container.appendChild(warningSection);
  }

  if (formula) {
    const formulaSection = document.createElement("section");
    formulaSection.className = "result-section";
    formulaSection.innerHTML = `<h3 class="result-section__title">Formula</h3><p class="formula-display">${formula}</p>`;
    container.appendChild(formulaSection);
  }

  if (workedExample) {
    const exampleSection = document.createElement("section");
    exampleSection.className = "result-section";
    exampleSection.innerHTML = `<h3 class="result-section__title">Worked Example</h3><p class="formula-display">${workedExample}</p>`;
    container.appendChild(exampleSection);
  }

  return container;
}
