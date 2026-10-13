// Loads the study content and switches its language. English loads with
// the app; Spanish loads only when a visitor chooses it.
import { CONDITION_TEXT_FIELDS, CONDS } from "./conditions";
import { STRUCTURE_TEXT_FIELDS, S } from "./structures";
import type {
    AtlasData,
    ConditionData,
    ConditionExtension,
    GlossaryData,
    HierarchyData,
    SpanishData,
} from "./types";

export interface CoreContent {
    atlas: AtlasData;
    hierarchy: HierarchyData;
    psych: ConditionData[];
    diseases: ConditionData[];
    glossary: GlossaryData[];
    extensions: Record<string, ConditionExtension>;
}

// The legacy content files assign globals; this reads them with types.
// Replaced by typed content modules later in the migration.
type LegacyWindow = Window & {
    ATLAS: AtlasData;
    HIER: HierarchyData;
    PSYCH: ConditionData[];
    DISEASES: ConditionData[];
    GLOSSARY: GlossaryData[];
    COND_EXT?: Record<string, ConditionExtension>;
    I18N_ES?: SpanishData;
};
const legacy = window as unknown as LegacyWindow;

export async function loadCoreContent(): Promise<CoreContent> {
    await import("../legacy-content");
    return {
        atlas: legacy.ATLAS,
        hierarchy: legacy.HIER,
        psych: legacy.PSYCH,
        diseases: legacy.DISEASES,
        glossary: legacy.GLOSSARY,
        extensions: legacy.COND_EXT ?? {},
    };
}

let spanish: Promise<SpanishData> | null = null;

/** Downloads the Spanish content once; later calls reuse it. */
export function loadSpanish(): Promise<SpanishData> {
    spanish ??= import("../legacy-spanish").then(() => legacy.I18N_ES!);
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
