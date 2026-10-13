// Procedural brain geometry. Nothing is loaded from a model file: each
// hemisphere is a deformed sphere whose surface is folded with noise and
// whose triangles are assigned to cortical regions by position. Deep
// structures are simple ellipsoids and tubes.
import {
    BufferGeometry,
    CatmullRomCurve3,
    Float32BufferAttribute,
    Matrix4,
    Quaternion,
    SphereGeometry,
    TubeGeometry,
    Vector3,
} from "three";
import { clamp, smoothstep as smooth } from "../app/util";

type Vec3 = [number, number, number];

/** Gaussian bump: 1 at x = 0, falling off with width s. */
const gauss = (x: number, s: number): number => Math.exp(-(x / s) * (x / s));

// Permutation table for Perlin noise, from a fixed seed so the brain
// looks the same on every visit.
const PERM = (() => {
    const p = [...Array(256).keys()];
    let seed = 1337;
    for (let i = 255; i > 0; i--) {
        seed = (seed * 16807) % 2147483647;
        const j = seed % (i + 1);
        const t = p[i];
        p[i] = p[j];
        p[j] = t;
    }
    return Uint8Array.from(p.concat(p));
})();

function grad(h: number, x: number, y: number, z: number): number {
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
}

/** Improved Perlin noise in 3D, roughly in [-1, 1]. */
function noise3(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const lerp = (a: number, b: number, t: number) => a + t * (b - a);
    const A = PERM[X] + Y;
    const AA = PERM[A] + Z;
    const AB = PERM[A + 1] + Z;
    const B = PERM[X + 1] + Y;
    const BA = PERM[B] + Z;
    const BB = PERM[B + 1] + Z;
    return lerp(
        lerp(
            lerp(
                grad(PERM[AA] & 15, x, y, z),
                grad(PERM[BA] & 15, x - 1, y, z),
                u,
            ),
            lerp(
                grad(PERM[AB] & 15, x, y - 1, z),
                grad(PERM[BB] & 15, x - 1, y - 1, z),
                u,
            ),
            v,
        ),
        lerp(
            lerp(
                grad(PERM[AA + 1] & 15, x, y, z - 1),
                grad(PERM[BA + 1] & 15, x - 1, y, z - 1),
                u,
            ),
            lerp(
                grad(PERM[AB + 1] & 15, x, y - 1, z - 1),
                grad(PERM[BB + 1] & 15, x - 1, y - 1, z - 1),
                u,
            ),
            v,
        ),
        w,
    );
}

/**
 * Cortical folding: broad rounded gyri separated by narrow sulci along
 * the zero-lines of warped noise. High = gyrus surface, low = sulcus.
 */
function folds(x: number, y: number, z: number): number {
    const k = 1.3;
    const wx = x + 0.35 * noise3(x * k + 3.1, y * k, z * k);
    const wy = y + 0.35 * noise3(x * k, y * k + 7.3, z * k);
    const wz = z + 0.35 * noise3(x * k, y * k, z * k + 11.7);
    const f = 4.1;
    const n1 = Math.abs(noise3(wx * f, wy * f * 1.1, wz * f));
    const n2 = Math.abs(noise3(wx * f * 1.9 + 5, wy * f * 1.9, wz * f * 1.9));
    const s1 = 1 - smooth(0, 0.17, n1);
    const s2 = 1 - smooth(0, 0.09, n2);
    const crown = smooth(0.17, 0.5, n1); // gentle rounding of each gyrus
    return 1 - (0.85 * s1 + 0.3 * s2 * (1 - s1)) + 0.12 * crown;
}

/**
 * Assigns a point on the hemisphere to a cortical part id. X is the
 * signed lateral coordinate (negative = medial face); ly and lz are the
 * undeformed up/down and front/back coordinates.
 */
