export function formatNumber(value, precision = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  });
}

export function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error("Clipboard API unavailable"));
}

export function generateUUID() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatTimestamp(timestamp, locale = undefined) {
  return new Date(timestamp).toLocaleString(locale);
}

export function formatEngineeringNotation(value, precision = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  const absValue = Math.abs(numeric);
  const exponent = absValue === 0 ? 0 : Math.floor(Math.log10(absValue) / 3) * 3;
  const scaled = numeric / 10 ** exponent;
  const suffix = ["", "k", "M", "G", "T"][Math.max(0, exponent / 3)] || "";
  return `${round(scaled, precision)}${suffix}`;
}

export function downloadFile(content, filename, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function debounce(callback, delay = 200) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

export function throttle(callback, interval = 200) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= interval) {
      lastCall = now;
      callback(...args);
    }
  };
}
