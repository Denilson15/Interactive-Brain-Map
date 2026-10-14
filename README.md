# Interactive Brain Map

A 3D study tool for neuroscience, anatomy, psychology and medicine. Explore the brain level by level (hemispheres → lobes → groups → parts), pull it apart with the Spread slider, adjust the hologram with the Opacity and Brightness sliders, and open 51 psychological disorders and 30 neurological diseases to see which brain areas they affect and why. Includes a 400+ entry dictionary. Available in English and Spanish (EN / ES toggle at the top of the side panel; the choice is remembered).

## Run it
Requires [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install
npm run dev       # local dev server with live reload
npm run build     # type-check and build the site into dist/
npm run preview   # serve the built site from dist/
```

## Stack
- [three.js](https://threejs.org) r128 – renders the 3D brain (WebGL).
- [Vite](https://vite.dev) – dev server and bundler; produces the static
  site in `dist/` and will let rarely used content load on demand.
- [TypeScript](https://www.typescriptlang.org) – type-checks the code
  before it runs, catching mistakes in how data flows through the app.
- [yaml](https://eemeli.org/yaml/) – reads the content files at build
  time (a small plugin in `vite.config.ts`), so the browser gets plain
  JavaScript and never parses YAML.
- [Fontsource](https://fontsource.org) – the three typefaces (Bricolage
  Grotesque, Source Serif 4, IBM Plex Mono; SIL Open Font License) as
  npm packages, so fonts are served with the site instead of from Google.
- [Prettier](https://prettier.io) – formats code automatically to the
  house style (4-space indent, 80 columns), so style is never a review
  topic.
- [Playwright](https://playwright.dev) – end-to-end tests in a real
  browser (see below).

## Project layout
- `index.html` – page markup; Vite builds it into `dist/`
- `src/main.ts` – entry point: fonts and styles, then content, then app
- `src/styles/` – the design system: `tokens.css` (type scale, colors,
  spacing) and `components.css` (buttons, chips, cards and so on)
- `src/styles/layout.css` – app-specific layout and styles
- `docs/design-system.html` – a reference page for the tokens and
  components, built and deployed with the site
- `src/app/` – app logic without 3D:
  - `structures.ts` – the region tree (hemispheres → regions → groups →
    parts) and the keys that tell left and right apart
  - `conditions.ts` – disorders and diseases and the areas they involve
  - `content.ts` – loads content; switches it between English and Spanish
  - `i18n.ts` – interface text and the current language
  - `dictionary-index.ts` – finds terms in text and looks up highlights
  - `controller.ts` – selection, tabs, toolbar and language switching
  - `state.ts`, `types.ts`, `util.ts` – shared state, types and helpers
- `src/scene/` – the 3D model:
  - `procedural.ts` – generates the brain geometry (no model files)
  - `model.ts` – builds the meshes, label anchors and spread offsets
  - `stage.ts` – renderer, camera, highlighting, picking, labels
- `src/ui/` – the panels: region, conditions, dictionary, popover,
  section map and the phone bottom sheet
- `src/content/` – all study content as YAML, easy to review and edit:
  - `en/` – regions and parts, the hierarchy, disorders, diseases and the
    dictionary; `en/write-ups/` holds the long condition write-ups,
    loaded the first time a condition is opened
  - `es/` – the Spanish translation, loaded only when Spanish is chosen
- `public/` – files copied into the site as they are: the favicon, the
  phone home-screen icon and the 1200×630 link-preview image
- `.env` – the site's public address (`VITE_SITE_URL`); link previews,
  the canonical URL, `robots.txt` and `sitemap.xml` are built from it
- `scripts/make-social-assets.mjs` – regenerates the link-preview image
  from the real 3D model, plus the PNG icons. Run `npm run build &&
  npm run preview`, then `node scripts/make-social-assets.mjs` in a
  second terminal. Re-run it when the design or the intro copy changes.

## Run the tests
End-to-end tests use [Playwright](https://playwright.dev), which drives a
real browser, so they check what a visitor actually sees: every
drill-down level, conditions, the dictionary, language switching and the
phone layout.

```sh
npm install
npx playwright install chromium
npm run test:e2e
```

The same tests run on GitHub Actions for every push and pull request.

## Deploy with GitHub Pages
Every push to `main` builds the site and publishes `dist/` through the
Deploy workflow in `.github/workflows/deploy.yml`. One-time setup:
Settings → Pages → Source: **GitHub Actions**.

The anatomy is simplified for teaching and the content is a study reference, not medical advice.

## Content review status
The English content and the Spanish translation were both produced without professional medical review. Treat both as drafts that still need checking by a qualified reviewer (and, for the Spanish, a native-speaking medical translator) before relying on them.