function classifyCortex(X: number, Y: number, ly: number, lz: number): string {
    const zc = 0.28 - 0.25 * ly; // central sulcus
    const ys = -0.16 - 0.1 * lz; // lateral (Sylvian) fissure
    const zpo = -0.72 + 0.12 * ly; // parieto-occipital boundary
    const medial = X < -0.2;
    if (X < -0.45) {
        const cc = 0.34 - 0.5 * lz * lz; // cingulate band over the callosum
        if (lz > -0.62 && lz < 0.62 && ly > cc - 0.02 && ly < cc + 0.2) {
            return lz > 0.02 ? "acc" : "pcc";
        }
    }
    const lat = X < 0 ? X * 0.5 : X;
    if (lz < zpo) {
        if (medial) {
            const calc = -0.02 + 0.1 * (lz + 0.9); // calcarine sulcus
            if (Math.abs(ly - calc) < 0.09) return "v1";
            return ly > calc ? "cuneus" : "lingual";
        }
        if (lz < -1.08) return "v1";
        if (Y < -0.55 && X < 0.6) return "v4";
        if (X > 0.45 && ly < -0.02 && ly > -0.4 && lz > -0.98) return "v5";
        return "v2v3";
    }
    if (ly < ys && lz < 0.6 && (lat > 0.1 || (lz < 0.3 && ly < ys - 0.08))) {
        if (lz > 0.42) return "tpole";
        if (X < 0) return lz > 0.12 ? "entorhinal" : "parahippocampal";
        if (X < 0.5 && Y < -0.6) return "fusiform";
        if (ly > ys - 0.11) {
            if (lz < -0.22) return "wernicke";
            if (ly > ys - 0.06 && lz < 0.22) return "a1";
            return "stg";
        }
        if (ly > ys - 0.22) return "mtg";
        return "itg";
    }
    if (lz > zc) {
        if (lz < zc + 0.12) return "m1";
        if (lz < zc + 0.3) return medial ? "sma" : "premotor";
        if (Y < -0.5) return "ofc";
        if (lz > 1.0) return "fpole";
        if (medial) return Y < 0.2 ? "vmpfc" : "dmpfc";
        if (ly > ys - 0.02 && ly < ys + 0.2 && lz < zc + 0.6) return "broca";
        if (ly < ys + 0.32) return "vlpfc";
        return "dlpfc";
    }
    if (lz > zc - 0.14) return "s1";
    if (medial) return "precuneus";
    if (ly > 0.36) return "spl";
    return lz > zc - 0.42 ? "supramarginal" : "angular";
}

/** Splits triangles into one non-indexed geometry per key. */
function geometriesByKey(
    groups: Record<string, { p: number[]; n: number[] }>,
): Record<string, BufferGeometry> {
    const geos: Record<string, BufferGeometry> = {};
    for (const key in groups) {
        const geo = new BufferGeometry();
        geo.setAttribute(
            "position",
            new Float32BufferAttribute(groups[key].p, 3),
        );
        geo.setAttribute(
            "normal",
            new Float32BufferAttribute(groups[key].n, 3),
        );
        geos[key] = geo;
    }
    return geos;
}

export interface Hemisphere {
    /** Geometry for each cortical part id. */
    geos: Record<string, BufferGeometry>;
    /** Share of each part's triangles on the medial face (0-1). */
    medialShare: Record<string, number>;
}

