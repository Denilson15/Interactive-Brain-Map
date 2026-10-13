// Shapes of the content files and of the runtime structure tree.
import type * as THREE from "three";

/** Which half of the brain a lateralized part is on. */
export type Side = "L" | "R";
/** Meshes on the midline belong to both sides ("B"). */
export type MeshSide = Side | "B";
/**
 * Render layer of a mesh: the folded cortex, the outer "shell" of
 * non-cortical surface parts (cerebellum, brainstem, olfactory bulb),
 * or structures buried inside.
 */
export type Layer = "cortex" | "shell" | "inner";
/** How strongly a condition involves a brain area: primary or secondary. */
export type Involvement = "p" | "s";

/** Text fields of a structure that the Spanish overlay can replace. */
export interface StructureText {
    name: string;
    short?: string;
    kind?: string;
    aka?: string[];
    where?: string;
    summary?: string;
    does?: string[];
    damage?: string;
    clinical?: string;
    fact?: string;
}

/** A structure as written in anatomy.js and hierarchy.js. */
export interface StructureData extends StructureText {
    id: string;
    color?: string;
    /** Parent id: a top-level region for parts, or a region for groups. */
    parent?: string;
    /** Display grouping on a top-level region (e.g. "surface"). */
    group?: string;
    /** Hemispheres only. */
    side?: Side;
    /** Groups only: ids of the parts in the group. */
    kids?: string[];
}

export interface AtlasData {
    tops: StructureData[];
    subs: StructureData[];
}

export interface HierarchyData {
    root: StructureData;
    hemis: StructureData[];
    deep: StructureData;
    groups: StructureData[];
}

/** One brain area a condition affects: [structure id, level, note]. */
export type BrainArea = [string, Involvement, string];

/** Text fields of a condition that the Spanish overlay can replace. */
export interface ConditionText {
    name: string;
    short?: string;
    cat: string;
    aka?: string[];
    summary: string;
    overview?: string[];
    brain: BrainArea[];
    symptoms: string[];
    diagnosis?: string | string[];
    types?: string | string[];
    causes: string | string[];
    treatment: string | string[];
    course?: string | string[];
    prevalence: string;
    fact?: string;
}

/** A condition as written in psych.js / diseases.js. */
export interface ConditionData extends ConditionText {
    id: string;
}

/** Long-form write-up fields from ext_*.js, merged over the summary. */
export type ConditionExtension = Partial<ConditionText>;

/** Dictionary entry: [term, definition, other names]. */
export type GlossaryData = [string, string, string[]];

/** Spanish overlay for a condition; brain notes are keyed by area id. */
export type ConditionOverlay = Partial<Omit<ConditionText, "brain">> & {
    brain?: Record<string, string>;
};

export interface SpanishData {
    ui: Record<string, string>;
    nodes: Record<string, Partial<StructureText>>;
    conds: Record<string, ConditionOverlay>;
    /** English term -> [Spanish term, definition, other names]. */
    glossary: Record<string, [string, string, string[]?]>;
    /** English category name -> Spanish category name. */
    cats: Record<string, string>;
}

/** Per-mesh data stored on mesh.userData. */
export interface MeshInfo {
    /** Id of the leaf structure this mesh belongs to. */
    leaf: string;
    /** Id of the top-level region the leaf belongs to. */
    top: string;
    layer: Layer;
    side: MeshSide;
    solid: THREE.MeshStandardMaterial;
    holo: THREE.ShaderMaterial;
    /** Direction and distance this mesh moves when the model is spread. */
    off: THREE.Vector3;
    /** Keys from this mesh's leaf up to the whole brain. */
    path: string[];
}

export type BrainMesh = THREE.Mesh & { userData: MeshInfo };

/** A node of the runtime structure tree (see structures.ts). */
export interface StructureNode extends Omit<StructureData, "kids"> {
    color: string;
    kids: StructureNode[];
    meshes: BrainMesh[];
    /** Top-level regions only: every leaf part, including grouped ones. */
    leaves?: StructureNode[];
    isRoot?: boolean;
    isHemi?: boolean;
    isGroupRoot?: boolean;
    isGroup?: boolean;
    isTop?: boolean;
    isLeaf?: boolean;
    /** Lateralized: exists separately in each hemisphere. */
    lat?: boolean;
    /** Mostly on the inner (medial) face of the hemisphere. */
    medial?: boolean;
    layer?: Layer;
    topId?: string;
    /** Parent in the tree (cortical regions use the hemisphere instead). */
    tparent?: string;
    /** English text, kept so the language can be switched back. */
    en: Partial<StructureText>;
}

export type ConditionKind = "psych" | "disease";

/** A condition at runtime, with its long-form write-up merged in. */
export interface Condition extends ConditionData {
    kind: ConditionKind;
    /** Unique key, e.g. "psych:adhd". */
    key: string;
    extended?: boolean;
    /** True when the closing fact is advice on getting help. */
    helpFact: boolean;
    /** English text, kept so the language can be switched back. */
    en: Partial<ConditionText>;
}
