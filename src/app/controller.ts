// Wires the app together: selection, tabs, language, the toolbar, and
// the shared click handling for links inside the panels.
import {
    applySpread,
    applyView,
    flyHome,
    focusCondition,
    focusNode,
    initStage,
    resetLabels,
    setBrightness,
    showCloseUp,
    stageCanvas,
    startRendering,
    viewSide,
    HOT,
    WARM,
} from "../scene/stage";
import {
    ensureSheetOpen,
    initBottomSheet,
    refreshSheet,
} from "../ui/bottom-sheet";
import {
    renderConditionDetail,
    renderConditionList,
} from "../ui/condition-panels";
import {
    DICT,
    browseDictionary,
    buildDictionary,
    clearRecentTerms,
    initDictionaryPanel,
    renderFilters,
    renderGlossary,
    revealEntry,
} from "../ui/dictionary-panel";
import {
    hidePopover,
    initPopover,
    isPopoverOpen,
    popoverAnchor,
    resultForKey,
    showDefinition,
} from "../ui/popover";
import { initRegionPanel, renderRegion } from "../ui/region-panel";
import { initSectionMap, placeMap, renderMap } from "../ui/section-map";
import { CONDS, DISEASES, PSYCH, buildConditions } from "./conditions";
import {
    applyContentLanguage,
    glossaryIn,
    loadSpanish,
    type CoreContent,
} from "./content";
import { buildIndex, type IndexEntry } from "./dictionary-index";
import { currentLang, setLang, t, useSpanishUi, type Lang } from "./i18n";
import { state, type Tab } from "./state";
import { S, buildStructureTree, parentOf } from "./structures";
import type { Condition, ConditionKind, Side, SpanishData } from "./types";
import { PHONE_QUERY, esc } from "./util";

const TAB_VIEWS: Record<Tab, string> = {
    browse: "view-browse",
    region: "view-region",
    psych: "view-psych",
    disease: "view-disease",
    gloss: "view-gloss",
};

let content: CoreContent;

interface SelectOptions {
    /** Fly the camera to the structure (default true). */
    focus?: boolean;
    /** Switch to the Region tab (default true). */
    tab?: boolean;
    /** Open the phone sheet so the panel is visible. */
    scroll?: boolean;
}

export function selectNode(
    id: string,
    side?: Side | null,
    options: SelectOptions = {},
): void {
    if (!S[id]) return;
    state.sel = id;
    if (side) state.selSide = side;
    state.mode = "structure";
    hidePopover();
    applyView();
    renderRegion();
    showCloseUp(id, state.selSide);
    renderMap();
    if (options.focus !== false) focusNode(id, state.selSide);
    if (options.tab !== false) showTab("region");
    if (options.scroll) ensureSheetOpen();
}

/** Default side when a button gives none: a hemisphere's own side. */
function sideFor(id: string, side: Side | "" | undefined): Side {
    return side || (S[id].isHemi ? S[id].side! : state.selSide);
}

/** Selects from a button in a panel or the section map. */
function selectFromButton(id: string, side: Side | ""): void {
    selectNode(id, sideFor(id, side), { scroll: true });
}

export function goUp(): void {
    if (state.sel === "brain") return;
    const parent = parentOf(state.sel, state.selSide) || "brain";
    selectNode(parent, S[parent].isHemi ? S[parent].side : state.selSide);
}

/** Highlights a condition's brain areas on the model. */
function setCondition(c: Condition): void {
    state.cond = c;
    state.mode = "condition";
    state.condMap = {};
    state.condWhole = {};
    for (const [id] of c.brain) {
        if (S[id].isTop && S[id].layer === "cortex") state.condWhole[id] = true;
    }
    for (const [id, lv] of c.brain) {
        for (const m of S[id].meshes) {
            const leaf = m.userData.leaf;
            if (state.condMap[leaf] !== "p") state.condMap[leaf] = lv;
        }
    }
}

export function openCondition(key: string): void {
    const c = CONDS[key];
    if (!c) return;
    hidePopover();
    state.openCond[c.kind] = c;
    renderConditionDetail(c);
    showTab(c.kind);
    ensureSheetOpen();
    focusCondition();
}

function closeCondition(kind: ConditionKind): void {
    state.openCond[kind] = null;
    renderConditionList(kind);
    showTab(kind);
}

