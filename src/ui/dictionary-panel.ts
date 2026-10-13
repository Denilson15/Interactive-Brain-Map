// The Dictionary tab: every glossary term, structure and condition in
// one searchable, filterable list.
import { CONDS } from "../app/conditions";
import { currentLang, t } from "../app/i18n";
import { S } from "../app/structures";
import type { GlossaryData } from "../app/types";
import {
    capitalize,
    esc,
    firstSentence,
    prefersReducedMotion,
} from "../app/util";

type EntryType = "Term" | "Region" | "Psychology" | "Disease";
type Filter = "All" | EntryType;

export interface DictionaryEntry {
    /** Unique key: "g:term", "s:structureId" or "c:conditionKey". */
    k: string;
    name: string;
    def: string;
    aka: string[];
    type: EntryType;
    /** Structure id or condition key the entry links to. */
    ref?: string;
    /** Region a structure belongs to, shown as a tag. */
    sub?: string;
}

const FILTERS: Filter[] = ["All", "Term", "Region", "Psychology", "Disease"];
const FILTER_LABEL: Record<Filter, string> = {
    All: "fAll",
    Term: "fTerm",
    Region: "fRegion",
    Psychology: "fPsych",
    Disease: "fDisease",
};
const TYPE_LABEL: Record<EntryType, string> = {
    Term: "tTerm",
    Region: "tRegion",
    Psychology: "tPsych",
    Disease: "tDisease",
};

/** All entries, sorted by name in the current language. */
export let DICT: DictionaryEntry[] = [];
let activeFilter: Filter = "All";
let searchInput: HTMLInputElement;
let listEl: HTMLElement;
let countEl: HTMLElement;
let filtersEl: HTMLElement;
let recentEl: HTMLElement;
/** Recently looked-up terms, newest first (max 8). */
const recent: string[] = [];

export function buildDictionary(glossary: GlossaryData[]): void {
    DICT = [
        ...glossary.map(([term, def, aka]): DictionaryEntry => ({
            k: "g:" + term,
            name: term,
            def,
            aka,
            type: "Term",
        })),
        ...Object.values(S)
            .filter((s) => !s.isRoot)
            .map((s): DictionaryEntry => ({
                k: "s:" + s.id,
                name: s.name,
                def: firstSentence(s.summary || ""),
                aka: s.aka || [],
                type: "Region",
                ref: s.id,
                sub: s.topId && s.topId !== s.id ? S[s.topId].name : "",
            })),
        ...Object.values(CONDS).map((c): DictionaryEntry => ({
            k: "c:" + c.key,
            name: c.name,
            def: firstSentence(c.summary),
            aka: c.aka || [],
            type: c.kind === "psych" ? "Psychology" : "Disease",
            ref: c.key,
        })),
    ].sort((a, b) =>
        a.name.localeCompare(b.name, currentLang(), { sensitivity: "base" }),
    );
}

export function renderFilters(): void {
    filtersEl.innerHTML = FILTERS.map(
        (f) =>
            `<button type="button" class="chip" data-f="${f}" ` +
            `aria-pressed="${f === activeFilter}">` +
            `${t(FILTER_LABEL[f])}</button>`,
    ).join("");
}

const slug = (key: string): string => "g-" + key.replace(/[^a-z0-9]+/gi, "-");

/** Renders the list; `highlight` is the key of an entry to mark. */
export function renderGlossary(highlight?: string): void {
    const q = searchInput.value.trim().toLowerCase();
    const list = DICT.filter(
        (e) =>
            (activeFilter === "All" || e.type === activeFilter) &&
            (!q ||
                e.name.toLowerCase().includes(q) ||
                e.aka.some((a) => a.toLowerCase().includes(q)) ||
                e.def.toLowerCase().includes(q)),
    );
    countEl.textContent = t("entriesOf", { n: list.length, t: DICT.length });
    if (!list.length) {
        listEl.innerHTML = `<li class="empty">${esc(
            t("nothingMatches", { q: searchInput.value }),
        )}</li>`;
        return;
    }
    listEl.innerHTML = list
        .map((e) => {
            const link =
                e.type === "Region"
                    ? `<button type="button" class="lnk" data-sub="${e.ref}">` +
                      `${t("showOnModel")}</button>`
                    : e.type !== "Term"
                      ? `<button type="button" class="lnk" ` +
                        `data-cond="${e.ref}">${t("openEntry")}</button>`
                      : "";
            return (
                `<li id="${slug(e.k)}"` +
                `${e.k === highlight ? ' class="hl"' : ""}>` +
                `<span class="t">${esc(capitalize(e.name))}</span>` +
                `<span class="tag">${t(TYPE_LABEL[e.type])}` +
                `${e.sub ? " · " + esc(e.sub) : ""}</span>` +
                `<p>${esc(e.def)}</p>${link}</li>`
            );
        })
        .join("");
}

function setFilter(filter: Filter): void {
    activeFilter = filter;
    filtersEl
        .querySelectorAll<HTMLElement>("[data-f]")
        .forEach((x) =>
            x.setAttribute("aria-pressed", String(x.dataset.f === filter)),
        );
}

/** Adds a term to the "recently looked up" chips. */
export function rememberTerm(term: string): void {
    const i = recent.indexOf(term);
    if (i >= 0) recent.splice(i, 1);
    recent.unshift(term);
    recent.length = Math.min(recent.length, 8);
    recentEl.innerHTML = recent
        .map(
            (r) =>
                `<button class="chip" type="button" data-dict="g:${esc(r)}">` +
                `${esc(capitalize(r))}</button>`,
        )
        .join("");
}

export function clearRecentTerms(): void {
    recent.length = 0;
    recentEl.innerHTML = "";
}

/** Clears search and filters, then scrolls to and marks an entry. */
export function revealEntry(key: string): void {
    searchInput.value = "";
    setFilter("All");
    renderGlossary(key);
    const el = document.getElementById(slug(key));
    if (el) {
        el.scrollIntoView({
            block: "center",
            behavior: prefersReducedMotion ? "auto" : "smooth",
        });
    }
}

/** Clears the search and focuses it, for browsing from scratch. */
export function browseDictionary(): void {
    searchInput.value = "";
    renderGlossary();
    searchInput.focus();
}

export function initDictionaryPanel(): void {
    searchInput = document.getElementById("gq") as HTMLInputElement;
    listEl = document.getElementById("glist")!;
    countEl = document.getElementById("gcount")!;
    filtersEl = document.getElementById("gfilters")!;
    recentEl = document.getElementById("recent")!;
    filtersEl.addEventListener("click", (e) => {
        const button = (e.target as Element).closest<HTMLElement>("[data-f]");
        if (!button) return;
        setFilter(button.dataset.f as Filter);
        renderGlossary();
    });
    searchInput.addEventListener("input", () => renderGlossary());
}
