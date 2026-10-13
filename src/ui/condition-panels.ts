// The Psychology and Diseases tabs: a searchable list grouped by
// category, and each condition's full write-up.
import { DISEASES, PSYCH } from "../app/conditions";
import { linkify } from "../app/dictionary-index";
import { t } from "../app/i18n";
import { S } from "../app/structures";
import type { Condition, ConditionKind } from "../app/types";
import { esc, firstSentence } from "../app/util";

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
        `<label class="eyebrow" for="q-${kind}">${label}</label>` +
        `<input class="search" id="q-${kind}" type="search" ` +
        `placeholder="${esc(placeholder)}" autocomplete="off">` +
        `<p class="count"></p><div class="clist"></div>` +
        `<p class="note">${note}</p>`;
    const input = view.querySelector<HTMLInputElement>(".search")!;
    const list = view.querySelector<HTMLElement>(".clist")!;
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
                            `<li><button type="button" class="citem" ` +
                            `data-cond="${c.key}"><span class="t">` +
                            `${esc(c.name)}` +
                            `${alias ? `<small>${esc(alias)}</small>` : ""}` +
                            `</span><span class="d">` +
                            `${esc(firstSentence(c.summary))}</span>` +
                            `</button></li>`
                        );
                    })
                    .join("");
                return `<h4>${esc(cat)}</h4><ul>${items}</ul>`;
            })
            .join("");
    };
    input.addEventListener("input", draw);
    draw();
}

function accordion(title: string, body: string, open: boolean): string {
    return (
        `<details class="acc"${open ? " open" : ""}>` +
        `<summary>${esc(title)}</summary>` +
        `<div class="acc-b">${body}</div></details>`
    );
}

export function renderConditionDetail(c: Condition): void {
    const view = document.getElementById(CONDITION_VIEWS[c.kind])!;
    const seen = new Set(["c:" + c.key]);
    const areas = c.brain
        .slice()
        .sort((a, b) => (a[1] === b[1] ? 0 : a[1] === "p" ? -1 : 1));
    const paragraph = (text: string) =>
        `<p class="para">${linkify(text, seen)}</p>`;
    const paragraphs = (text: string | string[] | undefined) =>
        ([] as string[])
            .concat(text ?? [])
            .map(paragraph)
            .join("");

    let h =
        `<button type="button" class="back" data-back="${c.kind}">` +
        `${c.kind === "psych" ? t("allDisorders") : t("allDiseases")}` +
        `</button>`;
    h +=
        `<p class="eyebrow" style="--c:var(--hot)"><i></i>${esc(c.cat)}</p>` +
        `<h2>${esc(c.name)}</h2>`;
    const alias = shortAlias(c);
    if (alias)
        h += `<p class="alias">${esc(t("alsoCalled", { s: alias }))}</p>`;

    h += `<div class="accs">`;
    h += accordion(
        t("secOverview"),
        (c.overview || [c.summary]).map(paragraph).join(""),
        true,
    );
    let areaList =
        `<div class="key"><span><i style="background:var(--hot)"></i>` +
        `${t("primary")}</span><span><i style="background:var(--warm)"></i>` +
        `${t("alsoInvolved")}</span></div><ul class="areas">`;
    for (const [id, lv, note] of areas) {
        const node = S[id];
        const region = node.isTop
            ? ""
            : `<small>${esc(S[node.topId!].name)}</small>`;
        areaList +=
            `<li><span class="sw" style="background:` +
            `${lv === "p" ? "var(--hot)" : "var(--warm)"}"></span>` +
            `<button type="button" class="go" data-focus="${id}">` +
            `${esc(node.name)}${region}</button>` +
            `<p>${linkify(note, seen)}</p></li>`;
    }
    areaList += `</ul>`;
    h += accordion(t("secBrain"), areaList, true);
    h += accordion(
        t("secSymptoms"),
        `<ul class="fx" style="--c:var(--hot)">` +
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
            `<div class="fact"><b>` +
            `${c.helpFact ? t("gettingHelp") : t("didYouKnow")}</b>` +
            `${linkify(c.fact, seen)}</div>`;
    }
    h += `<p class="note">${t("condNote")}</p>`;
    view.innerHTML = h;
    view.scrollTop = 0;
}
