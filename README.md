# Axion Engineering Suite

A professional, browser-based mechanical engineering toolkit — calculators,
formulas, and material reference data in one responsive web application.

Built for mechanical engineering students, design engineers, manufacturing
engineers, CAD designers, and robotics enthusiasts.

## Features (Phase 1)

- Responsive homepage with engineering-themed glassmorphism UI
- Dashboard with recently used calculators, favourites, formula of the day, and quick launch
- Calculator hub listing seven planned engineering tools
- Searchable formula library
- Searchable material database (8 common engineering materials)
- About and Settings pages
- Netlify-ready static deployment

## Tech stack

- HTML5, CSS3, Vanilla JavaScript (ES modules)
- No frameworks, no build step
- Hosted on Netlify from GitHub

## Project structure

```text
axion-engineering-suite/
├── index.html
├── pages/
├── assets/
├── css/
├── js/
├── calculators/
├── components/
├── docs/
├── netlify.toml
├── LICENSE
└── README.md
```

## Run locally

ES modules require a local HTTP server:

```bash
cd axion-engineering-suite
python -m http.server 5500 --bind 127.0.0.1
```

Visit `http://127.0.0.1:5500`.

## Deploy to Netlify

1. Push this repository to GitHub.
2. In Netlify: **Add new site → Import from Git**.
3. Build command: leave empty.
4. Publish directory: `.` (root).

No modifications required after import.

## Development phases

| Phase | Scope |
|-------|--------|
| 1 | Application shell |
| 2 | History, export helpers, shared calculator layout |
| 3 | Calculator implementations |
| 4 | Dashboard LocalStorage, polish |
| 5 | QA and Lighthouse optimisation |

## Background image

The default background is a placeholder industrial photograph. Replace
`assets/images/gear-background.jpg` with your supplied gear image for production.

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

Results are for educational and preliminary design purposes. Verify all
calculations and material properties before use in safety-critical applications.
