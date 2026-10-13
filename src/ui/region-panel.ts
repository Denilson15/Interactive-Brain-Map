// The Region tab: the selected structure's description, close-up, parts
// and linked conditions.
import { CONDS, LINKED } from "../app/conditions";
import { linkify } from "../app/dictionary-index";
import { currentLang, t } from "../app/i18n";
import { state } from "../app/state";
import {
    S,
    descendantIds,
    groupOf,
    isLeafNode,
    parentOf,
    parseKey,
    pathKeys,
} from "../app/structures";
import type {
    ConditionKind,
    Involvement,
    Side,
    StructureNode,
} from "../app/types";
import { esc, firstSentence } from "../app/util";
import { closeUpCanvas, sizeCloseUp } from "../scene/stage";

let regionView: HTMLElement;

/** Conditions linked to a structure or anything inside it. */
function linkedConditions(id: string): Map<string, Involvement> {
    const node = S[id];
    if (node.isRoot || node.isHemi || node.isGroupRoot) return new Map();
    const ids = descendantIds(node);
    // Parts and groups also inherit links made to their region/group.
    if (node.isLeaf || node.isGroup) {
        ids.push(node.topId!);
        if (node.isLeaf && groupOf[id]) ids.push(groupOf[id]);
    }
    const out = new Map<string, Involvement>();
    for (const i of ids) {
        for (const { c, lv } of LINKED[i] || []) {
            const previous = out.get(c.key);
            if (!previous || (lv === "p" && previous !== "p")) {
                out.set(c.key, lv);
            }
        }
    }
    return out;
}

/** Condition chips of one kind, primary links first, then by name. */
function conditionChips(
    links: Map<string, Involvement>,
    kind: ConditionKind,
): string {
    return [...links.entries()]
        .map(([key, lv]) => ({ c: CONDS[key], lv }))
        .filter((x) => x.c.kind === kind)
        .sort(
            (a, b) =>
                (a.lv === b.lv ? 0 : a.lv === "p" ? -1 : 1) ||
                a.c.name.localeCompare(b.c.name),
        )
        .map(
            ({ c, lv }) =>
                `<button type="button" class="chip cond" ` +
                `data-cond="${c.key}" style="--c:${
                    lv === "p" ? "var(--hot)" : "var(--warm)"
                }"><i></i>${esc(c.short || c.name)}</button>`,
        )
        .join("");
}

function subCard(node: StructureNode, side: Side, current: boolean): string {
    const cardSide = node.isHemi ? node.side : node.lat ? side : "";
    const count = node.isGroup
        ? `<small>${t("nParts", { n: node.kids.length })}</small>`
        : "";
    return (
        `<button type="button" class="subcard" data-node="${node.id}" ` +
        `data-side="${cardSide}" style="--c:${node.color}"` +
        `${current ? ' aria-current="true"' : ""}>` +
        `<span class="nm"><i></i>${esc(node.name)}${count}</span>` +
        `<span class="ds">${esc(firstSentence(node.summary || ""))}</span>` +
        `</button>`
    );
}

function breadcrumbs(): string {
    const path = pathKeys(state.sel, state.selSide).reverse();
    const items = path.map((key, i) => {
        const { id, side } = parseKey(key);
        const name = S[id].name;
        if (i === path.length - 1) return `<span>${esc(name)}</span>`;
        const crumbSide = side || (S[id].isHemi ? S[id].side : "");
        return (
            `<button type="button" data-node="${id}" ` +
            `data-side="${crumbSide}">${esc(name)}</button><span>›</span>`
        );
    });
    return `<div class="crumbs">${items.join("")}</div>`;
}

