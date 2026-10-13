# Interactive Brain Map

A 3D study tool for neuroscience, anatomy, psychology and medicine. Explore the brain level by level (hemispheres → lobes → groups → parts), pull it apart with the Spread slider, adjust the hologram with the Opacity and Brightness sliders, and open 51 psychological disorders and 30 neurological diseases to see which brain areas they affect and why. Includes a 400+ entry dictionary. Available in English and Spanish (EN / ES toggle at the top of the side panel; the choice is remembered).

## Run it
Open `index.html` in a browser. No install needed (three.js loads from a CDN).

## Project layout
- `index.html` – the built, self-contained app (this is what GitHub Pages serves)
- `src/shell.html` – page markup and styles
- `src/app.js` – 3D model, interaction and UI logic
- `src/anatomy.js`, `src/hierarchy.js` – brain regions, groups and parts
- `src/psych.js`, `src/diseases.js`, `src/ext_*.js` – condition content
- `src/glossary.js` – dictionary terms
- `src/es_*.js` – Spanish translations (interface, anatomy, conditions, dictionary), layered over the English content
- `build.py` – combines `src/` into `index.html` (`python3 build.py`)

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
