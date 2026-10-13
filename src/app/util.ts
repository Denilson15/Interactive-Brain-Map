// Small text and math helpers shared across the app.

/** Escapes text for safe insertion into HTML. */
export function esc(value: unknown): string {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The first sentence of a paragraph, or the whole text if none ends. */
export function firstSentence(text: string): string {
    const match = String(text).match(/^.*?[.!?](?=\s|$)/);
    return match ? match[0] : text;
}

export function clamp(x: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, x));
}

/** Hermite smoothstep from a to b (a may be greater than b). */
export function smoothstep(a: number, b: number, x: number): number {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
}

export const prefersReducedMotion = matchMedia(
    "(prefers-reduced-motion: reduce)",
).matches;

/** Phone layout breakpoint; matches the CSS media query. */
export const PHONE_QUERY = "(max-width:760px)";

export function isPhoneLayout(): boolean {
    return matchMedia(PHONE_QUERY).matches;
}