export function renderRegion(): void {
    const { sel, selSide } = state;
    const node = S[sel];
    const seen = new Set(["s:" + node.id]);
    const sideName =
        node.lat && !node.isHemi
            ? selSide === "L"
                ? t("left")
                : t("right")
            : "";
    let kind =
        node.kind ||
        (node.isGroup
            ? S[node.topId!].name + " · " + t("group")
            : node.isLeaf
              ? S[node.topId!].name +
                (groupOf[node.id] ? " · " + S[groupOf[node.id]].name : "")
              : "");
    if (sideName) kind = sideName + " · " + kind;

    let h = breadcrumbs();
    h +=
        `<p class="eyebrow" style="--c:${node.color}"><i></i>${esc(kind)}</p>` +
        `<h2>${esc(node.name)}</h2>`;
    if (node.short && node.short !== node.name) {
        const alias = t("labelOnModel", { s: node.short });
        h += `<p class="alias">${esc(alias)}</p>`;
    }
    if (node.where) {
        h +=
            `<p class="where"><b>${t("where")}</b>` +
            `${linkify(node.where, seen)}</p>`;
    }
    h +=
        `<div class="closer" id="closer"></div><p class="cap">` +
        `${isLeafNode(sel) ? t("capLeaf") : t("capGroup")}</p>`;
    if (sel === "brain") h += `<p class="helpline">${t("help")}</p>`;
    if (node.summary) {
        h += `<p class="summary">${linkify(node.summary, seen)}</p>`;
    }
    if (node.does) {
        h +=
            `<h3>${t("whatItDoes")}</h3>` +
            `<ul class="fx" style="--c:${node.color}">` +
            node.does.map((d) => `<li>${linkify(d, seen)}</li>`).join("") +
            `</ul>`;
    }
    if (node.kids && node.kids.length) {
        const label = node.isRoot
            ? t("mainDivisions")
            : node.isHemi
              ? t("lobes")
              : node.isGroupRoot
                ? t("structures")
                : node.isGroup
                  ? t("parts")
                  : t("sections");
        h +=
            `<h3>${label} <span class="n">${node.kids.length}</span></h3>` +
            `<div class="subgrid">` +
            node.kids.map((c) => subCard(c, selSide, false)).join("") +
            `</div>`;
    }
    const damage = node.damage || node.clinical;
    if (damage) {
        h +=
            `<h3>${node.clinical ? t("clinical") : t("damaged")}</h3>` +
            `<p class="para">${linkify(damage, seen)}</p>`;
    }
    if (node.fact) {
        h +=
            `<div class="fact"><b>${t("didYouKnow")}</b>` +
            `${linkify(node.fact, seen)}</div>`;
    }
    const links = linkedConditions(node.id);
    if (links.size) {
        const psych = conditionChips(links, "psych");
        const disease = conditionChips(links, "disease");
        h += `<h3>${t("linked")}</h3>`;
        if (psych) {
            h +=
                `<p class="key" style="margin-top:8px">${t("psychology")}</p>` +
                `<div class="links">${psych}</div>`;
        }
        if (disease) {
            h +=
                `<p class="key" style="margin-top:10px">${t("diseases")}</p>` +
                `<div class="links">${disease}</div>`;
        }
    }
    if (isLeafNode(sel)) {
        const parent = S[parentOf(sel, selSide)!];
        if (parent && parent.kids) {
            const parentName =
                currentLang() === "es"
                    ? parent.name
                    : parent.name.toLowerCase();
            h +=
                `<h3>${esc(t("alsoIn", { name: parentName }))}</h3>` +
                `<div class="subgrid">` +
                parent.kids
                    .map((c) => subCard(c, selSide, c.id === node.id))
                    .join("") +
                `</div>`;
        }
    }
    regionView.innerHTML = h;
    regionView.scrollTop = 0;
    document.getElementById("closer")!.appendChild(closeUpCanvas);
    sizeCloseUp();
}

export function initRegionPanel(
    onSelect: (id: string, side: Side | "") => void,
): void {
    regionView = document.getElementById("view-region")!;
    regionView.addEventListener("click", (e) => {
        const button = (e.target as Element).closest<HTMLElement>(
            "[data-node]",
        );
        if (!button) return;
        onSelect(
            button.dataset.node!,
            (button.dataset.side || "") as Side | "",
        );
    });
}
