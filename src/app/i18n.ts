// Interface strings and the current language. Content text (regions,
// conditions, dictionary) is translated separately in content.ts.
import type { SpanishData } from "./types";

export type Lang = "en" | "es";

const UI_EN = {
    title: "Interactive Brain Map",
    tabBrowse: "Browse",
    tabRegion: "Region",
    tabPsych: "Psychology",
    tabDisease: "Diseases",
    tabGloss: "Dictionary",
    up: "Up a level",
    upTitle: "Go up one level (Esc)",
    spread: "Spread",
    opacity: "Opacity",
    brightness: "Brightness",
    labels: "Labels",
    oneColor: "One color",
    oneColorTitle: "Show the whole brain in one color",
    capOneColor: "Close-up in one color. Drag to turn it.",
    reset: "Reset view",
    controls: "Controls",
    hint:
        "Drag to rotate. Scroll or pinch to zoom. Select a part to open " +
        "it; press Esc to go back up.",
    glossSearch: "Search terms, regions and conditions",
    glossPh: "e.g. synapse, putamen, PTSD",
    browseEyebrow: "Every section of the brain",
    stats:
        "{p} brain parts, {d} disorders, {s} diseases and {e} dictionary " +
        "entries",
    primary: "Primary",
    alsoInvolved: "Also involved",
    backToAnatomy: "Back to anatomy",
    hindbrain: "Hindbrain",
    otherParts: "Other parts",
    parts: "Parts",
    nParts: "{n} parts",
    left: "Left",
    right: "Right",
    leftOf: "Left {name}",
    rightOf: "Right {name}",
    group: "Group",
    labelOnModel: "Label on the model: {s}",
    where: "Where",
    capLeaf:
        "Close-up: this part in color inside a see-through brain. " +
        "Drag to turn it.",
    capGroup: "Close-up with each section in its own color. Drag to turn it.",
    help:
        "Click a section on the model, its label, or a button under the " +
        "model to go one level deeper. Click empty space or press Esc to " +
        "go back up. Use Spread to pull the parts apart. Dotted words " +
        "open a definition; you can also highlight any word to look it up.",
    whatItDoes: "What it does",
    mainDivisions: "Main divisions",
    lobes: "Lobes",
    structures: "Structures",
    sections: "Sections",
    clinical: "Clinical relevance",
    damaged: "When it's damaged",
    didYouKnow: "Did you know",
    gettingHelp: "Getting help",
    linked: "Linked conditions",
    psychology: "Psychology",
    diseases: "Diseases",
    alsoIn: "Also in the {name}",
    searchDisorders: "Search disorders",
    searchDiseases: "Search diseases",
    phPsych: "e.g. borderline, OCD, anxiety",
    phDisease: "e.g. Alzheimer's, stroke, tremor",
    countOf: "{n} of {t} {noun}",
    disordersNoun: "disorders",
    diseasesNoun: "diseases",
    noMatch: "No {noun} match “{q}”.",
    notePsych:
        "Organized by DSM-5-TR category. Choose a disorder to see its " +
        "full write-up and the brain areas research links to it.",
    noteDisease:
        "Choose a disease to see its full write-up and the brain areas " +
        "it affects.",
    allDisorders: "All disorders",
    allDiseases: "All diseases",
    alsoCalled: "Also called {s}",
    secOverview: "Overview",
    secBrain: "Brain areas highlighted on the model",
    secSymptoms: "Signs and symptoms",
    secDiagnosis: "How it is diagnosed",
    secTypesD: "Types and stages",
    secTypesP: "Types and presentations",
    secCauses: "Causes and risk factors",
    secTreatment: "Treatment",
    secCourse: "Course and outlook",
    secCommon: "How common",
    condNote:
        "Brain findings describe average differences found in research " +
        "groups. They can't diagnose an individual, and brain changes may " +
        "be a cause, a consequence or both. This is a study reference, " +
        "not medical advice.",
    fAll: "All",
    fTerm: "Terms",
    fRegion: "Regions",
    fPsych: "Psychology",
    fDisease: "Disease",
    tTerm: "Term",
    tRegion: "Region",
    tPsych: "Psychology",
    tDisease: "Disease",
    entriesOf: "{n} of {t} entries",
    nothingMatches: "Nothing matches “{q}”.",
    showOnModel: "Show on the model",
    openEntry: "Open full entry",
    dictionary: "Dictionary",
    close: "Close",
    seeInDict: "See in the dictionary",
    brainRegion: "Brain region",
    openHighlight: "Open and highlight on the model",
    notInDict:
        "This isn't in the dictionary. It's likely an everyday word " +
        "rather than a brain or medical term.",
    browseDict: "Browse the dictionary",
    about: "About",
    introTitle: "Explore the human brain in 3D",
    introLead:
        "An interactive atlas for students, teachers and anyone curious " +
        "about how the brain is built and what changes when illness " +
        "affects it.",
    introPoint1: "Take it apart, from the hemispheres down to {p} parts",
    introPoint2:
        "See which areas {c} psychological and neurological conditions " +
        "involve",
    introPoint3: "Look up any term in a {e}-entry dictionary",
    introCta: "Explore the brain",
    introMeta:
        "Free, no sign-up, in English and Spanish. A study reference, " +
        "not medical advice.",
    loadingTitle: "Loading the 3D brain",
    loadingNote: "You can read and search while it loads.",
    errWebglTitle: "The 3D view can't start on this device",
    errWebglBody:
        "Your browser didn't allow WebGL, which draws the model. " +
        "Everything else works: choose a region from the list, open a " +
        "condition or search the dictionary.",
    errWebglFix:
        "To see the model, turn on hardware acceleration in your browser " +
        "settings or open this page in another browser.",
    errBuildTitle: "The 3D model didn't finish building",
    errBuildBody:
        "Reload the page to try again. The lists, conditions and " +
        "dictionary still work.",
    errLostTitle: "The 3D view was paused by your device",
    errLostBody:
        "This can happen when a device runs low on memory. It may come " +
        "back on its own; if not, reload the page.",
    tryAgain: "Try again",
    reloadPage: "Reload page",
    dismiss: "Dismiss",
    // Shown in both languages: the Spanish text is what failed to load.
    errSpanish:
        "Spanish couldn't be downloaded, so the page stays in English. " +
        "Check your connection and try again. / No se pudo descargar el " +
        "español. Revisa tu conexión e inténtalo de nuevo.",
    errWriteUp:
        "The full write-up couldn't be downloaded, so this is the short " +
        "version. Check your connection and open the condition again.",
};

