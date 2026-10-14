// Generates the link-preview image and PNG icons in public/.
//
// The preview image shows the real 3D model next to the headline, so it
// is rendered from a running build:
//
//     npm run build && npm run preview      (in one terminal)
//     node scripts/make-social-assets.mjs   (in another)
//
// Re-run it when the design or the intro copy changes.
import { chromium } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = process.argv[2] ?? "http://127.0.0.1:4173/";
const root = fileURLToPath(new URL("..", import.meta.url));
const fontCss = (file) => `file://${root}node_modules/${file}`;

const browser = await chromium.launch({
    // Software WebGL, so this works on machines without a GPU.
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});

// 1. Render the model: returning visitor (no intro), labels off.
const app = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
});
await app.addInitScript(() => localStorage.setItem("ibm-intro-seen", "1"));
await app.goto(SITE);
await app.waitForFunction(() => "__atlas" in window, null, {
    timeout: 120_000,
});
// Only the model: hide the controls drawn over it.
await app.addStyleTag({
    content: ".toolbar, .stage-hint, .labels { display: none !important; }",
});
await app.waitForTimeout(800);
const model = await app.locator("#stage canvas").screenshot();
await app.close();

// 2. Compose the 1200x630 preview with the model beside the headline.
const card = await browser.newPage({
    viewport: { width: 1200, height: 630 },
});
// Written to a file so the page may load the local font files.
const cardFile = join(mkdtempSync(join(tmpdir(), "ibm-")), "card.html");
writeFileSync(
    cardFile,
    `<!doctype html>
<html><head>
<link rel="stylesheet" href="${fontCss(
        "@fontsource-variable/bricolage-grotesque/opsz.css",
    )}">
<link rel="stylesheet" href="${fontCss(
        "@fontsource-variable/source-serif-4/wght.css",
    )}">
<style>
    body {
        margin: 0;
        width: 1200px;
        height: 630px;
        overflow: hidden;
        color: #e8edf3;
        background:
            url(data:image/png;base64,${model.toString("base64")})
                right -260px center / auto 112% no-repeat,
            radial-gradient(90% 90% at 75% 45%, #283447, #161c24 70%);
        font-family: "Bricolage Grotesque Variable", sans-serif;
    }
    main {
        position: absolute;
        inset: 0;
        padding: 72px 72px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        background: linear-gradient(90deg, #161c24 38%, transparent 68%);
    }
    .brand { font-size: 26px; font-weight: 700; margin: 0 0 28px; }
    h1 {
        margin: 0 0 24px;
        max-width: 560px;
        font-size: 68px;
        line-height: 1.02;
        letter-spacing: -0.02em;
    }
    p.lead {
        margin: 0;
        max-width: 520px;
        font-family: "Source Serif 4 Variable", serif;
        font-size: 26px;
        line-height: 1.45;
        color: #aeb7c2;
    }
</style></head><body><main>
    <p class="brand">Interactive Brain Map</p>
    <h1>Explore the human brain in 3D</h1>
    <p class="lead">79 parts, 81 conditions and a 415-entry dictionary.
    Free, in English and Spanish.</p>
</main></body></html>`,
);
await card.goto(`file://${cardFile}`);
await card.evaluate(() => document.fonts.ready);
// JPEG keeps the file small (link previews are fetched by every share).
await card.screenshot({
    path: `${root}public/social-preview.jpg`,
    type: "jpeg",
    quality: 88,
});
await card.close();

// 3. PNG icons from the SVG, for devices that don't use SVG icons.
const svg = readFileSync(`${root}public/favicon.svg`, "utf8");
// iOS rounds home-screen icons itself, so that one gets square corners.
for (const [size, name, square] of [
    [180, "apple-touch-icon.png", true],
    [32, "favicon-32.png", false],
]) {
    const icon = await browser.newPage({
        viewport: { width: size, height: size },
    });
    await icon.setContent(
        `<body style="margin:0">${svg
            .replace("<svg ", `<svg width="${size}" height="${size}" `)
            .replace('rx="14"', square ? 'rx="0"' : 'rx="14"')}</body>`,
    );
    await icon.screenshot({
        path: `${root}public/${name}`,
        omitBackground: true,
    });
    await icon.close();
}

await browser.close();
console.log("Wrote public/social-preview.jpg and icons.");
