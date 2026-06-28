import { mountLayout, setBackgroundImage } from "./components/layout.js";
import { initNavigation, initRippleEffect } from "./components/navigation.js";

async function initPageModule(pageId) {
  if (!pageId) {
    return;
  }

  try {
    const module = await import(`./pages/${pageId}.js`);
    if (typeof module.init === "function") {
      module.init();
    }
  } catch {
    /* Page has no dedicated module */
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const currentPage = document.body.dataset.page ?? "home";

  setBackgroundImage();
  mountLayout(currentPage);
  initNavigation();
  initRippleEffect();
  initPageModule(currentPage);
});
