// Finds dictionary terms, structure names and condition names in text so
// they can be turned into clickable definitions, and looks up words the
// visitor highlights.
import { CONDS } from "./conditions";
import { S } from "./structures";
import type { GlossaryData } from "./types";
import { esc } from "./util";

/**
 * What a name points to: a structure ("s"), a condition ("c") or a
 * glossary term ("g"), with its id or term.
 */
export interface IndexEntry {
    t: "s" | "c" | "g";
    id: string;
}

export interface GlossaryTerm {
    term: string;
    def: string;
    aka: string[];
}

/** Lower-cased names and aliases -> what they refer to. */
let INDEX: Record<string, IndexEntry> = {};
/** Glossary terms by their (current-language) name. */
export let TERMS: Record<string, GlossaryTerm> = {};
/** Matches any indexed name as a whole word; longest names win. */
let TERM_RE = /$^/;

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rebuilds the index; call after the content language changes. */
export function buildIndex(glossary: GlossaryData[]): void {
    INDEX = {};
    TERMS = {};
    const add = (name: string, entry: IndexEntry): void => {
        const key = name.toLowerCase();
        if (!INDEX[key]) INDEX[key] = entry;
    };
    for (const node of Object.values(S)) {
        if (node.isRoot || node.isHemi) continue;
        add(node.name, { t: "s", id: node.id });
        for (const alias of node.aka || []) add(alias, { t: "s", id: node.id });
    }
    for (const condition of Object.values(CONDS)) {
        add(condition.name, { t: "c", id: condition.key });
        for (const alias of condition.aka || []) {
            add(alias, { t: "c", id: condition.key });
        }
    }
    for (const [term, def, aka] of glossary) {
        TERMS[term] = { term, def, aka };
        add(term, { t: "g", id: term });
        for (const alias of aka) add(alias, { t: "g", id: term });
    }
    const wordChars = "A-Za-z0-9À-ÿ";
    const names = Object.keys(INDEX)
        .sort((a, b) => b.length - a.length)
        .map((name) => escapeRegExp(esc(name)));
    TERM_RE = new RegExp(
        "(?<![" +
            wordChars +
            "])(" +
            names.join("|") +
            ")(?![" +
            wordChars +
            "])",
        "gi",
    );
}

/**
 * Escapes text and wraps the first mention of each indexed name in a
 * button. `seen` carries over between paragraphs of one panel so each
 * name is linked only once.
 */
export function linkify(text: string | undefined, seen: Set<string>): string {
    return esc(text || "").replace(TERM_RE, (match) => {
        const entry = INDEX[match.toLowerCase().replace(/&amp;/g, "&")];
        if (!entry) return match;
        const key = entry.t + ":" + entry.id;
        if (seen.has(key)) return match;
        seen.add(key);
        const cls =
            entry.t === "s" ? "term st" : entry.t === "c" ? "term cd" : "term";
        return (
            `<button type="button" class="${cls}" data-t="${entry.t}" ` +
            `data-id="${esc(entry.id)}">${match}</button>`
        );
    });
}

export interface LookupResult {
    e?: IndexEntry;
    /** The cleaned-up query. */
    q: string;
}

/**
 * Looks up highlighted text, also trying simple singular forms
 * ("ventricles" -> "ventricle"). Returns null for empty input.
 */
export function lookup(raw: string): LookupResult | null {
    const query = raw
        .toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/[^a-z0-9À-ÿ'ε/\- ]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^'+|'+$/g, "");
    if (!query) return null;
    const tries = [query];
    if (query.endsWith("'s")) tries.push(query.slice(0, -2));
    if (query.endsWith("ies")) tries.push(query.slice(0, -3) + "y");
    if (query.endsWith("es")) tries.push(query.slice(0, -2));
    if (query.endsWith("s")) tries.push(query.slice(0, -1));
    for (const attempt of tries) {
        if (INDEX[attempt]) return { e: INDEX[attempt], q: query };
    }
    return { q: query };
}
