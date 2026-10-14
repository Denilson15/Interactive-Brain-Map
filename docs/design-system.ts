// The design system reference page: the app's own stylesheets, plus a
// little layout for the page itself.
import "../src/styles/fonts";
import "../src/styles/tokens.css";
import "../src/styles/components.css";
import "./design-system.css";

/** Fills each swatch grid with the live values of the listed tokens. */
function renderSwatches(): void {
    const styles = getComputedStyle(document.documentElement);
    for (const grid of document.querySelectorAll<HTMLElement>(
        "[data-tokens]",
    )) {
        const names = grid.dataset.tokens!.trim().split(/\s+/);
        grid.innerHTML = names
            .map((name) => {
                const value = styles.getPropertyValue(name).trim();
                return (
                    `<figure class="doc-swatch">` +
                    `<span style="background:var(${name})"></span>` +
                    `<figcaption><code>${name}</code>${value}</figcaption>` +
                    `</figure>`
                );
            })
            .join("");
    }
}

renderSwatches();
matchMedia("(prefers-color-scheme: dark)").addEventListener(
    "change",
    renderSwatches,
);
