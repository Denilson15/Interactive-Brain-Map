// Loads the study content (YAML files in src/content/, turned into
// modules at build time) and switches its language. Core English content
// ships with the app; long write-ups and Spanish load on demand.
import diseasesFile from "../content/en/diseases.yaml";
import anatomyFile from "../content/en/anatomy.yaml";
import glossaryFile from "../content/en/glossary.yaml";
import hierarchyFile from "../content/en/hierarchy.yaml";
import psychologyFile from "../content/en/psychology.yaml";
import { CONDITION_TEXT_FIELDS, CONDS } from "./conditions";
import { STRUCTURE_TEXT_FIELDS, S } from "./structures";
import type {
    AtlasData,
    BrainArea,
    ConditionData,
    ConditionExtension,
    ConditionOverlay,
    GlossaryData,
    HierarchyData,
    SpanishData,
    StructureData,
    StructureText,
} from "./types";

/* ---------- shapes of the YAML files ---------- */

interface AreaFile {
    area: string;
    level: "primary" | "secondary";
    note: string;
}

type ConditionFile = Omit<ConditionData, "brain"> & { brain: AreaFile[] };
type WriteUpFile = Omit<ConditionExtension, "brain"> & { brain?: AreaFile[] };

interface TermFile {
    term: string;
    definition: string;
    aka?: string[];
}

interface HierarchyFile {
    root: StructureData;
    hemispheres: StructureData[];
    deep: StructureData;
    groups: StructureData[];
}

/* ---------- conversion to runtime shapes ---------- */

const toAreas = (areas: AreaFile[]): BrainArea[] =>
    areas.map(({ area, level, note }) => [
        area,
        level === "primary" ? "p" : "s",
        note,
    ]);

const toCondition = (c: ConditionFile): ConditionData => ({
    ...c,
    brain: toAreas(c.brain),
});

const toWriteUp = (w: WriteUpFile): ConditionExtension =>
    w.brain ? { ...w, brain: toAreas(w.brain) } : (w as ConditionExtension);

export interface CoreContent {
    atlas: AtlasData;
    hierarchy: HierarchyData;
    psych: ConditionData[];
    diseases: ConditionData[];
    glossary: GlossaryData[];
}

/** English content needed to start: structures, conditions, glossary. */
export function loadCoreContent(): CoreContent {
    const anatomy = anatomyFile as {
        regions: StructureData[];
        parts: StructureData[];
    };
    const hierarchy = hierarchyFile as HierarchyFile;
    return {
        atlas: { tops: anatomy.regions, subs: anatomy.parts },
        hierarchy: {
            root: hierarchy.root,
            hemis: hierarchy.hemispheres,
            deep: hierarchy.deep,
            groups: hierarchy.groups,
        },
        psych: (psychologyFile as ConditionFile[]).map(toCondition),
        diseases: (diseasesFile as ConditionFile[]).map(toCondition),
        glossary: (glossaryFile as TermFile[]).map(
            ({ term, definition, aka }) => [term, definition, aka ?? []],
        ),
    };
}

let writeUps: Promise<Record<string, ConditionExtension>> | null = null;

/**
 * Downloads the long-form condition write-ups once, keyed like
 * CONDS ("psych:adhd"); later calls reuse the same download. A failed
 * download is forgotten, so the next call tries again.
 */
export function loadWriteUps(): Promise<Record<string, ConditionExtension>> {
    writeUps ??= import("../content/write-ups").then((files) => {
        const out: Record<string, ConditionExtension> = {};
        const add = (kind: string, file: unknown) => {
            const entries = Object.entries(file as Record<string, WriteUpFile>);
            for (const [id, w] of entries) out[kind + ":" + id] = toWriteUp(w);
        };
        add("psych", files.psychology);
        add("disease", files.diseases);
        return out;
    });
    writeUps.catch(() => (writeUps = null));
    return writeUps;
}

let spanish: Promise<SpanishData> | null = null;

/**
 * Downloads the Spanish content once; later calls reuse it. A failed
 * download is forgotten, so the next call tries again.
 */
export function loadSpanish(): Promise<SpanishData> {
    spanish ??= import("../content/spanish").then((files) => {
        const terms = files.glossary as Record<string, TermFile>;
        return {
            ui: files.ui as Record<string, string>,
            nodes: files.structures as Record<string, Partial<StructureText>>,
            conds: files.conditions as Record<string, ConditionOverlay>,
            cats: files.categories as Record<string, string>,
            glossary: Object.fromEntries(
                Object.entries(terms).map(([english, t]) => [
                    english,
                    [t.term, t.definition, t.aka],
                ]),
            ),
        };
    });
    spanish.catch(() => (spanish = null));
    return spanish;
}

/**
 * Puts every structure and condition back to English, then lays the
 * Spanish text over it when `es` is given.
 */
export function applyContentLanguage(es: SpanishData | null): void {
    const nodeText = es?.nodes ?? {};
    const conditionText = es?.conds ?? {};
    const categories = es?.cats ?? {};

    for (const node of Object.values(S)) {
        const fields = node as unknown as Record<string, unknown>;
        const english = node.en as Record<string, unknown>;
        const overlay = nodeText[node.id] as Record<string, unknown>;
        for (const field of STRUCTURE_TEXT_FIELDS) {
            if (english[field] != null) {
                fields[field] = structuredClone(english[field]);
            }
            if (overlay?.[field] != null) {
                fields[field] = structuredClone(overlay[field]);
            }
        }
    }

    for (const condition of Object.values(CONDS)) {
        const fields = condition as unknown as Record<string, unknown>;
        const english = condition.en as Record<string, unknown>;
        for (const field of CONDITION_TEXT_FIELDS) {
            if (english[field] != null) {
                fields[field] = structuredClone(english[field]);
            }
        }
        if (categories[condition.cat]) {
            condition.cat = categories[condition.cat];
        }
        const overlay = conditionText[condition.key];
        if (!overlay) continue;
        const overlayFields = overlay as Record<string, unknown>;
        for (const field of CONDITION_TEXT_FIELDS) {
            if (field === "brain" || field === "cat") continue;
            if (overlayFields[field] != null) {
                fields[field] = structuredClone(overlayFields[field]);
            }
        }
        const notes = overlay.brain;
        if (notes) {
            condition.brain = condition.brain.map(([id, lv, note]) => [
                id,
                lv,
                notes[id] || note,
            ]);
        }
    }
}

/** Dictionary terms in the given language: [term, definition, aka]. */
export function glossaryIn(
    glossary: GlossaryData[],
    es: SpanishData | null,
): GlossaryData[] {
    const terms = es?.glossary ?? {};
    return glossary.map(([term, definition, aka]) => {
        const overlay = terms[term];
        return overlay
            ? [overlay[0], overlay[1], overlay[2] || []]
            : [term, definition, aka];
    });
}
