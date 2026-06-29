/**
 * Shared path resolution for MPA pages at root vs pages/.
 */
export function getBasePath() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const pagesIndex = segments.indexOf("pages");

  if (pagesIndex === -1) {
    return ".";
  }

  const depthBelowPages = segments.length - pagesIndex - 1;
  return depthBelowPages > 0 ? "../".repeat(depthBelowPages) : "..";
}

export function resolvePath(relativePath) {
  const base = getBasePath();
  if (relativePath.startsWith("/")) {
    return relativePath;
  }
  return `${base.replace(/\/+$/, "")}/${relativePath.replace(/^\.?\//, "")}`;
}

export function resolvePage(pageFile) {
  const base = getBasePath();
  if (base === "..") {
    return pageFile;
  }
  return `${base.replace(/\/+$/, "")}/pages/${pageFile}`;
}

export const NAV_ITEMS = [
  { id: "home", label: "Home", href: "index.html", rootOnly: true },
  { id: "dashboard", label: "Dashboard", href: "dashboard.html" },
  { id: "calculators", label: "Calculators", href: "calculators.html" },
  { id: "formulas", label: "Formula Library", href: "formulas.html" },
  { id: "materials", label: "Materials", href: "materials.html" },
  { id: "about", label: "About", href: "about.html" },
  { id: "settings", label: "Settings", href: "settings.html" },
];

export const FOOTER_SECTIONS = [
  {
    title: "Tools",
    links: [
      { label: "Calculators", href: "calculators.html" },
      { label: "Formula Library", href: "formulas.html" },
      { label: "Material Database", href: "materials.html" },
    ],
  },
  {
    title: "Application",
    links: [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Settings", href: "settings.html" },
      { label: "About", href: "about.html" },
    ],
  },
];