export function showTab(name: Tab): void {
    state.activeTab = name;
    for (const key of Object.keys(TAB_VIEWS) as Tab[]) {
        document
            .getElementById("tab-" + key)!
            .setAttribute("aria-selected", String(key === name));
        document.getElementById(TAB_VIEWS[key])!.hidden = key !== name;
    }
    // Condition tabs show their open condition on the model; the Region
    // tab always shows anatomy.
    if (name === "psych" || name === "disease") {
        const open = state.openCond[name];
        if (open) setCondition(open);
        else if (state.mode === "condition") state.mode = "structure";
    } else if (name === "region") {
        if (state.mode === "condition") state.mode = "structure";
    }
    applyView();
    updateConditionBar();
}

/** The bar over the model naming the highlighted condition. */
function updateConditionBar(): void {
    const bar = document.getElementById("condbar")!;
    const hint = document.getElementById("hint")!;
    const on = state.mode === "condition" && !!state.cond;
    bar.hidden = !on;
    hint.hidden = on;
    if (on) {
        const c = state.cond!;
        bar.innerHTML =
            `<b>${esc(c.short || c.name)}</b>` +
            `<span class="k"><i style="background:${HOT}"></i>` +
            `${t("primary")}</span>` +
            `<span class="k"><i style="background:${WARM}"></i>` +
            `${t("alsoInvolved")}</span>` +
            `<button type="button" id="exitCond">` +
            `${t("backToAnatomy")}</button>`;
    }
}

function openInGlossary(key: string): void {
    hidePopover();
    showTab("gloss");
    revealEntry(key);
}

/** Fills in the static interface text for the current language. */
function setStaticText(): void {
    const lang = currentLang();
    document.documentElement.lang = lang;
    document.title = t("title");
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n!);
    });
    document
        .querySelectorAll<HTMLInputElement>("[data-i18n-ph]")
        .forEach((el) => {
            el.placeholder = t(el.dataset.i18nPh!);
        });
    document
        .querySelectorAll<HTMLElement>("[data-i18n-title]")
        .forEach((el) => {
            el.title = t(el.dataset.i18nTitle!);
        });
    document.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    document.getElementById("stats")!.textContent = t("stats", {
        p: content.atlas.subs.length,
        d: PSYCH.length,
        s: DISEASES.length,
        e: DICT.length,
    });
}

/** Rebuilds everything that depends on the content language. */
function applyContent(es: SpanishData | null): void {
    applyContentLanguage(es);
    const glossary = glossaryIn(content.glossary, es);
    buildIndex(glossary);
    buildDictionary(glossary);
}

/** The language the visitor last asked for, while Spanish downloads. */
let requestedLang: Lang = currentLang();

async function switchLanguage(lang: Lang): Promise<void> {
    if (lang === currentLang() && lang === requestedLang) return;
    requestedLang = lang;
    const es = lang === "es" ? await loadSpanish() : null;
    // Ignore a download that finished after the visitor switched back.
    if (requestedLang !== lang) return;
    setLang(lang, es);
    applyContent(es);
    resetLabels();
    clearRecentTerms();
    hidePopover();
    setStaticText();
    renderFilters();
    renderGlossary();
    renderRegion();
    renderMap();
    for (const kind of ["psych", "disease"] as ConditionKind[]) {
        const open = state.openCond[kind];
        if (open) renderConditionDetail(open);
        else renderConditionList(kind);
    }
    updateConditionBar();
}

