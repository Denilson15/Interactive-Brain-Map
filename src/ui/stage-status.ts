// What the 3D area shows when it isn't showing the model: build
// progress, or why the model can't be shown and what to do about it.
// The page records its state on <body data-stage="loading|ready|error">,
// which the styles use to hide 3D-only controls.
import { t } from "../app/i18n";
import { esc } from "../app/util";

export type StageState = "loading" | "ready" | "error";

/** The problems the 3D area can explain. */
export type StageProblem = "webgl" | "build" | "contextLost";

let status: HTMLElement;
let bar: HTMLProgressElement;
let errorBox: HTMLElement;
let notice: HTMLElement;
let currentProblem: StageProblem | null = null;

export function initStageStatus(): void {
    status = document.getElementById("stageStatus")!;
    bar = document.getElementById("stageProgress") as HTMLProgressElement;
    errorBox = document.getElementById("stageError")!;
    notice = document.getElementById("notice")!;
    errorBox.addEventListener("click", (e) => {
        if ((e.target as Element).closest("[data-reload]")) location.reload();
    });
    notice.addEventListener("click", (e) => {
        if ((e.target as Element).closest("[data-dismiss]")) {
            notice.hidden = true;
        }
    });
}

export function stageState(): StageState {
    return document.body.dataset.stage as StageState;
}

function setStageState(next: StageState): void {
    document.body.dataset.stage = next;
}

/** Waits until the browser has painted, so progress is visible. */
export function nextPaint(): Promise<void> {
    return new Promise((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 0)),
    );
}

/** Updates the progress bar (0-1) and lets the browser paint it. */
export async function reportProgress(fraction: number): Promise<void> {
    bar.value = Math.round(fraction * 100);
    await nextPaint();
}

export function showModelReady(): void {
    status.hidden = true;
    setStageState("ready");
}

function problemHtml(problem: StageProblem): string {
    if (problem === "webgl") {
        return (
            `<p class="stage-status-title">${esc(t("errWebglTitle"))}</p>` +
            `<p class="stage-status-note">${esc(t("errWebglBody"))}</p>` +
            `<p class="stage-status-note">${esc(t("errWebglFix"))}</p>` +
            `<button type="button" class="button button--stage stage-action" data-reload>` +
            `${esc(t("tryAgain"))}</button>`
        );
    }
    if (problem === "build") {
        return (
            `<p class="stage-status-title">${esc(t("errBuildTitle"))}</p>` +
            `<p class="stage-status-note">${esc(t("errBuildBody"))}</p>` +
            `<button type="button" class="button button--stage stage-action" data-reload>` +
            `${esc(t("reloadPage"))}</button>`
        );
    }
    return (
        `<p class="stage-status-title">${esc(t("errLostTitle"))}</p>` +
        `<p class="stage-status-note">${esc(t("errLostBody"))}</p>` +
        `<button type="button" class="button button--stage stage-action" data-reload>` +
        `${esc(t("reloadPage"))}</button>`
    );
}

/**
 * Replaces the 3D area with an explanation. The panels, section map and
 * dictionary keep working, so the message says so.
 */
export function showStageProblem(problem: StageProblem): void {
    currentProblem = problem;
    status.hidden = true;
    errorBox.innerHTML = problemHtml(problem);
    errorBox.hidden = false;
    setStageState("error");
}

/** Removes a context-lost message once the browser restores 3D. */
export function clearStageProblem(): void {
    currentProblem = null;
    errorBox.hidden = true;
    errorBox.innerHTML = "";
    setStageState("ready");
}

/** Re-renders any visible message in the current language. */
export function refreshStageStatusText(): void {
    if (currentProblem && !errorBox.hidden) {
        errorBox.innerHTML = problemHtml(currentProblem);
    }
}

/**
 * A message above the panel, e.g. when a download fails. It stays until
 * dismissed, so nobody misses it by reading slowly.
 */
export function showNotice(message: string): void {
    notice.innerHTML =
        `<span>${esc(message)}</span>` +
        `<button type="button" class="button button--quiet" data-dismiss>` +
        `${esc(t("dismiss"))}</button>`;
    notice.hidden = false;
}
