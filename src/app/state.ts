// What the visitor is currently looking at. One shared object, so every
// module reads the same selection.
import type { Condition, ConditionKind, Involvement, Side } from "./types";

export type Tab = "browse" | "region" | "psych" | "disease" | "gloss";

export const state = {
    /** "structure": exploring anatomy; "condition": a condition's areas. */
    mode: "structure" as "structure" | "condition",
    /** Selected structure id and the side it was selected on. */
    sel: "brain",
    selSide: "L" as Side,
    /** Condition highlighted on the model (condition mode). */
    cond: null as Condition | null,
    /** Leaf id -> involvement level for the highlighted condition. */
    condMap: {} as Record<string, Involvement>,
    /** Cortical regions the condition involves as a whole. */
    condWhole: {} as Record<string, boolean>,
    /** Condition open in each list tab, if any. */
    openCond: { psych: null, disease: null } as Record<
        ConditionKind,
        Condition | null
    >,
    showLabels: true,
    /** Tree key under the mouse pointer. */
    hovered: null as string | null,
    activeTab: "region" as Tab,
    /** Spread (0-1), hologram opacity (0-1), and brightness multiplier. */
    spread: 0,
    opacity: 0.2,
    brightness: 1,
};
