export function createPageRouter(pagesOrConfig, defaultPage = "home") {
  const config =
    pagesOrConfig && typeof pagesOrConfig === "object" && !Array.isArray(pagesOrConfig) && Object.prototype.hasOwnProperty.call(pagesOrConfig, "pages")
      ? pagesOrConfig
      : { pages: pagesOrConfig || {}, defaultPage };

  const routes = new Map(Object.entries(config.pages || {}));

  function resolveRoute(pageId) {
    return routes.get(pageId) || routes.get(config.defaultPage || defaultPage) || null;
  }

  return {
    routes,
    resolveRoute,
    init(pageId) {
      return resolveRoute(pageId);
    },
  };
}
