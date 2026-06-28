# Axion Engineering Suite — Architecture

## Overview

Multi-page application (MPA) built with vanilla HTML5, CSS3, and JavaScript ES modules.
No build step. Deployed as a static site on Netlify.

## Directory structure

```text
axion-engineering-suite/
├── index.html              # Home
├── pages/                  # Inner pages
├── assets/images/          # Static media
├── css/                    # Stylesheets (modular partials)
├── js/
│   ├── main.js             # Application entry
│   ├── components/         # Layout, navigation, icons
│   ├── data/               # Static data modules
│   ├── framework/          # Shared calculator infrastructure
│   └── pages/              # Page-specific init modules
├── calculators/            # Individual calculator pages (Phase 3)
├── components/             # Reserved for HTML partials
└── docs/                   # Project documentation
```

## Routing

| Page | File | `data-page` |
|------|------|-------------|
| Home | `index.html` | `home` |
| Dashboard | `pages/dashboard.html` | `dashboard` |
| Calculators | `pages/calculators.html` | `calculators` |
| Formulas | `pages/formulas.html` | `formulas` |
| Materials | `pages/materials.html` | `materials` |
| About | `pages/about.html` | `about` |
| Settings | `pages/settings.html` | `settings` |

Path helpers in `js/data/site.js` resolve links correctly from root and `pages/`.

## Phase roadmap

- **Phase 1** — Application shell (complete)
- **Phase 2** — Shared infrastructure (history, export helpers, calculator layout)
- **Phase 3** — Calculator implementations
- **Phase 4** — Dashboard LocalStorage integration, polish
- **Phase 5** — QA, Lighthouse, cross-browser

## Local development

ES modules require a local HTTP server (not `file://`):

```bash
python -m http.server 5500 --bind 127.0.0.1
```

Open `http://127.0.0.1:5500`.

## Background image

Replace `assets/images/gear-background.jpg` with your supplied gear photograph.
Recommended: 1920px wide, JPEG or WebP, under 500 KB for performance.
