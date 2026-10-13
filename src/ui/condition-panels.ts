// The Psychology and Diseases tabs: a searchable list grouped by
// category, and each condition's full write-up.
import { DISEASES, PSYCH } from "../app/conditions";
import { linkify } from "../app/dictionary-index";
import { t } from "../app/i18n";
import { S } from "../app/structures";
import type { Condition, ConditionKind } from "../app/types";
import { esc, firstSentence } from "../app/util";
import { ICONS } from "./icons";
import { involvementSwatch } from "./region-panel";

export const CONDITION_VIEWS: Record<ConditionKind, string> = {
    psych: "view-psych",
    disease: "view-disease",
};

/** Shows the short name only when it adds something to the full name. */
function shortAlias(c: Condition): string | null {
    return c.short && c.short !== c.name && !c.name.includes(c.short)
        ? c.short
        : null;
}

export function renderConditionList(kind: ConditionKind): void {
    const view = document.getElementById(CONDITION_VIEWS[kind])!;
    const data = kind === "psych" ? PSYCH : DISEASES;
    const noun = kind === "psych" ? t("disordersNoun") : t("diseasesNoun");
    const label = kind === "psych" ? t("searchDisorders") : t("searchDiseases");
    const placeholder = kind === "psych" ? t("phPsych") : t("phDisease");
    const note = kind === "psych" ? t("notePsych") : t("noteDisease");
    view.innerHTML =
        `<label class="field" for="q-${kind}">${label}</label>` +
        `<input class="search" id="q-${kind}" type="search" ` +
        `placeholder="${esc(placeholder)}" autocomplete="off">` +
        `<p class="meta count"></p><div class="condition-list"></div>` +
        `<p class="meta panel-note">${note}</p>`;
    const input = view.querySelector<HTMLInputElement>(".search")!;
    const list = view.querySelector<HTMLElement>(".condition-list")!;
    const count = view.querySelector<HTMLElement>(".count")!;

    const draw = (): void => {
        const q = input.value.trim().toLowerCase();
        const matches = data.filter(
            (c) =>
                !q ||
                c.name.toLowerCase().includes(q) ||
                (c.aka || []).some((a) => a.toLowerCase().includes(q)) ||
                c.cat.toLowerCase().includes(q) ||
                c.summary.toLowerCase().includes(q),
        );
        count.textContent = t("countOf", {
            n: matches.length,
            t: data.length,
            noun,
        });
        if (!matches.length) {
            list.innerHTML = `<p class="empty">${esc(
                t("noMatch", { noun, q: input.value }),
            )}</p>`;
            return;
        }
        const categories: string[] = [];
        for (const c of matches) {
            if (!categories.includes(c.cat)) categories.push(c.cat);
        }
        list.innerHTML = categories
            .map((cat) => {
                const items = matches
                    .filter((c) => c.cat === cat)
                    .map((c) => {
                        const alias = shortAlias(c);
                        return (
                            `<li><button type="button" class="list-item" ` +
                            `data-cond="${c.key}">` +
                            `<span class="list-item-title">${esc(c.name)}` +
                            `${alias ? ` <span class="meta">${esc(alias)}</span>` : ""}` +
                            `</span><span class="list-item-text">` +
                            `${esc(firstSentence(c.summary))}</span>` +
                            `</button></li>`
                        );
                    })
                    .join("");
                return (
                    `<h3 class="list-heading">${esc(cat)}</h3>` +
                    `<ul class="list">${items}</ul>`
                );
            })
            .join("");
    };
    input.addEventListener("input", draw);
    draw();
}

function accordion(title: string, body: string, open: boolean): string {
    return (
        `<details class="accordion"${open ? " open" : ""}>` +
        `<summary>${esc(title)}${ICONS.chevronDown}</summary>` +
        `<div class="accordion-body">${body}</div></details>`
    );
}

export function renderConditionDetail(c: Condition): void {
    const view = document.getElementById(CONDITION_VIEWS[c.kind])!;
    const seen = new Set(["c:" + c.key]);
    const areas = c.brain
        .slice()
        .sort((a, b) => (a[1] === b[1] ? 0 : a[1] === "p" ? -1 : 1));
    const paragraph = (text: string) =>
        `<p class="reading">${linkify(text, seen)}</p>`;
    const paragraphs = (text: string | string[] | undefined) =>
        ([] as string[])
            .concat(text ?? [])
            .map(paragraph)
            .join("");

    let h =
        `<button type="button" class="button button--quiet back" ` +
        `data-back="${c.kind}">${ICONS.arrowLeft}` +
        `${c.kind === "psych" ? t("allDisorders") : t("allDiseases")}` +
        `</button>`;
    h +=
        `<ul class="tags"><li class="tag">${esc(c.cat)}</li></ul>` +
        `<h2 class="title">${esc(c.name)}</h2>`;
    const alias = shortAlias(c);
    if (alias) {
        h += `<p class="meta alias">${esc(t("alsoCalled", { s: alias }))}</p>`;
    }

    h += `<div class="accordions">`;
    h += accordion(
        t("secOverview"),
        (c.overview || [c.summary]).map(paragraph).join(""),
        true,
    );
    let areaList =
        `<p class="meta involvement-key">` +
        `${involvementSwatch("p")}${t("primary")}` +
        `${involvementSwatch("s")}${t("alsoInvolved")}</p>` +
        `<ul class="areas">`;
    for (const [id, lv, note] of areas) {
        const node = S[id];
        const region = node.isTop
            ? ""
            : ` <span class="meta">${esc(S[node.topId!].name)}</span>`;
        areaList +=
            `<li>${involvementSwatch(lv)}` +
            `<button type="button" class="area-name" data-focus="${id}">` +
            `${esc(node.name)}${region}</button>` +
            `<p class="area-note">${linkify(note, seen)}</p></li>`;
    }
    areaList += `</ul>`;
    h += accordion(t("secBrain"), areaList, true);
    h += accordion(
        t("secSymptoms"),
        `<ul class="reading-list">` +
            c.symptoms.map((s) => `<li>${linkify(s, seen)}</li>`).join("") +
            `</ul>`,
        false,
    );
    if (c.diagnosis) {
        h += accordion(t("secDiagnosis"), paragraphs(c.diagnosis), false);
    }
    if (c.types) {
        h += accordion(
            c.kind === "disease" ? t("secTypesD") : t("secTypesP"),
            paragraphs(c.types),
            false,
        );
    }
    h += accordion(t("secCauses"), paragraphs(c.causes), false);
    h += accordion(t("secTreatment"), paragraphs(c.treatment), false);
    if (c.course) h += accordion(t("secCourse"), paragraphs(c.course), false);
    h += accordion(t("secCommon"), paragraph(c.prevalence), false);
    h += `</div>`;
    if (c.fact) {
        h +=
            `<div class="callout"><p class="callout-title">` +
            `${c.helpFact ? t("gettingHelp") : t("didYouKnow")}</p>` +
            `<p class="reading">${linkify(c.fact, seen)}</p></div>`;
    }
    h += `<p class="meta panel-note">${t("condNote")}</p>`;
    view.innerHTML = h;
    view.scrollTop = 0;
}