/** Builds one hemisphere; side is -1 for left, 1 for right. */
export function buildHemisphere(side: number): Hemisphere {
    const g = new SphereGeometry(1, 300, 210);
    const p = g.attributes.position;
    const n = p.count;
    // Per vertex: signed lateral X, original y, and the undeformed
    // ellipsoid y and z used to classify regions.
    const info = new Float32Array(n * 4);
    const A = 0.64;
    const B = 0.8;
    const C = 1.18;
    const OFF = 0.37;
    for (let i = 0; i < n; i++) {
        const ux = p.getX(i);
        const uy = p.getY(i);
        const uz = p.getZ(i);
        const X = ux * side;
        let lx = ux * A;
        let ly = uy * B;
        const lz = uz * C;
        const medial = X < 0;
        if (medial) lx *= 0.5;
        if (ly < 0) ly *= 0.88;
        const cly = ly;
        const clz = lz;
        let nx = lx / (A * A);
        let ny = ly / (B * B);
        let nz = lz / (C * C);
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        const lat = medial ? X * 0.5 : X;
        const tf = smooth(0.35, 1.18, lz);
        const to = smooth(-0.55, -1.18, lz);
        const sx = 1 - 0.13 * tf * tf - 0.16 * to * to;
        let sy = 1 - 0.08 * tf * tf - 0.1 * to;
        if (ly < 0) sy *= 1 - 0.28 * tf;
        if (ly > 0) sy *= 0.97;
        const ys0 = -0.16 - 0.1 * lz;
        // Temporal lobe tuck below the lateral fissure.
        const tw = medial
            ? 0
            : smooth(ys0 + 0.02, ys0 - 0.14, ly) *
              smooth(0.62, 0.38, lz) *
              smooth(-0.8, -0.55, lz) *
              clamp(lat * 2.2, 0, 1);
        let px = lx * sx;
        let py = ly * sy;
        let pz = lz;
        py -= 0.07 * tw;
        px += side * 0.045 * tw;
        pz += 0.02 * tw;
        // Surface displacement: folds, then the named sulci carved deeper.
        let d =
            0.085 * (folds(lx + side * 3, ly, lz) - 0.85) * (medial ? 0.6 : 1);
        const zc = 0.28 - 0.25 * ly;
        if (ly > -0.2) d -= 0.06 * gauss(lz - zc, 0.04);
        const ys = ys0;
        if (!medial && lz > -0.65 && lz < 0.62) {
            d -= 0.1 * gauss(ly - ys, 0.045) * Math.min(1, lat * 3);
        }
        if (!medial && lz > 0.3 && lz < 0.62) {
            d -= 0.05 * gauss(ly - (ys - 0.03), 0.06) * Math.min(1, lat * 3);
        }
        const zpo = -0.72 + 0.12 * ly;
        d -= 0.03 * gauss(lz - zpo, 0.04);
        if (lz > zc && ly > -0.2) d -= 0.022 * gauss(lz - (zc + 0.12), 0.03);
        if (lz < zc && lz > zpo && ly > -0.1) {
            d -= 0.022 * gauss(lz - (zc - 0.14), 0.03);
        }
        if (!medial && lz < zc - 0.14 && lz > zpo) {
            d -= 0.022 * gauss(ly - 0.36, 0.03) * Math.min(1, lat * 2);
        }
        if (!medial && lz > zc + 0.3 && ly > 0.05) {
            d -=
                0.02 *
                gauss(ly - (0.42 - 0.1 * lz), 0.03) *
                Math.min(1, lat * 2);
        }
        if (!medial && ly < ys && lz < 0.45 && lz > zpo) {
            d -= 0.024 * gauss(ly - (ys - 0.11), 0.025) * Math.min(1, lat * 2);
            d -= 0.02 * gauss(ly - (ys - 0.22), 0.025) * Math.min(1, lat * 2);
        }
        if (X < -0.2 && lz < zpo) {
            const calc = -0.02 + 0.1 * (lz + 0.9);
            d -= 0.032 * gauss(ly - calc, 0.03);
        }
        if (X < -0.45 && Math.abs(lz) < 0.62) {
            const cc = 0.34 - 0.5 * lz * lz;
            d -= 0.028 * gauss(ly - (cc + 0.2), 0.03);
        }
        p.setXYZ(i, px + side * OFF + nx * d, py + ny * d, pz + nz * d);
        info[i * 4] = X;
        info[i * 4 + 1] = uy;
        info[i * 4 + 2] = cly;
        info[i * 4 + 3] = clz;
    }
    g.computeVertexNormals();

    const idx = g.index!.array;
    const pos = p.array;
    const nor = g.attributes.normal.array;
    const out: Record<
        string,
        { p: number[]; n: number[]; medial: number; total: number }
    > = {};
    for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t];
        const b = idx[t + 1];
        const c = idx[t + 2];
        const X = (info[a * 4] + info[b * 4] + info[c * 4]) / 3;
        const key = classifyCortex(
            X,
            (info[a * 4 + 1] + info[b * 4 + 1] + info[c * 4 + 1]) / 3,
            (info[a * 4 + 2] + info[b * 4 + 2] + info[c * 4 + 2]) / 3,
            (info[a * 4 + 3] + info[b * 4 + 3] + info[c * 4 + 3]) / 3,
        );
        const o =
            out[key] || (out[key] = { p: [], n: [], medial: 0, total: 0 });
        o.total++;
        if (X < -0.2) o.medial++;
        for (const v of [a, b, c]) {
            o.p.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
            o.n.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
        }
    }
    g.dispose();
    const medialShare: Record<string, number> = {};
    for (const key in out) medialShare[key] = out[key].medial / out[key].total;
    return { geos: geometriesByKey(out), medialShare };
}

