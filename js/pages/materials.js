import { MATERIALS } from "../data/materials.js";

function renderMaterials(filter = "") {
  const tbody = document.getElementById("materials-body");
  const empty = document.getElementById("materials-empty");
  if (!tbody) return;

  const query = filter.trim().toLowerCase();
  const filtered = MATERIALS.filter(
    (material) =>
      !query ||
      material.name.toLowerCase().includes(query) ||
      material.applications.toLowerCase().includes(query)
  );

  tbody.innerHTML = filtered
    .map(
      (material) => `
        <tr>
          <td><strong>${material.name}</strong><br><span style="color: var(--color-text-muted); font-size: 0.8125rem;">${material.applications}</span></td>
          <td>${material.density}</td>
          <td>${material.youngsModulus}</td>
          <td>${material.yieldStrength}</td>
          <td>${material.ultimateTensile}</td>
          <td>${material.poissonRatio}</td>
          <td>${material.thermalConductivity}</td>
          <td>${material.specificHeat}</td>
        </tr>
      `
    )
    .join("");

  if (empty) {
    empty.hidden = filtered.length > 0;
  }
}

export function init() {
  const search = document.getElementById("materials-search");
  renderMaterials();

  if (search) {
    search.addEventListener("input", (event) => {
      renderMaterials(event.target.value);
    });
  }
}
