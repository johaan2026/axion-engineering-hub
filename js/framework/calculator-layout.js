export function createCalculatorLayout({ title, description, formula, notes, inputs, results, example, historyAction, exportAction }) {
  const shell = document.createElement("section");
  shell.className = "calculator-shell";

  shell.innerHTML = `
    <div class="calculator-shell__header">
      <div>
        <p class="page-header__eyebrow">Engineering Calculator</p>
        <h1 class="page-header__title">${title}</h1>
        <p class="page-header__subtitle">${description}</p>
      </div>
      <div class="calculator-shell__actions">
        <button type="button" class="btn btn--secondary btn--sm" data-action="history">History</button>
        <button type="button" class="btn btn--secondary btn--sm" data-action="export">Export</button>
      </div>
    </div>

    <div class="calculator-shell__grid">
      <div class="calculator-shell__content">
        <section class="glass-panel calculator-panel" aria-labelledby="formula-heading">
          <h2 id="formula-heading" class="calculator-panel__title">Formula</h2>
          <p class="calculator-panel__text">${formula}</p>
        </section>

        <section class="glass-panel calculator-panel" aria-labelledby="notes-heading">
          <h2 id="notes-heading" class="calculator-panel__title">Engineering Notes</h2>
          <p class="calculator-panel__text">${notes}</p>
        </section>

        <section class="glass-panel calculator-panel" aria-labelledby="inputs-heading">
          <h2 id="inputs-heading" class="calculator-panel__title">Inputs</h2>
          <div class="calculator-panel__body" data-slot="inputs"></div>
        </section>
      </div>

      <div class="calculator-shell__side">
        <section class="glass-panel calculator-panel" aria-labelledby="results-heading">
          <h2 id="results-heading" class="calculator-panel__title">Results</h2>
          <div class="calculator-panel__body" data-slot="results"></div>
        </section>

        <section class="glass-panel calculator-panel" aria-labelledby="example-heading">
          <h2 id="example-heading" class="calculator-panel__title">Worked Example</h2>
          <p class="calculator-panel__text">${example}</p>
        </section>
      </div>
    </div>
  `;

  shell.querySelector('[data-action="history"]').addEventListener("click", historyAction);
  shell.querySelector('[data-action="export"]').addEventListener("click", exportAction);

  const inputSlot = shell.querySelector('[data-slot="inputs"]');
  const resultsSlot = shell.querySelector('[data-slot="results"]');

  inputSlot.appendChild(inputs);
  resultsSlot.appendChild(results);

  return shell;
}
