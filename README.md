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
- [Prettier](https://prettier.io) – formats code automatically to the
  house style (4-space indent, 80 columns), so style is never a review
  topic.
- [Playwright](https://playwright.dev) – end-to-end tests in a real
  browser (see below).

## Project layout
- `index.html` – page markup; Vite builds it into `dist/`
- `src/main.ts` – entry point; loads content, then the app
- `src/styles.css` – all styles
- `src/app.js` – 3D model, interaction and UI logic
- `src/anatomy.js`, `src/hierarchy.js` – brain regions, groups and parts
- `src/psych.js`, `src/diseases.js`, `src/ext_*.js` – condition content
- `src/glossary.js` – dictionary terms
- `src/es_*.js` – Spanish translations (interface, anatomy, conditions,
  dictionary), layered over the English content

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
Settings → Pages → Source: "Deploy from a branch" → `main` / root.

The anatomy is simplified for teaching and the content is a study reference, not medical advice.

## Content review status
The English content and the Spanish translation were both produced without professional medical review. Treat both as drafts that still need checking by a qualified reviewer (and, for the Spanish, a native-speaking medical translator) before relying on them.
