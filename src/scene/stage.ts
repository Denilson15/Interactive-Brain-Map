// The 3D stage: renderer, camera and controls, how each mesh is drawn
// for the current selection, camera moves, picking, floating labels, the
// close-up viewer in the side panel, and the render loop.
import {
    Box3,
    Color,
    DirectionalLight,
    Group,
    HemisphereLight,
    Mesh,
    MeshStandardMaterial,
    NormalBlending,
    AdditiveBlending,
    PerspectiveCamera,
    Raycaster,
    Scene,
    Vector2,
    Vector3,
    WebGLRenderer,
    type Light,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { currentLang, t } from "../app/i18n";
import { state } from "../app/state";
import {
    S,
    colorOfKey,
    isLeafNode,
    keyOf,
    parentOf,
    parseKey,
    pathKeys,
} from "../app/structures";
import type { BrainMesh, Side } from "../app/types";
import { clamp, esc, isPhoneLayout, prefersReducedMotion } from "../app/util";
import { sheetHeight } from "../ui/bottom-sheet";
import {
    CENTER,
    HOME,
    MESHES,
    anchorOf,
    bbox,
    buildModel,
    type BuildProgress,
    centerOf,
    facingOf,
    meshesOf,
    nodeOffset,
    radiusOf,
} from "./model";

/** Colors for a condition's primary and secondary brain areas. */
export const HOT = "#FF5A47";
export const WARM = "#FFB23E";
const GHOST = new Color(0x8fa3bd);
/**
 * The color for "One color" mode: the soft peach the model already uses
 * for V5/MT, close to the look of unstained brain tissue.
 */
export const ONE_COLOR = "#e5ad9e";
const HOT_COLOR = new Color(HOT);
const WARM_COLOR = new Color(WARM);

export interface StageCallbacks {
    /** A structure was clicked on the model or its label. */
    onSelect(id: string, side: Side): void;
    /** Empty space was clicked while exploring anatomy. */
    onEmptyClick(): void;
    /** The device dropped (true) or restored (false) the 3D context. */
    onContextLost(lost: boolean): void;
}

let stageEl: HTMLElement;
let canvas: HTMLCanvasElement;
let renderer: WebGLRenderer;
const scene = new Scene();
const camera = new PerspectiveCamera(35, 1, 0.05, 80);
let controls: OrbitControls;
/** Main-scene lights with their base intensities (for Brightness). */
const lights: [Light, number][] = [];
/** Where the camera is flying to, if it is moving. */
let goal: { pos: Vector3; tgt: Vector3 } | null = null;
let callbacks: StageCallbacks;
/** True once WebGL is running and the model is built. */
let ready = false;

export function isStageReady(): boolean {
    return ready;
}

/** Why the 3D view couldn't start: no WebGL, or the build failed. */
export class StageError extends Error {
    constructor(
        readonly reason: "webgl" | "build",
        cause: unknown,
    ) {
        super(reason === "webgl" ? "WebGL unavailable" : "Model build failed");
        this.cause = cause;
    }
}

function addLights(target: Scene): void {
    target.add(new HemisphereLight(0xffffff, 0x3a4556, 0.8));
    const key = new DirectionalLight(0xffffff, 0.85);
    key.position.set(-3, 4, 3);
    target.add(key);
    const rim = new DirectionalLight(0xbfd4ff, 0.45);
    rim.position.set(3, 1, -3);
    target.add(rim);
    const fill = new DirectionalLight(0xffffff, 0.3);
    fill.position.set(2, -2, 4);
    target.add(fill);
    const back = new DirectionalLight(0xffffff, 0.25);
    back.position.set(4, 0.5, 0);
    target.add(back);
}

/** The side of the brain the camera is currently looking at. */
export function viewSide(): Side {
    return camera.position.x <= 0 ? "L" : "R";
}

/** Width/height of the part of the stage not covered by the sheet. */
function visibleAspect(): number {
    const w = stageEl.clientWidth || 1;
    const h = stageEl.clientHeight || 1;
    if (!isPhoneLayout()) return w / h;
    const visibleHeight = Math.max(160, h - sheetHeight() - 95);
    return w / visibleHeight;
}

/**
 * Pulls the camera back on narrow screens so the brain still fits. The
 * brain needs roughly a 1.15:1 frame; phones get extra side margin so it
 * doesn't touch the screen edges.
 */
function fit(): number {
    const frame = isPhoneLayout() ? 1.45 : 1.15;
    return Math.max(1, frame / visibleAspect());
}

export const selKey = (): string => keyOf(state.sel, state.selSide);

/** Node whose children are labeled: the selection, or a leaf's parent. */
export function labelParent(): string {
    return isLeafNode(state.sel)
        ? parentOf(state.sel, state.selSide) || "brain"
        : state.sel;
}
const labelParentKey = (): string => keyOf(labelParent(), state.selSide);

/** The child of parentKey on this mesh's path, if the mesh is under it. */
function childIn(mesh: BrainMesh, parentKey: string): string | null {
    const path = mesh.userData.path;
    const i = path.indexOf(parentKey);
    return i > 0 ? path[i - 1] : null;
}

/** Recolors every mesh for the current selection, condition and hover. */
export function applyView(): void {
    const sk = selKey();
    const lk = labelParentKey();
    const { mode, condMap, condWhole, sel, hovered, opacity } = state;
    for (const m of MESHES) {
        const u = m.userData;
        const path = u.path;
        let useSolid = false;
        let col: Color;
        let op: number;
        let emissive = 0;
        if (mode === "condition") {
            const involvement = condMap[u.leaf];
            if (involvement) {
                useSolid = true;
                col = involvement === "p" ? HOT_COLOR : WARM_COLOR;
                op =
                    u.layer === "cortex"
                        ? condWhole[u.top]
                            ? 0.3
                            : involvement === "p"
                              ? 0.72
                              : 0.4
                        : 1;
                emissive = 0.22;
            } else {
                col = GHOST;
                op =
                    u.layer === "cortex"
                        ? 0.1
                        : u.layer === "shell"
                          ? 0.14
                          : 0.12;
            }
        } else {
            const inSelection = sel !== "brain" && path.includes(sk);
            if (inSelection) {
                useSolid = true;
                const ck = isLeafNode(sel) ? sk : childIn(m, sk);
                col = new Color(
                    state.oneColor ? ONE_COLOR : colorOfKey(ck || sk),
                );
                op = 1;
                emissive = isLeafNode(sel) ? 0.3 : 0.06;
            } else {
                const inLabelParent = lk !== "brain" && path.includes(lk);
                const ck = inLabelParent ? childIn(m, lk) : null;
                col = new Color(
                    state.oneColor
                        ? ONE_COLOR
                        : ck
                          ? colorOfKey(ck)
                          : u.top
                            ? S[u.top].color
                            : "#9FB3D1",
                );
                op =
                    u.layer === "cortex"
                        ? 0.27
                        : u.layer === "shell"
                          ? 0.32
                          : 0.34;
                if (sel !== "brain" && !inLabelParent) op *= 0.55;
                if (hovered && path.includes(hovered)) op *= 2.2;
            }
            if (useSolid && hovered && path.includes(hovered)) {
                emissive = Math.max(emissive, 0.22);
            }
        }
        if (useSolid) {
            const M = u.solid;
            M.color.copy(col);
            M.emissive.copy(col).multiplyScalar(emissive);
            const transparent = op < 0.999;
            if (M.transparent !== transparent) {
                M.transparent = transparent;
                M.needsUpdate = true;
            }
            M.opacity = op;
            M.depthWrite = op >= 0.5;
            if (m.material !== M) m.material = M;
        } else {
            const M = u.holo;
            // Opacity above 20% blends the hologram toward a solid surface.
            const solid =
                mode === "condition" ? 0 : clamp((opacity - 0.2) / 0.8, 0, 1);
            const additive = solid < 0.02;
            if (mode !== "condition" && opacity < 0.2) op *= opacity / 0.2;
            M.uniforms.uColor.value.copy(col);
            M.uniforms.uOpacity.value = op;
            M.uniforms.uSolid.value = solid;
            M.uniforms.uBright.value = state.brightness;
            const blending = additive ? AdditiveBlending : NormalBlending;
            if (M.blending !== blending) {
                M.blending = blending;
                M.needsUpdate = true;
            }
            M.depthWrite = solid > 0.7;
            if (m.material !== M) m.material = M;
        }
    }
}

/** Moves every mesh out by its spread offset. */
export function applySpread(): void {
    for (const m of MESHES) {
        m.position.copy(m.userData.off).multiplyScalar(state.spread);
    }
}

export function setBrightness(multiplier: number): void {
    state.brightness = multiplier;
    for (const [light, base] of lights) light.intensity = base * multiplier;
    applyView();
}

function startCameraMove(pos: Vector3, tgt: Vector3): void {
    if (!ready) return;
    goal = { pos, tgt };
    if (prefersReducedMotion) {
        camera.position.copy(pos);
        controls.target.copy(tgt);
        goal = null;
    }
}

/** Flies the camera back to the starting view. */
export function flyHome(): void {
    if (!ready) return;
    goal = { pos: HOME.clone(), tgt: CENTER.clone() };
}

/** Flies the camera to frame a structure. */
export function focusNode(id: string, side: Side): void {
    if (!ready) return;
    const node = S[id];
    const sd = node.lat || node.isHemi ? side : null;
    const c = centerOf(id, sd)
        .clone()
        .add(nodeOffset(id, side).clone().multiplyScalar(state.spread));
    const dir = facingOf(id, side) || new Vector3(-1, 0.4, 0.4).normalize();
    const r = radiusOf(id, sd);
    const k = id === "brain" ? 0 : isLeafNode(id) ? 0.75 : 0.5;
    const tgt = CENTER.clone().lerp(c, k);
    let dist =
        id === "brain"
            ? HOME.distanceTo(CENTER) / fit()
            : node.isHemi
              ? 4.2
              : Math.min(4.3, Math.max(2.3, 1.6 + r * 3.4));
    dist =
        dist * fit() * (1 + state.spread * 0.7) * (isPhoneLayout() ? 1.3 : 1);
    startCameraMove(tgt.clone().addScaledVector(dir, dist), tgt);
}

/** Frames all brain areas of the highlighted condition. */
export function focusCondition(): void {
    if (!ready) return;
    const box = new Box3();
    for (const m of MESHES) {
        if (state.condMap[m.userData.leaf]) {
            m.updateMatrixWorld();
            box.union(new Box3().setFromObject(m));
        }
    }
    if (box.isEmpty()) return;
    const ctr = box.getCenter(new Vector3());
    const dir = camera.position.clone().sub(controls.target).normalize();
    const tgt = CENTER.clone().lerp(ctr, 0.5);
    const dist =
        4.4 * fit() * (1 + state.spread * 0.7) * (isPhoneLayout() ? 1.3 : 1);
    startCameraMove(tgt.clone().addScaledVector(dir, dist), tgt);
}

/* ---------- picking ---------- */

const raycaster = new Raycaster();

function castAt(event: PointerEvent, list: BrainMesh[]) {
    const rect = canvas.getBoundingClientRect();
    const pointer = new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(list, false);
}

/**
 * Tree key of what a click would select: a child of the labeled node,
 * or, outside it, the next step down from the selection's ancestors.
 */
function pickTarget(event: PointerEvent): string | null {
    if (state.mode === "condition") {
        const hits = castAt(
            event,
            MESHES.filter((m) => state.condMap[m.userData.leaf]),
        );
        if (!hits.length) return null;
        const u = (hits[0].object as BrainMesh).userData;
        return keyOf(u.leaf, u.side === "B" ? state.selSide : u.side);
    }
    const lk = labelParentKey();
    const scope =
        lk === "brain"
            ? MESHES
            : MESHES.filter((m) => m.userData.path.includes(lk));
    let hits = castAt(event, scope);
    if (hits.length) {
        // Inside a deep region, prefer buried parts over the surface.
        const deepScope = lk !== "brain" && !["hemiL", "hemiR"].includes(lk);
        const inner = deepScope
            ? hits.find(
                  (h) => (h.object as BrainMesh).userData.layer === "inner",
              )
            : null;
        return childIn((inner || hits[0]).object as BrainMesh, lk) || null;
    }
    hits = castAt(event, MESHES);
    if (!hits.length) return null;
    const hitPath = (hits[0].object as BrainMesh).userData.path;
    const selPath = pathKeys(state.sel, state.selSide);
    const i = hitPath.findIndex((k) => selPath.includes(k));
    return i > 0 ? hitPath[i - 1] : null;
}

/** Side for a tree key; unsided keys use the hemisphere or selection. */
export function nodeSide(key: string): Side {
    const { id, side } = parseKey(key);
    return side || (S[id].isHemi ? S[id].side! : state.selSide);
}

/* ---------- labels ---------- */

let labelsEl: HTMLElement;
/** A label button; its size is measured once and cached for layout. */
type LabelButton = HTMLButtonElement & { width?: number; height?: number };
const labelButtons: Record<string, LabelButton> = {};
const shownLabels = new Set<string>();

function labelEl(key: string): LabelButton {
    if (labelButtons[key]) return labelButtons[key];
    const { id } = parseKey(key);
    const node = S[id];
    const button = document.createElement("button");
    button.className = "lbl";
    button.type = "button";
    button.hidden = true;
    button.innerHTML = `<span class="swatch"></span><span>${esc(node.short || node.name)}</span>`;
    button.addEventListener("click", () => {
        if (state.mode === "condition") {
            callbacks.onSelect(id, viewSide());
            return;
        }
        callbacks.onSelect(id, nodeSide(key));
    });
    labelsEl.appendChild(button);
    labelButtons[key] = button;
    return button;
}

/** Removes all labels so they are recreated in the current language. */
export function resetLabels(): void {
    for (const key of Object.keys(labelButtons)) {
        labelButtons[key].remove();
        delete labelButtons[key];
    }
    shownLabels.clear();
}

const projected = new Vector3();

/** Positions labels over the model, nudging overlapping ones apart. */
function updateLabels(): void {
    const w = stageEl.clientWidth;
    const h = stageEl.clientHeight;
    const vs = viewSide();
    const wanted: {
        key: string;
        id: string;
        side: Side;
        c: string;
        sub?: boolean;
    }[] = [];
    if (state.showLabels) {
        if (state.mode === "condition" && state.cond) {
            for (const [id, lv] of state.cond.brain) {
                wanted.push({
                    key: "c|" + id,
                    id,
                    side: vs,
                    c: lv === "p" ? HOT : WARM,
                });
            }
        } else {
            const lp = labelParent();
            for (const kid of S[lp].kids) {
                const side = kid.isHemi
                    ? kid.side!
                    : kid.lat
                      ? state.selSide
                      : vs;
                wanted.push({
                    key: keyOf(kid.id, side),
                    id: kid.id,
                    side,
                    c: kid.color,
                    sub: lp !== "brain",
                });
            }
        }
    }
    const items: { o: (typeof wanted)[number]; x: number; y: number }[] = [];
    for (const o of wanted) {
        const anchor = anchorOf(o.id, o.side);
        if (!anchor) continue;
        projected
            .copy(anchor.p)
            .addScaledVector(nodeOffset(o.id, o.side), state.spread)
            .project(camera);
        if (
            projected.z > 1 ||
            Math.abs(projected.x) > 1.05 ||
            Math.abs(projected.y) > 1.05
        ) {
            continue;
        }
        const y = (-projected.y * 0.5 + 0.5) * h;
        // On phones, keep labels out from under the toolbar and the sheet.
        if (
            isPhoneLayout() &&
            (y < (state.mode === "condition" ? 140 : 100) ||
                y > h - sheetHeight() - 14)
        ) {
            continue;
        }
        items.push({ o, x: (projected.x * 0.5 + 0.5) * w, y });
    }
    items.sort((a, b) => a.y - b.y);
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const now = new Set<string>();
    const sk = selKey();
    for (const item of items) {
        const isCondition = item.o.key.startsWith("c|");
        const el = isCondition ? labelEl(item.o.id) : labelEl(item.o.key);
        const labelKey = isCondition ? item.o.id : item.o.key;
        if (el.hidden) el.hidden = false;
        el.style.setProperty("--swatch", item.o.c);
        el.classList.toggle("sub", !!item.o.sub);
        el.classList.toggle(
            "on",
            state.mode === "structure" && labelKey === sk,
        );
        if (!el.width) {
            el.width = el.offsetWidth;
            el.height = el.offsetHeight;
        }
        const lw = el.width || 110;
        const lh = el.height || 20;
        // Labels point outward: left half to the left, unless that
        // would push them off the stage.
        let flip = item.x < w * 0.5;
        if (flip && item.x - lw < 4) flip = false;
        else if (!flip && item.x + lw > w - 4) flip = true;
        const x0 = flip ? item.x - lw + 4.5 : item.x - 4.5;
        let y = item.y;
        for (let k = 0; k < 8; k++) {
            const hit = placed.find(
                (r) =>
                    x0 < r.x + r.w &&
                    x0 + lw > r.x &&
                    y - lh / 2 < r.y + r.h / 2 + 2 &&
                    y + lh / 2 > r.y - r.h / 2 - 2,
            );
            if (!hit) break;
            y = hit.y + lh + 3;
        }
        placed.push({ x: x0, y, w: lw, h: lh });
        el.classList.toggle("flip", flip);
        const top = (y - lh / 2).toFixed(1);
        el.style.transform = `translate(${x0.toFixed(1)}px,${top}px)`;
        now.add(labelKey);
    }
    for (const key of shownLabels) {
        if (!now.has(key) && labelButtons[key]) labelButtons[key].hidden = true;
    }
    shownLabels.clear();
    for (const key of now) shownLabels.add(key);
}

/* ---------- close-up viewer ---------- */

/** Canvas of the close-up viewer; the Region panel places it. */
export const closeUpCanvas = document.createElement("canvas");
closeUpCanvas.setAttribute("aria-label", "Close-up of the selected structure");
let closeUpRenderer: WebGLRenderer;
const closeUpScene = new Scene();
const closeUpCamera = new PerspectiveCamera(35, 16 / 10, 0.02, 50);
let closeUpControls: OrbitControls;
let closeUpGroup = new Group();

/** Shows a structure in color inside a faint, see-through brain. */
export function showCloseUp(id: string, side: Side): void {
    if (!ready) return;
    closeUpScene.remove(closeUpGroup);
    closeUpGroup = new Group();
    const node = S[id];
    const key = keyOf(id, side);
    const meshes = node.lat || node.isHemi ? meshesOf(id, side) : node.meshes;
    for (const m of meshes) {
        const ck = isLeafNode(id) ? key : childIn(m, key);
        const c = new Color(
            state.oneColor
                ? ONE_COLOR
                : ck
                  ? colorOfKey(ck)
                  : S[m.userData.leaf].color,
        );
        closeUpGroup.add(
            new Mesh(
                m.geometry,
                new MeshStandardMaterial({
                    color: c,
                    roughness: 0.55,
                    metalness: 0.02,
                    emissive: c.clone().multiplyScalar(0.12),
                }),
            ),
        );
    }
    closeUpScene.add(closeUpGroup);
    const box = bbox(meshes);
    const center = box.getCenter(new Vector3());
    const radius = box.getSize(new Vector3()).length() / 2;
    const dir = facingOf(id, side) || new Vector3(-1, 0.3, 0.3);
    const dist = Math.min(Math.max(radius * 3.2, 0.5), 5);
    closeUpControls.target.copy(center);
    closeUpCamera.position.copy(center).addScaledVector(dir, dist);
    closeUpControls.update();
}

export function sizeCloseUp(): void {
    if (!ready) return;
    const w = closeUpCanvas.clientWidth;
    const h = closeUpCanvas.clientHeight;
    if (w && h) {
        closeUpRenderer.setSize(w, h, false);
        closeUpCamera.aspect = w / h;
        closeUpCamera.updateProjectionMatrix();
    }
}

/* ---------- layout, loop ---------- */

/** Shifts the view up on phones so the brain sits above the sheet. */
export function applyViewOffset(): void {
    const w = stageEl.clientWidth;
    const h = stageEl.clientHeight;
    if (!w || !h) return;
    if (isPhoneLayout()) {
        const d = Math.round((sheetHeight() - 70) / 2);
        camera.setViewOffset(w, h, 0, Math.max(0, d), w, h);
    } else {
        camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
}

let firstResize = true;

function resize(): void {
    const w = stageEl.clientWidth;
    const h = stageEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    applyViewOffset();
    if (firstResize) {
        firstResize = false;
        HOME.sub(CENTER).multiplyScalar(fit()).add(CENTER);
        camera.position.copy(HOME);
    }
}

let tip: HTMLElement;
let queuedHover: PointerEvent | null = null;

function tick(): void {
    if (goal) {
        camera.position.lerp(goal.pos, 0.08);
        controls.target.lerp(goal.tgt, 0.08);
        if (camera.position.distanceTo(goal.pos) < 0.01) goal = null;
    }
    controls.update();
    if (queuedHover) {
        const event = queuedHover;
        queuedHover = null;
        const key = pickTarget(event);
        if (key !== state.hovered) {
            state.hovered = key;
            if (state.mode === "structure") applyView();
            canvas.style.cursor = key ? "pointer" : "";
        }
        if (key) {
            const rect = stageEl.getBoundingClientRect();
            const { id, side } = parseKey(key);
            const name = S[id].name;
            tip.hidden = false;
            tip.textContent = side
                ? t(side === "L" ? "leftOf" : "rightOf", {
                      name:
                          currentLang() === "en"
                              ? name.charAt(0).toLowerCase() + name.slice(1)
                              : name,
                  })
                : name;
            tip.style.left = event.clientX - rect.left + "px";
            tip.style.top = event.clientY - rect.top + "px";
        } else {
            tip.hidden = true;
        }
    }
    renderer.render(scene, camera);
    updateLabels();
    if (
        state.activeTab === "region" &&
        closeUpCanvas.isConnected &&
        closeUpCanvas.clientWidth
    ) {
        closeUpControls.update();
        closeUpRenderer.render(closeUpScene, closeUpCamera);
    }
    requestAnimationFrame(tick);
}

/** Finds the stage elements. Works even if WebGL is unavailable. */
export function bindStageElements(): void {
    stageEl = document.getElementById("stage")!;
    canvas = document.getElementById("brain") as HTMLCanvasElement;
    labelsEl = document.getElementById("labels")!;
    tip = document.getElementById("tip")!;
}

function createRenderer(target: HTMLCanvasElement): WebGLRenderer {
    try {
        const r = new WebGLRenderer({
            canvas: target,
            antialias: true,
            alpha: true,
        });
        r.setPixelRatio(Math.min(devicePixelRatio, 2));
        return r;
    } catch (cause) {
        throw new StageError("webgl", cause);
    }
}

/**
 * Starts WebGL, builds the model (reporting progress) and wires pointer
 * input. Throws a StageError if the 3D view can't run.
 */
export async function initStage(
    handlers: StageCallbacks,
    progress: BuildProgress,
): Promise<void> {
    callbacks = handlers;
    renderer = createRenderer(canvas);
    closeUpRenderer = createRenderer(closeUpCanvas);
    canvas.addEventListener("webglcontextlost", (e) => {
        // Lets three.js restore the context when the device allows it.
        e.preventDefault();
        callbacks.onContextLost(true);
    });
    canvas.addEventListener("webglcontextrestored", () =>
        callbacks.onContextLost(false),
    );

    camera.position.copy(HOME);
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 1.2;
    controls.maxDistance = 16;
    controls.target.copy(CENTER);
    addLights(scene);
    for (const child of scene.children) {
        if ((child as Light).isLight) {
            lights.push([child as Light, (child as Light).intensity]);
        }
    }

    try {
        await buildModel(scene, progress);
    } catch (cause) {
        throw new StageError("build", cause);
    }

    // Close-up viewer: a second renderer sharing the same geometry.
    addLights(closeUpScene);
    closeUpControls = new OrbitControls(closeUpCamera, closeUpCanvas);
    closeUpControls.enablePan = false;
    closeUpControls.enableDamping = true;
    closeUpControls.autoRotate = !prefersReducedMotion;
    closeUpControls.autoRotateSpeed = 1.6;
    closeUpControls.minDistance = 0.3;
    closeUpControls.maxDistance = 8;
    const ghost = new MeshStandardMaterial({
        color: 0x9aa6b6,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        roughness: 0.8,
    });
    for (const m of MESHES) {
        if (m.userData.layer !== "inner") {
            closeUpScene.add(new Mesh(m.geometry, ghost));
        }
    }
    closeUpScene.add(closeUpGroup);
    new ResizeObserver(sizeCloseUp).observe(closeUpCanvas);

    // A click is a short press without dragging; anything else rotates.
    let down: { x: number; y: number; t: number } | null = null;
    canvas.addEventListener("pointerdown", (e) => {
        down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    canvas.addEventListener("pointerup", (e) => {
        if (!down) return;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        const duration = performance.now() - down.t;
        down = null;
        if (moved < 6 && duration < 600) {
            const key = pickTarget(e);
            if (key) callbacks.onSelect(parseKey(key).id, nodeSide(key));
            else if (state.mode === "structure") callbacks.onEmptyClick();
        }
    });
    canvas.addEventListener("pointermove", (e) => {
        if (e.pointerType === "mouse") queuedHover = e;
    });
    canvas.addEventListener("pointerleave", () => {
        state.hovered = null;
        tip.hidden = true;
        canvas.style.cursor = "";
        applyView();
    });
    controls.addEventListener("start", () => {
        goal = null;
    });

    new ResizeObserver(resize).observe(stageEl);
    resize();
    // Compile the shaders now rather than stalling the first frame.
    renderer.compile(scene, camera);
    await progress(1);
    ready = true;
}

/** Starts the render loop. */
export function startRendering(): void {
    tick();
}

/** The main canvas, for listeners elsewhere (e.g. closing menus). */
export function stageCanvas(): HTMLCanvasElement {
    return canvas;
}
