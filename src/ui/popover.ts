// The definition popover: opens from dotted terms in the text, and when
// the visitor highlights a word in a panel.
import { CONDS } from "../app/conditions";
import {
    TERMS,
    lookup,
    type IndexEntry,
    type LookupResult,
} from "../app/dictionary-index";
import { t } from "../app/i18n";
import { S } from "../app/structures";
import { capitalize, esc, firstSentence } from "../app/util";
import { DICT, rememberTerm } from "./dictionary-panel";
import { ICONS } from "./icons";

let pop: HTMLElement;
/** Where the popover is anchored, reused when it shows a suggestion. */
let anchorRect: DOMRect | null = null;

export function isPopoverOpen(): boolean {
    return !pop.hidden;
}

export function popoverAnchor(): DOMRect | null {
    return anchorRect;
}

function place(rect: DOMRect): void {
    pop.hidden = false;
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    const margin = 16;
    const x = Math.min(
        Math.max(rect.left + rect.width / 2 - width / 2, margin),
        innerWidth - width - margin,
    );
    // Below the anchor, or above it when there's no room below.
    let y = rect.bottom + 8;
    if (y + height > innerHeight - margin) {
        y = Math.max(margin, rect.top - height - 8);
    }
    pop.style.left = x + "px";
    pop.style.top = y + "px";
}

const closeButton = (): string =>
    `<button class="button button--quiet popover-close" type="button" ` +
    `data-close aria-label="${t("close")}">${ICONS.close}</button>`;

/** Shows the definition for a lookup result next to `rect`. */
export function showDefinition(
    result: LookupResult | null,
    rect: DOMRect,
): void {
    if (!result) return;
    anchorRect = rect;
    const entry = result.e;
    if (entry && entry.t === "g") {
        const term = TERMS[entry.id];
        if (!term) return;
        rememberTerm(term.term);
        pop.innerHTML =
            `<div class="popover-row"><span class="meta">${t("dictionary")}</span>` +
            `${closeButton()}</div><h4 class="popover-title">${esc(capitalize(term.term))}</h4>` +
            `<p class="popover-text">${esc(term.def)}</p><div class="popover-row">` +
            `<button class="button button--quiet" type="button" ` +
            `data-dict="g:${esc(term.term)}">` +
            `${t("seeInDict")}</button></div>`;
    } else if (entry && entry.t === "s") {
        const node = S[entry.id];
        // First two sentences of the summary.
        const intro = (node.summary || "").match(
            /^(.*?[.!?])(\s+.*?[.!?])?(?=\s|$)/,
        );
        const region =
            node.topId && node.topId !== node.id
                ? ", " + esc(S[node.topId].name)
                : "";
        pop.innerHTML =
            `<div class="popover-row"><span class="meta">${t("brainRegion")}` +
            `${region}</span>${closeButton()}</div>` +
            `<h4 class="popover-title">${esc(node.name)}</h4>` +
            `<p class="popover-text">${esc(intro ? intro[0] : node.summary || "")}</p>` +
            `<div class="popover-row"><button class="button button--quiet" type="button" ` +
            `data-sub="${node.id}">${t("showOnModel")}</button></div>`;
    } else if (entry && entry.t === "c") {
        const c = CONDS[entry.id];
        const kind = c.kind === "psych" ? t("tPsych") : t("tDisease");
        pop.innerHTML =
            `<div class="popover-row"><span class="meta">${kind}, ${esc(c.cat)}` +
            `</span>${closeButton()}</div><h4 class="popover-title">${esc(c.name)}</h4>` +
            `<p class="popover-text">${esc(firstSentence(c.summary))}</p><div class="popover-row">` +
            `<button class="button button--quiet" type="button" data-cond="${c.key}">` +
            `${t("openHighlight")}</button></div>`;
    } else {
        // Not in the dictionary: suggest entries sharing a longer word.
        const q = result.q;
        const words = q.split(" ").filter((w) => w.length > 2);
        const suggestions = DICT.filter((d) =>
            words.some(
                (w) =>
                    d.name.toLowerCase().includes(w) ||
                    d.aka.some((a) => a.toLowerCase().includes(w)),
            ),
        ).slice(0, 4);
        const chips = suggestions.length
            ? `<div class="chip-row">` +
              suggestions
                  .map(
                      (d) =>
                          `<button class="chip" type="button" ` +
                          `data-def="${esc(d.k)}">${esc(capitalize(d.name))}` +
                          `</button>`,
                  )
                  .join("") +
              `</div>`
            : "";
        pop.innerHTML =
            `<div class="popover-row"><span class="meta">${t("dictionary")}</span>` +
            `${closeButton()}</div><h4 class="popover-title">“${esc(q)}”</h4>` +
            `<p class="popover-text">${t("notInDict")}</p>${chips}<div class="popover-row">` +
            `<button class="button button--quiet" type="button" data-browse>` +
            `${t("browseDict")}</button></div>`;
    }
    place(rect);
}

export function hidePopover(): void {
    pop.hidden = true;
    anchorRect = null;
}

/** "g:term" / "s:id" / "c:key" -> a lookup result for that entry. */
export function resultForKey(key: string): LookupResult {
    const i = key.indexOf(":");
    const entry: IndexEntry = {
        t: key.slice(0, i) as IndexEntry["t"],
        id: key.slice(i + 1),
    };
    return { e: entry, q: "" };
}

export function initPopover(): void {
    pop = document.getElementById("pop")!;
    document.addEventListener("pointerdown", (e) => {
        const target = e.target as Element;
        if (!pop.hidden && !pop.contains(target) && !target.closest(".term")) {
            hidePopover();
        }
    });
    window.addEventListener("resize", hidePopover);
    document
        .querySelectorAll(".view")
        .forEach((view) =>
            view.addEventListener("scroll", hidePopover, { passive: true }),
        );

    // Highlighting a word in a panel looks it up after a short pause.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSelection = "";
    document.addEventListener("selectionchange", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const selection = getSelection();
            if (!selection || selection.isCollapsed || !selection.rangeCount) {
                lastSelection = "";
                return;
            }
            const text = selection.toString().trim();
            if (!text || text.length > 48 || text === lastSelection) return;
            const anchor = selection.anchorNode;
            const node =
                anchor &&
                (anchor.nodeType === 1
                    ? (anchor as Element)
                    : anchor.parentElement);
            if (
                !node ||
                !node.closest(".view") ||
                node.closest(".pop") ||
                node.closest("input") ||
                node.closest("summary")
            ) {
                return;
            }
            lastSelection = text;
            showDefinition(
                lookup(text),
                selection.getRangeAt(0).getBoundingClientRect(),
            );
        }, 380);
    });
}
