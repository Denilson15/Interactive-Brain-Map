// Builds every brain mesh, links meshes to the structure tree, and
// works out where each structure sits: its center, label anchor, best
// viewing direction, and how far it moves when the model is spread.
import {
    Box3,
    Color,
    LatheGeometry,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    ShaderMaterial,
    SphereGeometry,
    Vector2,
    Vector3,
    AdditiveBlending,
    type BufferGeometry,
    type Scene,
} from "three";
import {
    CORTEX_TOPS,
    S,
    depthOf,
    parentOf,
    parseKey,
    pathKeys,
} from "../app/structures";
import type { BrainMesh, Layer, MeshSide, Side } from "../app/types";
import {
    buildHemisphere,
    ellipsoid,
    gauss,
    split,
    tube,
    type SplittablePrimitive,
} from "./procedural";

/** Model center the camera orbits at the whole-brain view. */
export const CENTER = new Vector3(0, -0.15, 0);
/** Starting camera position (scaled to the screen at first resize). */
export const HOME = new Vector3(-3.7, 1.5, 2.9);

/** Every brain mesh, in build order. */
export const MESHES: BrainMesh[] = [];

// "Hologram" look for parts outside the selection: a fresnel rim glow
// that can blend toward a solid, lit surface as opacity goes up.
const HOLO_VS = `
varying vec3 vN;
varying vec3 vV;
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
}`;
const HOLO_FS = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uSolid;
uniform float uBright;
varying vec3 vN;
varying vec3 vV;
void main() {
    vec3 n = normalize(vN);
    float ndv = abs(dot(n, normalize(vV)));
    float rim = pow(1.0 - ndv, 2.0);
    float l = 0.5 + 0.5 * max(dot(n, normalize(vec3(-0.4, 0.7, 0.6))), 0.0);
    vec3 glow = uColor * (0.32 + 0.45 * l) + uColor * rim * 1.1
        + vec3(0.12 * rim);
    vec3 lit = uColor * (0.38 + 0.62 * l) + vec3(0.08 * rim);
    vec3 c = mix(glow, lit, uSolid) * uBright;
    float a = mix(uOpacity * (0.4 + 1.5 * rim), 1.0, uSolid);
    gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
}`;

function hologramMaterial(): ShaderMaterial {
    return new ShaderMaterial({
        uniforms: {
            uColor: { value: new Color() },
            uOpacity: { value: 0.2 },
            uSolid: { value: 0 },
            uBright: { value: 1 },
        },
        vertexShader: HOLO_VS,
        fragmentShader: HOLO_FS,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
    });
}

let scene: Scene;

function addMesh(
    leafId: string,
    geo: BufferGeometry | undefined,
    side: MeshSide,
    layer: Layer,
): void {
    const leaf = S[leafId];
    if (!leaf || !geo) {
        console.warn("Missing leaf or geometry", leafId);
        return;
    }
    const solid = new MeshStandardMaterial({
        color: new Color(leaf.color),
        roughness: 0.55,
        metalness: 0.02,
    });
    const mesh = new Mesh(geo, solid) as unknown as BrainMesh;
    mesh.userData = {
        leaf: leafId,
        top: leaf.topId!,
        layer,
        side,
        solid,
        holo: hologramMaterial(),
        off: new Vector3(),
        path: [],
    };
    scene.add(mesh);
    MESHES.push(mesh);
    leaf.meshes.push(mesh);
    if (!leaf.layer) leaf.layer = layer;
}

function addSplit(
    primitive: SplittablePrimitive,
    partOf: (c: number[]) => string | null,
    side: MeshSide,
    layer: Layer,
): void {
    const geos = split(primitive, partOf);
    for (const key in geos) addMesh(key, geos[key], side, layer);
}

/** Runs fn for the left (-1, "L") and right (1, "R") sides. */
function bothSides(fn: (s: number, side: Side) => void): void {
    fn(-1, "L");
    fn(1, "R");
}

type Vec3 = [number, number, number];
const mirror = (points: Vec3[], s: number): Vec3[] =>
    points.map((a) => [a[0] * s, a[1], a[2]]);

/** Builds all meshes into the scene and links them to the tree. */
export function buildModel(target: Scene): void {
    scene = target;

    bothSides((s, SD) => {
        const { geos, medialShare } = buildHemisphere(s);
        for (const k in geos) {
            addMesh(k, geos[k], SD, "cortex");
            if (s < 0) S[k].medial = medialShare[k] > 0.6;
        }
    });
    bothSides((s, SD) => {
        addMesh(
            "olfactory",
            tube(
                [
                    [s * 0.17, -0.57, 0.3],
                    [s * 0.17, -0.52, 0.56],
                    [s * 0.17, -0.44, 0.74],
                ],
                0.016,
                24,
                10,
            ).g,
            SD,
            "shell",
        );
        addMesh(
            "olfactory",
            ellipsoid([s * 0.17, -0.43, 0.78], [0.032, 0.024, 0.055], 20).g,
            SD,
            "shell",
        );
    });
    bothSides((s, SD) =>
        addSplit(
            ellipsoid([s * 0.74, -0.1, 0.08], [0.045, 0.17, 0.27]),
            (c) => (c[2] > 0 ? "antinsula" : "postinsula"),
            SD,
            "cortex",
        ),
    );
    buildCerebellum();
    bothSides((s, SD) =>
        addMesh(
            "dentate",
            ellipsoid([s * 0.24, -0.64, -0.76], [0.07, 0.045, 0.07], 24).g,
            SD,
            "inner",
        ),
    );
    buildBrainstem();
    addMesh(
        "vta",
        ellipsoid([0, -0.52, -0.15], [0.035, 0.022, 0.03], 20).g,
        "B",
        "inner",
    );
    bothSides((s, SD) =>
        addMesh(
            "lc",
            ellipsoid([s * 0.045, -0.7, -0.32], [0.016, 0.05, 0.016], 14).g,
            SD,
            "inner",
        ),
    );
    addMesh(
        "raphe",
        ellipsoid([0, -0.74, -0.27], [0.013, 0.24, 0.02], 20).g,
        "B",
        "inner",
    );
    bothSides((s, SD) => {
        const caudatePath: Vec3[] = [
            [0.15, 0.04, 0.38],
            [0.18, 0.14, 0.22],
            [0.2, 0.18, 0],
            [0.22, 0.13, -0.22],
            [0.27, 0, -0.38],
            [0.32, -0.15, -0.36],
            [0.34, -0.25, -0.2],
        ];
        addMesh(
            "caudate",
            tube(mirror(caudatePath, s), 0.032, 60, 12).g,
            SD,
            "inner",
        );
        addMesh(
            "caudate",
            ellipsoid([s * 0.16, 0.06, 0.3], [0.06, 0.08, 0.1], 28).g,
            SD,
            "inner",
        );
        addMesh(
            "putamen",
            ellipsoid([s * 0.3, -0.05, 0.06], [0.055, 0.12, 0.2], 32).g,
            SD,
            "inner",
        );
        addMesh(
            "gp",
            ellipsoid([s * 0.22, -0.07, 0.02], [0.035, 0.08, 0.11], 28).g,
            SD,
            "inner",
        );
        addMesh(
            "nacc",
            ellipsoid([s * 0.12, -0.14, 0.27], [0.045, 0.04, 0.055], 22).g,
            SD,
            "inner",
        );
        addMesh(
            "stn",
            ellipsoid([s * 0.1, -0.18, -0.1], [0.03, 0.022, 0.045], 18).g,
            SD,
            "inner",
        );
        addMesh(
            "sn",
            ellipsoid([s * 0.075, -0.49, -0.17], [0.05, 0.02, 0.04], 20).g,
            SD,
            "inner",
        );
    });
    bothSides((s, SD) => {
        addSplit(
            ellipsoid([s * 0.11, -0.03, -0.12], [0.1, 0.09, 0.17], 40),
            (c) => {
                const X = c[0] * s;
                if (c[2] > 0.6) return "antthal";
                if (c[2] < -0.5) return "pulvinar";
                if (X < -0.15 && c[1] > -0.3) return "mdthal";
                return "ventthal";
            },
            SD,
            "inner",
        );
        addMesh(
            "lgn",
            ellipsoid([s * 0.19, -0.1, -0.24], [0.03, 0.025, 0.035], 16).g,
            SD,
            "inner",
        );
        addMesh(
            "mgn",
            ellipsoid([s * 0.12, -0.12, -0.29], [0.028, 0.024, 0.03], 16).g,
            SD,
            "inner",
        );
    });
    addMesh(
        "pineal",
        ellipsoid([0, 0, -0.34], [0.022, 0.02, 0.035], 16).g,
        "B",
        "inner",
    );
    addSplit(
        ellipsoid([0, -0.23, 0.08], [0.075, 0.06, 0.09], 32),
        (c) => {
            if (c[2] > 0.5) return "scn";
            if (c[1] < -0.4) return "arcuate";
            if (Math.abs(c[0]) > 0.5) return "lateralhyp";
            return "pvn";
        },
        "B",
        "inner",
    );
    bothSides((s, SD) =>
        addMesh(
            "mammillary",
            ellipsoid([s * 0.03, -0.27, -0.04], [0.024, 0.024, 0.024], 16).g,
            SD,
            "inner",
        ),
    );
    addMesh(
        "pituitary",
        tube(
            [
                [0, -0.27, 0.1],
                [0, -0.32, 0.11],
                [0, -0.37, 0.12],
            ],
            0.012,
            12,
            8,
        ).g,
        "B",
        "inner",
    );
    addMesh(
        "pituitary",
        ellipsoid([0, -0.4, 0.12], [0.05, 0.035, 0.045], 20).g,
        "B",
        "inner",
    );
    bothSides((s, SD) => {
        const hippocampusPath: Vec3[] = [
            [0.37, -0.38, 0.13],
            [0.39, -0.36, -0.12],
            [0.35, -0.26, -0.37],
            [0.24, -0.12, -0.5],
        ];
        addSplit(
            tube(mirror(hippocampusPath, s), 0.055, 64, 18),
            (c) => {
                const medialness = -c[1] * s;
                if (c[2] < -0.55) return "subiculum";
                if (medialness > 0.45) return "dg";
                return "ca";
            },
            SD,
            "inner",
        );
        const fornixPath: Vec3[] = [
            [0.24, -0.12, -0.5],
            [0.16, 0.08, -0.42],
            [0.07, 0.17, -0.25],
            [0.035, 0.16, 0],
            [0.035, 0.05, 0.12],
            [0.035, -0.15, 0.03],
            [0.03, -0.25, -0.03],
        ];
        addMesh(
            "fornix",
            tube(mirror(fornixPath, s), 0.018, 80, 10).g,
            SD,
            "inner",
        );
    });
    bothSides((s, SD) =>
        addSplit(
            ellipsoid([s * 0.37, -0.38, 0.22], [0.075, 0.07, 0.08], 30),
            (c) => {
                const X = c[0] * s;
                if (X < -0.45) return "medamyg";
                if (c[1] > 0.35) return "cea";
                return "bla";
            },
            SD,
            "inner",
        ),
    );
    addSplit(
        tube(
            [
                [0, -0.08, 0.38],
                [0, 0.04, 0.54],
                [0, 0.2, 0.44],
                [0, 0.29, 0.12],
                [0, 0.28, -0.2],
                [0, 0.19, -0.44],
                [0, 0.05, -0.52],
            ],
            0.06,
            90,
            18,
            2.4,
        ),
        (c) =>
            c[0] < 0.1
                ? "rostrum"
                : c[0] < 0.27
                  ? "genu"
                  : c[0] < 0.8
                    ? "ccbody"
                    : "splenium",
        "B",
        "inner",
    );
    bothSides((s, SD) => {
        const ventriclePath: Vec3[] = [
            [0.07, 0.1, 0.36],
            [0.09, 0.17, 0.15],
            [0.1, 0.17, -0.15],
            [0.15, 0.1, -0.38],
            [0.18, 0, -0.5],
            [0.24, -0.08, -0.42],
            [0.3, -0.2, -0.25],
            [0.32, -0.28, -0.02],
        ];
        addMesh(
            "latvent",
            tube(mirror(ventriclePath, s), 0.03, 70, 12).g,
            SD,
            "inner",
        );
        const hornPath: Vec3[] = [
            [0.18, 0, -0.5],
            [0.18, -0.01, -0.58],
            [0.16, -0.03, -0.66],
        ];
        addMesh(
            "latvent",
            tube(mirror(hornPath, s), 0.022, 12, 10).g,
            SD,
            "inner",
        );
    });
    addMesh(
        "thirdvent",
        ellipsoid([0, -0.08, -0.06], [0.012, 0.1, 0.15], 24).g,
        "B",
        "inner",
    );
    addMesh(
        "aqueduct",
        tube(
            [
                [0, -0.2, -0.22],
                [0, -0.42, -0.27],
                [0, -0.62, -0.32],
            ],
            0.012,
            20,
            8,
        ).g,
        "B",
        "inner",
    );
    addMesh(
        "fourthvent",
        ellipsoid([0, -0.76, -0.4], [0.08, 0.09, 0.035], 22).g,
        "B",
        "inner",
    );

    linkMeshesToTree();
    computeSpreadOffsets();
}

/** Cerebellum: a flattened sphere with fine horizontal folia. */
function buildCerebellum(): void {
    const g = new SphereGeometry(1, 170, 120);
    const p = g.attributes.position;
    const aux = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const lx = x * 0.86;
        let ly = y * 0.36;
        const lz = z * 0.52;
        ly *= 1 - 0.25 * gauss(lx, 0.12) * (y > 0 ? 1 : 0.3);
        if (y > 0) ly *= 0.85 + 0.15 * Math.abs(x);
        let d =
            0.022 *
            (Math.pow(
                Math.abs(Math.sin(ly * 60 + lz * 9 + Math.sin(lx * 6) * 1.3)),
                0.5,
            ) -
                0.6);
        d -= 0.05 * gauss(lx, 0.06) * (lz < 0.1 ? 1 : 0.3);
        const L = Math.hypot(x, y, z) || 1;
        p.setXYZ(
            i,
            lx + (x / L) * d,
            ly + (y / L) * d - 0.62,
            lz + (z / L) * d - 0.84,
        );
        aux[i * 3] = lx;
        aux[i * 3 + 1] = ly;
        aux[i * 3 + 2] = lz;
    }
    g.computeVertexNormals();
    addSplit(
        { g, aux, stride: 3 },
        (c) =>
            Math.abs(c[0]) < 0.11
                ? "vermis"
                : c[2] > 0.2 && c[1] < -0.02 && Math.abs(c[0]) > 0.28
                  ? "flocculo"
                  : "cerebhemi",
        "B",
        "shell",
    );
}

/** Brainstem: a lathe profile split into midbrain, pons and medulla. */
function buildBrainstem(): void {
    const profile = [
        [0, 0.13],
        [0.12, 0.135],
        [0.2, 0.15],
        [0.28, 0.2],
        [0.4, 0.215],
        [0.5, 0.17],
        [0.6, 0.135],
        [0.85, 0.12],
        [1.05, 0.1],
        [1.07, 0.0],
    ];
    const lathe = new LatheGeometry(
        profile.map(([y, r]) => new Vector2(r, -y)),
        48,
    );
    const aux = Float32Array.from(lathe.attributes.position.array);
    const m = new Matrix4().makeRotationX(0.18);
    m.setPosition(new Vector3(0, -0.4, -0.24));
    lathe.applyMatrix4(m);
    lathe.computeVertexNormals();
    addSplit(
        { g: lathe, aux, stride: 3 },
        (c) => {
            const y = -c[1];
            if (y < 0.22) return "midbrain";
            if (y < 0.56) return "pons";
            return "medulla";
        },
        "B",
        "shell",
    );
}

/** Adds each mesh to every node on its path and fills in layers. */
function linkMeshesToTree(): void {
    for (const mesh of MESHES) {
        const { leaf, side } = mesh.userData;
        for (const key of pathKeys(leaf, side as Side)) {
            const { id } = parseKey(key);
            if (!S[id].meshes.includes(mesh)) S[id].meshes.push(mesh);
        }
    }
    for (const hemi of ["hemiL", "hemiR"]) {
        const side = S[hemi].side;
        S[hemi].meshes = MESHES.filter(
            (m) =>
                CORTEX_TOPS.includes(m.userData.top) &&
                m.userData.side === side,
        );
    }
    S.brain.meshes = MESHES.slice();
    for (const node of Object.values(S)) {
        if (node.layer) continue;
        const layers = new Set(node.meshes.map((m) => m.userData.layer));
        node.layer = layers.has("cortex")
            ? "cortex"
            : layers.size === 1 && layers.has("inner")
              ? "inner"
              : "shell";
    }
    S.cingulate.medial = true;
    for (const node of Object.values(S)) {
        if (!node.meshes.length) console.warn("No geometry for", node.id);
    }
    for (const mesh of MESHES) {
        mesh.userData.path = pathKeys(
            mesh.userData.leaf,
            mesh.userData.side as Side,
        );
    }
}

/* ---------- centers, anchors, spread offsets ---------- */

/** A node's meshes, limited to one side where that makes sense. */
export function meshesOf(id: string, side: Side | null): BrainMesh[] {
    const node = S[id];
    if (node.lat && !node.isHemi && side) {
        return node.meshes.filter((m) => m.userData.side === side);
    }
    if (side === "L" || side === "R") {
        const onSide = node.meshes.filter(
            (m) => m.userData.side === side || m.userData.side === "B",
        );
        return onSide.length ? onSide : node.meshes;
    }
    return node.meshes;
}

export function bbox(meshes: BrainMesh[]): Box3 {
    const box = new Box3();
    for (const m of meshes) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        box.union(m.geometry.boundingBox!);
    }
    return box;
}

const centers: Record<string, Vector3> = {};

export function centerOf(id: string, side: Side | null): Vector3 {
    const key = id + "|" + (side || "B");
    if (!centers[key]) {
        centers[key] =
            id === "brain"
                ? CENTER.clone()
                : bbox(meshesOf(id, side)).getCenter(new Vector3());
    }
    return centers[key];
}

export function radiusOf(id: string, side: Side | null): number {
    return bbox(meshesOf(id, side)).getSize(new Vector3()).length() / 2;
}

/** How far each tree level pushes away from its parent when spread. */
const SPREAD_BY_DEPTH = [0, 0.95, 1.0, 0.75, 0.6];

function offsetFor(id: string, side: Side | null): Vector3 {
    const o = new Vector3();
    let current: string | null = id;
    while (current && current !== "brain") {
        const parent: string = parentOf(current, side || "L")!;
        const depth = depthOf(current, side || "L");
        let k = SPREAD_BY_DEPTH[Math.min(depth, 4)];
        if (parent === "deep") k = 1.9;
        o.add(
            centerOf(current, side)
                .clone()
                .sub(centerOf(parent, side))
                .multiplyScalar(k),
        );
        current = parent;
    }
    return o;
}

/** Paired deep structures, which also separate left from right. */
function isBilateralInner(m: BrainMesh): boolean {
    return (
        m.userData.layer === "inner" &&
        m.userData.side !== "B" &&
        !CORTEX_TOPS.includes(m.userData.top)
    );
}

function computeSpreadOffsets(): void {
    for (const m of MESHES) {
        const { leaf, side } = m.userData;
        const o = offsetFor(leaf, side === "B" ? null : side);
        if (isBilateralInner(m)) o.x += (side === "L" ? -1 : 1) * 0.18;
        m.userData.off.copy(o);
    }
}

const nodeOffsets: Record<string, Vector3> = {};

/** Spread offset of a whole node (used to place labels and the camera). */
export function nodeOffset(id: string, side: Side): Vector3 {
    const key = id + "|" + side;
    if (nodeOffsets[key]) return nodeOffsets[key];
    const node = S[id];
    const allMidline = node.meshes.every((m) => m.userData.side === "B");
    const o = offsetFor(
        id,
        node.lat || node.isHemi ? side : allMidline ? null : side,
    );
    if (
        !(node.lat || node.isHemi) &&
        node.meshes.some(isBilateralInner) &&
        node.meshes.every((m) => m.userData.layer === "inner")
    ) {
        o.x += (side === "L" ? -1 : 1) * 0.18;
    }
    return (nodeOffsets[key] = o);
}

interface Anchor {
    p: Vector3;
    n: Vector3 | null;
}

/** Surface point nearest the meshes' centroid (sampling every 3rd). */
function centroidAnchor(meshes: BrainMesh[]): Anchor {
    const c = new Vector3();
    let count = 0;
    const v = new Vector3();
    for (const m of meshes) {
        const P = m.geometry.attributes.position;
        for (let i = 0; i < P.count; i += 3) {
            c.add(v.fromBufferAttribute(P, i));
            count++;
        }
    }
    c.divideScalar(count || 1);
    let best = Infinity;
    const bp = new Vector3();
    const bn = new Vector3();
    for (const m of meshes) {
        const P = m.geometry.attributes.position;
        const N = m.geometry.attributes.normal;
        for (let i = 0; i < P.count; i += 3) {
            v.fromBufferAttribute(P, i);
            const d = v.distanceToSquared(c);
            if (d < best) {
                best = d;
                bp.copy(v);
                bn.fromBufferAttribute(N, i);
            }
        }
    }
    return { p: bp, n: bn.normalize() };
}

/** Surface point furthest in a direction (sampling every 4th). */
function pickDir(meshes: BrainMesh[], dir: Vector3): Anchor {
    let best = -Infinity;
    const bp = new Vector3();
    const bn = new Vector3();
    const v = new Vector3();
    for (const m of meshes) {
        const P = m.geometry.attributes.position;
        const N = m.geometry.attributes.normal;
        for (let i = 0; i < P.count; i += 4) {
            v.fromBufferAttribute(P, i);
            const s = v.dot(dir);
            if (s > best) {
                best = s;
                bp.copy(v);
                bn.fromBufferAttribute(N, i);
            }
        }
    }
    return { p: bp, n: bn.normalize() };
}

/** Preferred viewing direction for regions (left side; x mirrors). */
const LOBE_DIR: Record<string, Vec3> = {
    frontal: [-0.45, 0.45, 0.75],
    parietal: [-0.45, 0.85, -0.3],
    temporal: [-1, -0.35, 0.15],
    occipital: [-0.35, 0.15, -1],
    cerebellum: [-0.55, -0.35, -0.8],
    brainstem: [-0.85, -0.45, 0.3],
    olfactory: [-0.35, -0.85, 0.45],
    hemiL: [-1, 0.75, 0.15],
    hemiR: [-1, 0.75, 0.15],
    insula: [-1, 0, 0.1],
};
/** Deep regions anchor their label on a representative part. */
const ANCHOR_CHILD: Record<string, string> = {
    hippocampus: "ca",
    ventricles: "latvent",
    hypothalamus: "pvn",
    callosum: "ccbody",
    deep: "thalamus",
};

const anchors: Record<string, Anchor | null> = {};
const facing: Record<string, Vector3 | null> = {};

function computeAnchor(
    id: string,
    side: Side,
): { a: Anchor; f: Vector3 } | null {
    const node = S[id];
    const sx = side === "L" ? 1 : -1;
    const ms = meshesOf(id, side);
    if (!ms.length) return null;
    let ld = LOBE_DIR[id];
    if (!ld && node.layer === "shell" && node.isLeaf) {
        ld = LOBE_DIR[id === "olfactory" ? "olfactory" : node.topId!];
    }
    const ldir = ld ? new Vector3(ld[0] * sx, ld[1], ld[2]).normalize() : null;
    let a: Anchor;
    let f: Vector3;
    if (id === "brain") {
        a = { p: CENTER.clone(), n: null };
        f = HOME.clone().sub(CENTER).normalize();
    } else if (ld && !(node.isLeaf && node.layer === "shell")) {
        a = pickDir(ms, ldir!);
        f = ldir!;
    } else if (node.layer === "cortex" || node.layer === "shell") {
        a = centroidAnchor(ms);
        const radial = a.p.clone().sub(CENTER).normalize();
        f = node.medial
            ? new Vector3(sx, 0.12, 0.05).normalize()
            : ldir ||
              a
                  .n!.clone()
                  .multiplyScalar(0.65)
                  .add(radial.multiplyScalar(0.35))
                  .normalize();
    } else {
        const child = ANCHOR_CHILD[id];
        const anchorMeshes = child ? meshesOf(child, side) : ms;
        a = node.isLeaf
            ? { p: bbox(ms).getCenter(new Vector3()), n: null }
            : pickDir(anchorMeshes, new Vector3(0, 1, 0.15).normalize());
        f = new Vector3(-0.8 * sx, 0.4, 0.45).normalize();
    }
    return { a, f };
}

/** Where a node's label attaches to the model. */
export function anchorOf(id: string, side: Side): Anchor | null {
    const key = id + "|" + side;
    if (!(key in anchors)) {
        const result = computeAnchor(id, side);
        anchors[key] = result ? result.a : null;
        facing[key] = result ? result.f : null;
    }
    return anchors[key];
}

/** Direction from which the camera looks at a node. */
export function facingOf(id: string, side: Side): Vector3 | null {
    anchorOf(id, side);
    return facing[id + "|" + side];
}
