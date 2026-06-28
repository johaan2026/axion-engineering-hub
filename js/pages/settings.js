const SETTINGS_KEY = "aes-settings";

const DEFAULT_SETTINGS = {
  siUnits: true,
  reducedMotion: false,
  saveHistory: true,
};

function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
  bindToggle("toggle-si-units", "siUnits", settings);
  bindToggle("toggle-save-history", "saveHistory", settings);
  bindToggle("toggle-reduced-motion", "reducedMotion", settings);

  const clearBtn = document.getElementById("clear-history-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      localStorage.removeItem("aes-calculation-history");
      clearBtn.textContent = "History cleared";
      setTimeout(() => {
        clearBtn.textContent = "Clear calculation history";
      }, 2000);
    });
  }
}
