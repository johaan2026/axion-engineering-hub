import { NAV_ITEMS, FOOTER_SECTIONS, resolvePage, resolvePath } from "../data/site.js";
import { getIcon } from "./icons.js";

function navHref(item) {
  if (item.rootOnly) {
    return resolvePath("index.html");
  }
  return resolvePage(item.href);
}

function isActiveNav(item, currentPage) {
  if (item.id === "home") {
    return currentPage === "home";
  }
  return item.id === currentPage;
}

export function renderHeader(currentPage) {
  const navLinks = NAV_ITEMS.map(
    (item) =>
      `<a class="site-nav__link${isActiveNav(item, currentPage) ? " is-active" : ""}" href="${navHref(item)}"${isActiveNav(item, currentPage) ? ' aria-current="page"' : ""}>${item.label}</a>`
  ).join("");

  return `
    <header class="site-header">
      <div class="container site-header__inner">
        <a class="site-brand" href="${resolvePath("index.html")}" aria-label="Axion Engineering Suite — Home">
          <span class="site-brand__mark">${getIcon("logo")}</span>
          <span>Axion Engineering Suite</span>
        </a>
        <button
          type="button"
          class="site-nav-toggle"
          id="nav-toggle"
          aria-label="Open navigation menu"
          aria-expanded="false"
          aria-controls="site-nav"
        >
          ${getIcon("menu")}
        </button>
        <nav class="site-nav" id="site-nav" aria-label="Main navigation">
          ${navLinks}
        </nav>
      </div>
    </header>
  `;
}

export function renderFooter() {
  const sections = FOOTER_SECTIONS.map(
    (section) => `
      <div>
        <h2 class="site-footer__heading">${section.title}</h2>
        <ul class="site-footer__links">
          ${section.links
            .map(
              (link) =>
                `<li><a href="${resolvePage(link.href)}">${link.label}</a></li>`
            )
            .join("")}
        </ul>
      </div>
    `
  ).join("");

  const year = new Date().getFullYear();

  return `
    <footer class="site-footer">
      <div class="container site-footer__inner">
        <div>
          <p class="site-footer__brand">Axion Engineering Suite</p>
          <p class="site-footer__tagline">
            Professional engineering tools for mechanical engineers — calculators,
            formulas, and material reference data in one responsive workspace.
          </p>
        </div>
        <div class="site-footer__grid">${sections}</div>
      </div>
      <div class="container site-footer__bottom">
        <span>&copy; ${year} Axion Engineering Suite</span>
        <span>MIT License</span>
      </div>
    </footer>
  `;
}

export function mountLayout(currentPage) {
  const headerMount = document.getElementById("site-header");
  const footerMount = document.getElementById("site-footer");

  if (headerMount) {
    headerMount.innerHTML = renderHeader(currentPage);
  }

  if (footerMount) {
    footerMount.innerHTML = renderFooter();
  }
}

export function setBackgroundImage() {
  const bgUrl = resolvePath("assets/images/gear-background.jpg");
  document.body.style.setProperty("--bg-image", `url("${bgUrl}")`);
  document.body.classList.add("has-background");
}
