// Inline SVG icons (stroke-based, sized to the text by the .icon class).
// Decorative: they always sit next to visible text, so they are hidden
// from screen readers.
const icon = (paths: string): string =>
    `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
    arrowLeft: icon('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
    chevronDown: icon('<path d="m6 9 6 6 6-6"/>'),
    close: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
};
