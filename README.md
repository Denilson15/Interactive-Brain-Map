# Interactive Brain Map

A 3D study tool for neuroscience, anatomy, psychology and medicine. Explore the brain level by level (hemispheres → lobes → groups → parts), pull it apart with the Spread slider, adjust the hologram with the Opacity and Brightness sliders, and open 51 psychological disorders and 30 neurological diseases to see which brain areas they affect and why. Includes a 400+ entry dictionary.

## Run it
Open `index.html` in a browser. No install needed (three.js loads from a CDN).

## Project layout
- `index.html` – the built, self-contained app (this is what GitHub Pages serves)
- `src/shell.html` – page markup and styles
- `src/app.js` – 3D model, interaction and UI logic
- `src/anatomy.js`, `src/hierarchy.js` – brain regions, groups and parts
- `src/psych.js`, `src/diseases.js`, `src/ext_*.js` – condition content
- `src/glossary.js` – dictionary terms
- `build.py` – combines `src/` into `index.html` (`python3 build.py`)

## Deploy with GitHub Pages
Settings → Pages → Source: "Deploy from a branch" → `main` / root.

The anatomy is simplified for teaching and the content is a study reference, not medical advice.
