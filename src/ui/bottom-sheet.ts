// Phone layout: the side panel becomes a bottom sheet that snaps between
// three heights and can be dragged by its handle or tab bar.
import { applyViewOffset } from "../scene/stage";
import { isPhoneLayout } from "../app/util";

type Snap = "peek" | "half" | "full";

let panelEl: HTMLElement;
let snap: Snap = "peek";
let drag: { y: number; h: number; t: number; moved: boolean } | null = null;

function snapHeights(): Record<Snap, number> {
    const H = window.innerHeight;
    return { peek: 150, half: Math.round(H * 0.52), full: H - 64 };
}

/** Current sheet height in pixels; 0 when not in the phone layout. */
export function sheetHeight(): number {
    if (!isPhoneLayout()) return 0;
    return drag ? panelEl.getBoundingClientRect().height : snapHeights()[snap];
}

function nextSnap(): Snap {
    return snap === "peek" ? "half" : snap === "half" ? "full" : "peek";
}

function setSnap(next: Snap): void {
    snap = next;
    if (!isPhoneLayout()) {
        panelEl.style.height = "";
        applyViewOffset();
        return;
    }
    panelEl.style.height = snapHeights()[next] + "px";
    panelEl.dataset.snap = next;
    // Re-center the model once the height transition (280ms) is done.
    setTimeout(applyViewOffset, 300);
}

/** Re-applies the current snap, e.g. after switching layouts. */
export function refreshSheet(): void {
    setSnap(snap);
}

/** Opens the sheet to half height if it is only peeking. */
export function ensureSheetOpen(): void {
    if (isPhoneLayout() && snap === "peek") setSnap("half");
}

function dragStart(e: PointerEvent): void {
    if (!isPhoneLayout()) return;
    drag = {
        y: e.clientY,
        h: panelEl.getBoundingClientRect().height,
        t: performance.now(),
        moved: false,
    };
    panelEl.classList.add("dragging");
}

function dragMove(e: PointerEvent): void {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    const H = snapHeights();
    panelEl.style.height =
        Math.max(H.peek, Math.min(H.full, drag.h - dy)) + "px";
    applyViewOffset();
}

function dragEnd(e: PointerEvent): void {
    if (!drag) return;
    panelEl.classList.remove("dragging");
    const d = drag;
    drag = null;
    if (!d.moved) {
        // A tap on the handle steps through the heights.
        if ((e.target as Element).closest?.("#grab")) setSnap(nextSnap());
        return;
    }
    const current = panelEl.getBoundingClientRect().height;
    const H = snapHeights();
    const velocity = (e.clientY - d.y) / (performance.now() - d.t);
    let best: Snap = "peek";
    if (velocity < -0.5) best = current > H.half ? "full" : "half";
    else if (velocity > 0.5) best = current < H.half ? "peek" : "half";
    else {
        let bestDistance = 1e9;
        for (const key of Object.keys(H) as Snap[]) {
            const distance = Math.abs(H[key] - current);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = key;
            }
        }
    }
    setSnap(best);
}

export function initBottomSheet(): void {
    panelEl = document.querySelector(".panel")!;
    const grab = document.getElementById("grab")!;
    const tabs = document.querySelector<HTMLElement>(".tabs")!;
    for (const handle of [grab, tabs]) {
        handle.addEventListener("pointerdown", dragStart);
    }
    window.addEventListener("pointermove", dragMove, { passive: true });
    window.addEventListener("pointerup", dragEnd);
    window.addEventListener("pointercancel", dragEnd);
    grab.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSnap(nextSnap());
        }
    });
    window.addEventListener("resize", () => {
        if (isPhoneLayout() && !drag) {
            panelEl.style.height = snapHeights()[snap] + "px";
        }
    });
}