export type UiKey = keyof typeof UI_EN;

const STORAGE_KEY = "ibm-lang";

let lang: Lang = readSavedLang();
let spanishUi: Record<string, string> = {};

function readSavedLang(): Lang {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "es" || saved === "en") return saved;
    } catch {
        // Storage can be unavailable (private mode, blocked cookies).
    }
    return "en";
}

export function currentLang(): Lang {
    return lang;
}

/**
 * Switches language and, unless `remember` is false, remembers the
 * choice on this device.
 */
export function setLang(
    next: Lang,
    spanish: SpanishData | null,
    remember = true,
): void {
    lang = next;
    spanishUi = spanish?.ui ?? {};
    if (!remember) return;
    try {
        localStorage.setItem(STORAGE_KEY, next);
    } catch {
        // Not remembering the choice is fine.
    }
}

/** Registers the Spanish strings without changing the language. */
export function useSpanishUi(spanish: SpanishData | null): void {
    spanishUi = spanish?.ui ?? {};
}

/**
 * Looks up an interface string in the current language and fills in
 * {placeholders}. Unknown keys fall back to the key itself.
 */
export function t(
    key: UiKey | string,
    vars?: Record<string, string | number>,
): string {
    let text =
        (lang === "es" && spanishUi[key]) ||
        (UI_EN as Record<string, string>)[key] ||
        key;
    if (vars) {
        for (const name in vars) {
            text = text.split("{" + name + "}").join(String(vars[name]));
        }
    }
    return text;
}
