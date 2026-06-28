export function createPageRouter({ pages, defaultPage = "home" }) {
  const routes = new Map(Object.entries(pages));

  function resolveRoute(pageId) {
    return routes.get(pageId) || routes.get(defaultPage);
  }

  return {
    routes,
    resolveRoute,
    init(pageId) {
      const route = resolveRoute(pageId);
      if (!route) {
        return null;
      }
      return route;
    },
  };
}
