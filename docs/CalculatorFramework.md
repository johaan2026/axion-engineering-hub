# Calculator Framework

## Purpose

This framework provides a shared base for future engineering calculators. It centralizes layout, validation, state storage, result rendering, notifications, preferences, and export-ready services.

## Folder structure

- js/framework/: shared framework modules
- js/pages/: page-specific initialization
- components/: reusable HTML partials (reserved)
- calculators/: calculator-specific pages (Phase 3)

## Reusable modules

- calculator-layout.js: base calculator scaffold
- components.js: input controls
- validation.js: reusable validation helpers
- results.js: result cards and result layouts
- storage.js: localStorage abstractions
- notifications.js: toast notifications
- utilities.js: common formatting and helper logic
- exporters.js: export service interfaces
- router.js: scalable route resolution

## Lifecycle

1. Page loads and routes through main.js.
2. Shared layout mounts common shell elements.
3. Page-specific module initializes and builds calculator UI.
4. User interactions validate input and render results.
5. History, favourites, settings, and exports persist through shared services.

## Adding a new calculator

1. Create one HTML page in calculators/.
2. Create one JS module in js/pages/ or js/calculators/.
3. Reuse the shared layout, input controls, and validation helpers.
4. Render results using the result components.
5. Register the route if needed and persist state via storage helpers.