/**
 * A primitive plus per-vertex coordinates (`aux`, `stride` floats each)
 * that split() uses to divide it into parts.
 */
export interface SplittablePrimitive {
    g: BufferGeometry;
    aux: Float32Array;
    stride: number;
}

/** An ellipsoid at center c with radii s; aux = unit-sphere position. */
export function ellipsoid(
    c: Vec3,
    s: Vec3,
    segments = 36,
): SplittablePrimitive {
    const g = new SphereGeometry(1, segments, Math.round(segments * 0.7));
    const aux = Float32Array.from(g.attributes.position.array);
    g.applyMatrix4(
        new Matrix4().compose(
            new Vector3(...c),
            new Quaternion(),
            new Vector3(...s),
        ),
    );
    return { g, aux, stride: 3 };
}

/**
 * A tube along a smooth curve through `points`. aux = [position along
 * the tube (0-1), unit offset from the center line x, y, z].
 */
export function tube(
    points: Vec3[],
    radius: number,
    segments = 64,
    radial = 16,
    scaleX?: number,
): SplittablePrimitive {
    const curve = new CatmullRomCurve3(points.map((a) => new Vector3(...a)));
    const g = new TubeGeometry(curve, segments, radius, radial, false);
    const P = g.attributes.position;
    const n = P.count;
    const aux = new Float32Array(n * 4);
    const v = new Vector3();
    for (let i = 0; i < n; i++) {
        const u = Math.floor(i / (radial + 1)) / segments;
        const center = curve.getPointAt(Math.min(1, u));
        v.fromBufferAttribute(P, i).sub(center).divideScalar(radius);
        aux[i * 4] = u;
        aux[i * 4 + 1] = v.x;
        aux[i * 4 + 2] = v.y;
        aux[i * 4 + 3] = v.z;
    }
    if (scaleX && scaleX !== 1) {
        g.applyMatrix4(new Matrix4().makeScale(scaleX, 1, 1));
    }
    return { g, aux, stride: 4 };
}

/**
 * Divides a primitive into parts: `partOf` receives each triangle's
 * averaged aux coordinates and returns a part id (or null to drop it).
 */
export function split(
    primitive: SplittablePrimitive,
    partOf: (c: number[]) => string | null,
): Record<string, BufferGeometry> {
    const { g, aux, stride } = primitive;
    const idx = g.index ? g.index.array : null;
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal.array;
    const triangles = idx ? idx.length / 3 : pos.length / 9;
    const out: Record<string, { p: number[]; n: number[] }> = {};
    const c = new Array<number>(stride);
    for (let t = 0; t < triangles; t++) {
        const a = idx ? idx[t * 3] : t * 3;
        const b = idx ? idx[t * 3 + 1] : t * 3 + 1;
        const d = idx ? idx[t * 3 + 2] : t * 3 + 2;
        for (let j = 0; j < stride; j++) {
            c[j] =
                (aux[a * stride + j] +
                    aux[b * stride + j] +
                    aux[d * stride + j]) /
                3;
        }
        const key = partOf(c);
        if (!key) continue;
        const o = out[key] || (out[key] = { p: [], n: [] });
        for (const v of [a, b, d]) {
            o.p.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
            o.n.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
        }
    }
    return geometriesByKey(out);
}

export { gauss };
