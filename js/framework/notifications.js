let notificationContainer = null;
const pendingNotifications = [];
let isDraining = false;

function ensureContainer() {
  if (notificationContainer) {
    return notificationContainer;
  }

  notificationContainer = document.createElement("div");
  notificationContainer.className = "toast-stack";
  notificationContainer.setAttribute("role", "status");
  notificationContainer.setAttribute("aria-live", "polite");
  document.body.appendChild(notificationContainer);
  return notificationContainer;
}

function createToast(message, type) {
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "alert");
  toast.textContent = message;
  return toast;
}

function drainQueue() {
  if (isDraining || pendingNotifications.length === 0) {
    return;
  }

  isDraining = true;
  const { message, type, duration } = pendingNotifications.shift();
  const container = ensureContainer();
  const toast = createToast(message, type);
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("is-visible");
  }, 20);

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 220);
    isDraining = false;
    drainQueue();
  }, duration);
}

export function notify({ message, type = "info", duration = 3200 }) {
  pendingNotifications.push({ message, type, duration });
  drainQueue();
}

export function success(message, duration = 3200) {
  notify({ message, type: "success", duration });
}

export function info(message, duration = 3200) {
  notify({ message, type: "info", duration });
}

export function warning(message, duration = 3200) {
  notify({ message, type: "warning", duration });
}

export function error(message, duration = 3200) {
  notify({ message, type: "error", duration });
}
