const STORAGE_KEYS = {
  history: "aes-calculation-history",
  favorites: "aes-favourite-calculators",
  recent: "aes-recent-calculators",
  settings: "aes-settings",
  lastOpened: "aes-last-opened-page",
};

function readStorage(key, fallback = []) {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      return fallback;
    }
    return JSON.parse(stored);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getCalculationHistory() {
  return readStorage(STORAGE_KEYS.history, []);
}

export function addCalculationHistory(entry) {
  const nextEntries = [
    { id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...entry },
    ...getCalculationHistory(),
  ].slice(0, 25);
  writeStorage(STORAGE_KEYS.history, nextEntries);
  return nextEntries;
}

export function clearCalculationHistory() {
  writeStorage(STORAGE_KEYS.history, []);
  return [];
}

export function getFavouriteCalculators() {
  return readStorage(STORAGE_KEYS.favorites, []);
}

export function toggleFavouriteCalculator(calculator) {
  const favorites = getFavouriteCalculators();
  const exists = favorites.some((item) => item.id === calculator.id);
  const next = exists ? favorites.filter((item) => item.id !== calculator.id) : [...favorites, { ...calculator, savedAt: new Date().toISOString() }];
  writeStorage(STORAGE_KEYS.favorites, next);
  return next;
}

export function getRecentCalculators() {
  return readStorage(STORAGE_KEYS.recent, []);
}

export function recordRecentCalculator(calculator) {
  const recent = getRecentCalculators();
  const next = [{ ...calculator, viewedAt: new Date().toISOString() }, ...recent.filter((item) => item.id !== calculator.id)].slice(0, 8);
  writeStorage(STORAGE_KEYS.recent, next);
  return next;
}

export function getUserSettings() {
  return readStorage(STORAGE_KEYS.settings, {});
}

export function saveUserSettings(settings) {
  writeStorage(STORAGE_KEYS.settings, settings);
  return settings;
}

export function rememberLastOpenedPage(pageId) {
  writeStorage(STORAGE_KEYS.lastOpened, pageId);
  return pageId;
}

export function getLastOpenedPage() {
  return readStorage(STORAGE_KEYS.lastOpened, "home");
}
