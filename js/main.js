import { mountLayout, setBackgroundImage } from "./components/layout.js";
import { initNavigation, initRippleEffect } from "./components/navigation.js";
import { rememberLastOpenedPage } from "./framework/storage.js";
import { createPageRouter } from "./framework/router.js";

const pageRouter = createPageRouter({
  home: { id: "home" },
  dashboard: { id: "dashboard" },
  calculators: { id: "calculators" },
  "gear-ratio": { id: "gear-ratio" },
  "power-torque": { id: "power-torque" },
  "beam-deflection": { id: "beam-deflection" },
  formulas: { id: "formulas" },
  materials: { id: "materials" },
  about: { id: "about" },
  settings: { id: "settings" },
});

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

document.addEventListener("DOMContentLoaded", async () => {
  const currentPage = document.body.dataset.page ?? "home";

  rememberLastOpenedPage(currentPage);
  setBackgroundImage();
  mountLayout(currentPage);
  initNavigation();
  initRippleEffect();

  const route = pageRouter.init(currentPage);
  await initPageModule(route?.id ?? currentPage);
});
