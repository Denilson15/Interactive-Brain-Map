// The structure tree: whole brain -> hemispheres / deep structures /
// hindbrain -> regions -> groups -> parts. Cortical regions exist once in
// the data but appear under both hemispheres, so tree positions are
// identified by keys like "frontal@L" (see keyOf).
import { Color } from "three";
import type {
    AtlasData,
    HierarchyData,
    Side,
    StructureData,
    StructureNode,
    StructureText,
} from "./types";

/** Regions of the cerebral cortex; these sit under each hemisphere. */
export const CORTEX_TOPS = [
    "frontal",
    "parietal",
    "temporal",
    "occipital",
    "insula",
    "cingulate",
];

/** Regions buried beneath the cortex, under "Deep structures". */
export const DEEP_TOPS = [
    "basalganglia",
    "thalamus",
    "hypothalamus",
    "hippocampus",
    "amygdala",
    "callosum",
    "ventricles",
];

/** Fixed part colors where a hue shift of the region color reads badly. */
const PART_COLORS: Record<string, string[]> = {
    callosum: ["#F6E7C1", "#E9C98F", "#D3E0F2", "#B8CBEA"],
    ventricles: ["#5DA9E9", "#8EC5F5", "#3C86CF", "#A9D4FF"],
};

/** Text fields that the Spanish overlay can replace. */
export const STRUCTURE_TEXT_FIELDS: (keyof StructureText)[] = [
    "name",
    "short",
    "kind",
    "aka",
    "where",
    "summary",
    "does",
    "damage",
    "clinical",
    "fact",
];

/** Every node by id. */
export const S: Record<string, StructureNode> = {};
/** Group id for each part that belongs to a group. */
export const groupOf: Record<string, string> = {};

function makeNode(
    data: StructureData,
    extra: Partial<StructureNode>,
): StructureNode {
    return {
        ...data,
        color: data.color ?? "",
        kids: [],
        meshes: [],
        en: {},
        ...extra,
    };
}

/** Builds the tree into S. Call once, before anything reads it. */
export function buildStructureTree(
    atlas: AtlasData,
    hierarchy: HierarchyData,
): void {
    const tops: StructureNode[] = [];
    for (const data of atlas.tops) {
        const node = makeNode(data, { isTop: true, leaves: [] });
        tops.push(node);
        S[node.id] = node;
    }
    for (const data of atlas.subs) {
        const node = makeNode(data, { isTop: false, isLeaf: true });
        S[node.id] = node;
        S[data.parent!].leaves!.push(node);
    }

    // Each part gets a shade of its region's color, spread around its hue
    // so neighboring parts stay distinguishable.
    for (const top of tops) {
        const hsl = { h: 0, s: 0, l: 0 };
        new Color(top.color).getHSL(hsl);
        const leaves = top.leaves!;
        const n = leaves.length;
        leaves.forEach((leaf, i) => {
            const fixed = PART_COLORS[top.id];
            if (fixed) {
                leaf.color = fixed[i % 4];
                return;
            }
            const offset = n > 1 ? i / (n - 1) - 0.5 : 0;
            const h = (hsl.h + offset * 0.13 + 1) % 1;
            const l = Math.min(
                0.76,
                Math.max(0.4, hsl.l + ((i % 3) - 1) * 0.13),
            );
            const s = Math.min(0.85, hsl.s * 0.85 + 0.05);
            leaf.color = "#" + new Color().setHSL(h, s, l).getHexString();
        });
    }

    S.brain = makeNode(hierarchy.root, { isRoot: true });
    for (const hemi of hierarchy.hemis) {
        S[hemi.id] = makeNode(hemi, { isHemi: true, lat: true });
    }
    S.deep = makeNode(hierarchy.deep, { isGroupRoot: true });

    for (const data of hierarchy.groups) {
        const group = makeNode(data, { isGroup: true, topId: data.parent });
        group.kids = data.kids!.map((id) => S[id]);
        for (const kid of group.kids) {
            groupOf[kid.id] = group.id;
            kid.tparent = group.id;
        }
        group.color = group.kids[Math.floor(group.kids.length / 2)].color;
        S[group.id] = group;
    }

    // A region's children are its groups (in order of first member) and
    // any parts that aren't in a group.
    for (const top of tops) {
        const added = new Set<string>();
        for (const leaf of top.leaves!) {
            leaf.topId = top.id;
            const groupId = groupOf[leaf.id];
            if (groupId) {
                if (!added.has(groupId)) {
                    top.kids.push(S[groupId]);
                    added.add(groupId);
                    S[groupId].tparent = top.id;
                }
            } else {
                top.kids.push(leaf);
                leaf.tparent = top.id;
            }
        }
        top.topId = top.id;
    }

    S.brain.kids = [S.hemiL, S.hemiR, S.deep, S.cerebellum, S.brainstem];
    S.hemiL.kids = CORTEX_TOPS.map((id) => S[id]);
    S.hemiR.kids = S.hemiL.kids;
    S.deep.kids = DEEP_TOPS.map((id) => S[id]);
    for (const id of DEEP_TOPS) S[id].tparent = "deep";
    for (const id of ["cerebellum", "brainstem", "deep", "hemiL", "hemiR"]) {
        S[id].tparent = "brain";
    }
    const markLateral = (node: StructureNode): void => {
        node.lat = true;
        node.kids.forEach(markLateral);
    };
    for (const id of CORTEX_TOPS) markLateral(S[id]);

    for (const node of Object.values(S)) {
        for (const field of STRUCTURE_TEXT_FIELDS) {
            if (node[field] != null) {
                (node.en as Record<string, unknown>)[field] = structuredClone(
                    node[field],
                );
            }
        }
    }
}

/** Parent id in the tree; cortical regions hang under a hemisphere. */
export function parentOf(id: string, side: Side): string | null {
    if (CORTEX_TOPS.includes(id)) return side === "R" ? "hemiR" : "hemiL";
    return S[id].tparent || null;
}

/** Tree key: lateralized nodes get a side suffix, e.g. "frontal@L". */
export function keyOf(id: string, side: Side): string {
    return S[id].lat && !S[id].isHemi ? id + "@" + side : id;
}

export function parseKey(key: string): { id: string; side: Side | null } {
    const at = key.indexOf("@");
    if (at < 0) return { id: key, side: null };
    return { id: key.slice(0, at), side: key.slice(at + 1) as Side };
}

/** Keys from a node up to the whole brain, starting with the node. */
export function pathKeys(id: string, side: Side): string[] {
    const out: string[] = [];
    let current: string | null = id;
    while (current) {
        out.push(keyOf(current, side));
        current = parentOf(current, side);
    }
    return out;
}

export function depthOf(id: string, side: Side): number {
    return pathKeys(id, side).length - 1;
}

export function isLeafNode(id: string): boolean {
    return !S[id].kids || !S[id].kids.length;
}

export function colorOfKey(key: string): string {
    return S[parseKey(key).id].color;
}

/** The node and all nodes below it, as ids. */
export function descendantIds(
    node: StructureNode,
    acc: string[] = [],
): string[] {
    acc.push(node.id);
    for (const kid of node.kids || []) descendantIds(kid, acc);
    return acc;
}