function initToolbar(): void {
    const spreadInput = document.getElementById("spread") as HTMLInputElement;
    const opacityInput = document.getElementById("opac") as HTMLInputElement;
    const brightnessInput = document.getElementById(
        "bright",
    ) as HTMLInputElement;
    spreadInput.addEventListener("input", () => {
        state.spread = Number(spreadInput.value) / 100;
        applySpread();
    });
    opacityInput.addEventListener("input", () => {
        state.opacity = Number(opacityInput.value) / 100;
        applyView();
    });
    brightnessInput.addEventListener("input", () => {
        // Slider 0-100 maps to 0.35x-1.65x light.
        setBrightness(0.35 + (Number(brightnessInput.value) / 100) * 1.3);
    });
    document.getElementById("lblBtn")!.addEventListener("click", (e) => {
        state.showLabels = !state.showLabels;
        (e.currentTarget as HTMLElement).setAttribute(
            "aria-pressed",
            String(state.showLabels),
        );
    });
    document.getElementById("resetBtn")!.addEventListener("click", () => {
        spreadInput.value = "0";
        state.spread = 0;
        applySpread();
        if (state.mode === "structure") {
            selectNode("brain", "L", { tab: false });
        } else {
            flyHome();
        }
    });
    document.getElementById("upBtn")!.addEventListener("click", () => {
        if (state.mode === "condition") showTab("region");
        else goUp();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (isPopoverOpen()) {
            hidePopover();
            return;
        }
        const inInput = (e.target as Element).closest?.("input");
        if (state.mode === "structure" && !inInput) goUp();
    });

    // Phone layout: the sliders and toggles live in a Controls menu.
    const moreButton = document.getElementById("moreBtn")!;
    const moreMenu = document.getElementById("tbMore")!;
    const setMenuOpen = (open: boolean): void => {
        moreMenu.classList.toggle("open", open);
        moreButton.setAttribute("aria-expanded", String(open));
    };
    moreButton.addEventListener("click", () =>
        setMenuOpen(!moreMenu.classList.contains("open")),
    );
    stageCanvas().addEventListener("pointerdown", () => {
        if (moreMenu.classList.contains("open")) setMenuOpen(false);
    });
}

/** Handles links that can appear anywhere in the panels. */
function handleDocumentClick(e: MouseEvent): void {
    const button = (e.target as Element).closest<HTMLButtonElement>("button");
    if (!button) return;
    const data = button.dataset;
    if (data.lang) {
        void switchLanguage(data.lang as Lang);
        return;
    }
    if (button.classList.contains("term") && data.t) {
        e.preventDefault();
        const entry: IndexEntry = {
            t: data.t as IndexEntry["t"],
            id: data.id!,
        };
        showDefinition({ e: entry, q: "" }, button.getBoundingClientRect());
        return;
    }
    if (button.hasAttribute("data-close")) {
        hidePopover();
        return;
    }
    if (data.sub) {
        selectNode(data.sub, sideFor(data.sub, ""), { scroll: true });
        return;
    }
    if (data.cond) {
        openCondition(data.cond);
        return;
    }
    if (data.focus) {
        focusNode(data.focus, viewSide());
        return;
    }
    if (data.back) {
        closeCondition(data.back as ConditionKind);
        return;
    }
    if (data.dict) {
        openInGlossary(data.dict);
        return;
    }
    if (data.def) {
        showDefinition(
            resultForKey(data.def),
            popoverAnchor() || button.getBoundingClientRect(),
        );
        return;
    }
    if (button.hasAttribute("data-browse")) {
        hidePopover();
        showTab("gloss");
        browseDictionary();
    }
}

/** Builds the app from loaded content and starts rendering. */
export async function startApp(core: CoreContent): Promise<void> {
    content = core;
    buildStructureTree(core.atlas, core.hierarchy);
    buildConditions(core.psych, core.diseases, core.extensions);

    const es = currentLang() === "es" ? await loadSpanish() : null;
    useSpanishUi(es);
    applyContent(es);

    initBottomSheet();
    initStage({
        onSelect: (id, side) => selectNode(id, side, { scroll: true }),
        onEmptyClick: goUp,
    });
    initRegionPanel(selectFromButton);
    initSectionMap(selectFromButton);
    initDictionaryPanel();
    initPopover();
    initToolbar();

    renderConditionList("psych");
    renderConditionList("disease");
    renderFilters();
    renderGlossary();

    for (const key of Object.keys(TAB_VIEWS) as Tab[]) {
        document.getElementById("tab-" + key)!.addEventListener("click", () => {
            showTab(key);
            ensureSheetOpen();
        });
    }
    document.getElementById("condbar")!.addEventListener("click", (e) => {
        if ((e.target as Element).id === "exitCond") showTab("region");
    });
    document.addEventListener("click", handleDocumentClick);

    const relayout = (): void => {
        placeMap(() => showTab("region"));
        refreshSheet();
    };
    matchMedia(PHONE_QUERY).addEventListener("change", relayout);

    setStaticText();
    relayout();
    selectNode("brain", "L", { focus: false });
    updateConditionBar();
    startRendering();

    // Test and debugging hook; the end-to-end tests drive the app with it.
    (window as unknown as { __atlas: unknown }).__atlas = {
        S,
        CONDS,
        selectNode,
        openCondition,
        showTab,
        setSpread: (value: number) => {
            state.spread = value;
            (document.getElementById("spread") as HTMLInputElement).value =
                String(value * 100);
            applySpread();
        },
    };
}
