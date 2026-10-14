// The first-visit introduction over the 3D stage. Shown once per device
// (remembered in this browser only); the About button brings it back.
import { isPhoneLayout } from "../app/util";

const STORAGE_KEY = "ibm-intro-seen";

let intro: HTMLElement;
let aboutButton: HTMLElement;

export function isIntroOpen(): boolean {
    return !intro.hidden;
}

function setOpen(open: boolean): void {
    intro.hidden = !open;
    aboutButton.setAttribute("aria-expanded", String(open));
}

function rememberSeen(): void {
    try {
        localStorage.setItem(STORAGE_KEY, "1");
    } catch {
        // Without storage the intro simply shows again next visit.
    }
}

/** Closes the intro and moves focus to the first thing to explore. */
export function closeIntro(): void {
    if (!isIntroOpen()) return;
    setOpen(false);
    rememberSeen();
    const next = isPhoneLayout()
        ? document.getElementById("tab-browse")
        : document.querySelector<HTMLElement>("#chips button");
    next?.focus();
}

function openIntro(): void {
    setOpen(true);
    document.getElementById("introCta")!.focus();
}

export function initIntro(): void {
    intro = document.getElementById("intro")!;
    aboutButton = document.getElementById("aboutBtn")!;
    // index.html hides the intro before first paint for returning
    // visitors; from here on the hidden attribute controls it.
    const root = document.documentElement;
    setOpen(!("introSeen" in root.dataset));
    delete root.dataset.introSeen;

    document.getElementById("introCta")!.addEventListener("click", closeIntro);
    aboutButton.addEventListener("click", () =>
        isIntroOpen() ? closeIntro() : openIntro(),
    );
}
