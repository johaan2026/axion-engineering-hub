import { clearCalculationHistory, getUserSettings, saveUserSettings } from "../framework/storage.js";

const DEFAULT_SETTINGS = {
  siUnits: true,
  reducedMotion: false,
  saveHistory: true,
  units: "si",
  decimalPrecision: 2,
};

function loadSettings() {
  try {
    const stored = getUserSettings();
    return stored ? { ...DEFAULT_SETTINGS, ...stored } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  saveUserSettings(settings);
}

function applySettings(settings) {
  document.body.classList.toggle("reduced-motion", Boolean(settings.reducedMotion));
  document.documentElement.classList.toggle("reduced-motion", Boolean(settings.reducedMotion));
  document.documentElement.dataset.units = settings.units || "si";
  document.documentElement.dataset.precision = String(settings.decimalPrecision ?? 2);
}

function bindToggle(toggleId, settingKey, settings) {
  const toggle = document.getElementById(toggleId);
  if (!toggle) return;

  const isOn = Boolean(settings[settingKey]);
  toggle.classList.toggle("is-on", isOn);
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-checked", String(isOn));
  toggle.setAttribute("tabindex", "0");

  function flip() {
    settings[settingKey] = !settings[settingKey];
    toggle.classList.toggle("is-on", settings[settingKey]);
    toggle.setAttribute("aria-checked", String(settings[settingKey]));
    saveSettings(settings);
    applySettings(settings);
  }

  toggle.addEventListener("click", flip);
  toggle.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      flip();
    }
  });
}

export function init() {
  const settings = loadSettings();
  applySettings(settings);
  bindToggle("toggle-si-units", "siUnits", settings);
  bindToggle("toggle-save-history", "saveHistory", settings);
  bindToggle("toggle-reduced-motion", "reducedMotion", settings);

  const unitSelect = document.getElementById("unit-system-select");
  if (unitSelect) {
    unitSelect.value = settings.units || "si";
    unitSelect.addEventListener("change", () => {
      settings.units = unitSelect.value;
      saveSettings(settings);
      applySettings(settings);
    });
  }

  const precisionInput = document.getElementById("decimal-precision-input");
  if (precisionInput) {
    precisionInput.value = settings.decimalPrecision ?? 2;
    precisionInput.addEventListener("change", () => {
      const parsed = Number.parseInt(precisionInput.value, 10);
      settings.decimalPrecision = Number.isFinite(parsed) ? parsed : 2;
      saveSettings(settings);
      applySettings(settings);
    });
  }

  const clearBtn = document.getElementById("clear-history-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearCalculationHistory();
      clearBtn.textContent = "History cleared";
      setTimeout(() => {
        clearBtn.textContent = "Clear calculation history";
      }, 2000);
    });
  }
}
