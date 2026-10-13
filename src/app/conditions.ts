// Psychological disorders and neurological diseases, and which brain
// structures each one involves.
import { S } from "./structures";
import type {
    Condition,
    ConditionData,
    ConditionExtension,
    ConditionKind,
    ConditionText,
    Involvement,
} from "./types";

export const CONDITION_TEXT_FIELDS: (keyof ConditionText)[] = [
    "name",
    "short",
    "cat",
    "aka",
    "summary",
    "overview",
    "brain",
    "symptoms",
    "diagnosis",
    "types",
    "causes",
    "treatment",
    "course",
    "prevalence",
    "fact",
];

/** Every condition by key, e.g. CONDS["psych:adhd"]. */
export const CONDS: Record<string, Condition> = {};
/** For each structure id, the conditions that list it. */
export const LINKED: Record<string, { c: Condition; lv: Involvement }[]> = {};
/** Disorders and diseases in their original (category) order. */
export const PSYCH: Condition[] = [];
export const DISEASES: Condition[] = [];

/**
 * Builds CONDS and LINKED. Must run after the structure tree exists,
 * because brain areas are checked against it.
 */
export function buildConditions(
    psych: ConditionData[],
    diseases: ConditionData[],
): void {
    const prepare = (data: ConditionData, kind: ConditionKind): Condition => {
        const key = kind + ":" + data.id;
        const condition: Condition = {
            ...data,
            kind,
            key,
            helpFact: false,
            en: {},
        };
        CONDS[key] = condition;
        return condition;
    };
    psych.forEach((data) => PSYCH.push(prepare(data, "psych")));
    diseases.forEach((data) => DISEASES.push(prepare(data, "disease")));

    for (const condition of Object.values(CONDS)) {
        condition.brain = knownAreas(condition);
        for (const [id, lv] of condition.brain) {
            (LINKED[id] = LINKED[id] || []).push({ c: condition, lv });
        }
        for (const field of CONDITION_TEXT_FIELDS) {
            if (condition[field] != null) {
                (condition.en as Record<string, unknown>)[field] =
                    structuredClone(condition[field]);
            }
        }
        condition.helpFact = !!condition.fact?.startsWith("If you");
    }
}

/** A condition's brain areas, dropping (and reporting) unknown ids. */
function knownAreas(condition: Condition): Condition["brain"] {
    return condition.brain.filter(([id]) => {
        if (S[id]) return true;
        console.warn("Unknown structure", id, "in", condition.id);
        return false;
    });
}

let writeUpsMerged = false;

export function hasWriteUps(): boolean {
    return writeUpsMerged;
}

/**
 * Lays the long-form write-ups over the short summaries. They cover the
 * same brain areas with longer notes, so the links between structures
 * and conditions don't change. Re-apply the content language afterwards.
 */
export function mergeWriteUps(
    writeUps: Record<string, ConditionExtension>,
): void {
    if (writeUpsMerged) return;
    writeUpsMerged = true;
    for (const [key, writeUp] of Object.entries(writeUps)) {
        const condition = CONDS[key];
        if (!condition) continue;
        Object.assign(condition, writeUp, { extended: true });
        condition.brain = knownAreas(condition);
        const english = condition.en as Record<string, unknown>;
        for (const field of Object.keys(writeUp) as (keyof ConditionText)[]) {
            english[field] = structuredClone(condition[field]);
        }
    }
}
