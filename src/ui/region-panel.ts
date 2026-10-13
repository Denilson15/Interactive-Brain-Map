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
/** A dot showing involvement: filled = primary, ring = also involved. */
export function involvementSwatch(lv: Involvement): string {
    const variant = lv === "p" ? "primary" : "secondary";
    return `<span class="swatch swatch--${variant}"></span>`;
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
                `<button type="button" class="chip" data-cond="${c.key}">` +
                `${involvementSwatch(lv)}${esc(c.short || c.name)}</button>`,
        )
        .join("");
}

function partCard(node: StructureNode, side: Side, current: boolean): string {
    const cardSide = node.isHemi ? node.side : node.lat ? side : "";
    const count = node.isGroup
        ? `<span class="meta">${t("nParts", { n: node.kids.length })}</span>`
        : "";
    return (
        `<button type="button" class="card" data-node="${node.id}" ` +
        `data-side="${cardSide}"${current ? ' aria-current="true"' : ""}>` +
        `<span class="card-title"><span class="swatch" ` +
        `style="--swatch:${node.color}"></span>${esc(node.name)}${count}` +
        `</span><span class="card-text">` +
        `${esc(firstSentence(node.summary || ""))}</span></button>`
    );
}

function breadcrumbs(): string {
    const path = pathKeys(state.sel, state.selSide).reverse();
    const items = path.map((key, i) => {
        const { id, side } = parseKey(key);
        const name = esc(S[id].name);
        if (i === path.length - 1) {
            return `<li aria-current="page">${name}</li>`;
        }
        const crumbSide = side || (S[id].isHemi ? S[id].side : "");
        return (
            `<li><button type="button" data-node="${id}" ` +
            `data-side="${crumbSide}">${name}</button></li>`
        );
    });
    return `<ol class="breadcrumbs">${items.join("")}</ol>`;
}

/** How a structure is classified, e.g. ["Left", "Cerebral cortex"]. */
function classification(node: StructureNode, side: Side): string[] {
    const tags: string[] = [];
    if (node.lat && !node.isHemi)
        tags.push(side === "L" ? t("left") : t("right"));
    if (node.kind) tags.push(...node.kind.split(" · "));
    else if (node.isGroup) tags.push(S[node.topId!].name, t("group"));
    else if (node.isLeaf) {
        tags.push(S[node.topId!].name);
        if (groupOf[node.id]) tags.push(S[groupOf[node.id]].name);
    }
    return tags;
}

export function renderRegion(): void {
    const { sel, selSide } = state;
    const node = S[sel];
    const seen = new Set(["s:" + node.id]);

    let h = breadcrumbs();
    h +=
        `<ul class="tags">` +
        classification(node, selSide)
            .map((tag, i) => {
                // The first tag carries the structure's color.
                const dot =
                    i === 0
                        ? `<span class="swatch" style="--swatch:${node.color}">` +
                          `</span>`
                        : "";
                return `<li class="tag">${dot}${esc(tag)}</li>`;
            })
            .join("") +
        `</ul>`;
    h += `<h2 class="title">${esc(node.name)}</h2>`;
    if (node.short && node.short !== node.name) {
        const alias = t("labelOnModel", { s: node.short });
        h += `<p class="meta alias">${esc(alias)}</p>`;
    }
    if (node.where) {
        h +=
            `<p class="where"><span class="where-label">${t("where")}</span> ` +
            `${linkify(node.where, seen)}</p>`;
    }
    h +=
        `<div class="closer" id="closer"></div><p class="meta closer-caption">` +
        `${isLeafNode(sel) ? t("capLeaf") : t("capGroup")}</p>`;
    if (sel === "brain") h += `<p class="notice helpline">${t("help")}</p>`;
    if (node.summary) {
        h += `<p class="reading">${linkify(node.summary, seen)}</p>`;
    }
    if (node.does) {
        h +=
            `<h3 class="section-title">${t("whatItDoes")}</h3>` +
            `<ul class="reading-list" style="--swatch:${node.color}">` +
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
            `<h3 class="section-title">${label} ` +
            `<span class="meta">${node.kids.length}</span></h3>` +
            `<div class="cards">` +
            node.kids.map((c) => partCard(c, selSide, false)).join("") +
            `</div>`;
    }
    const damage = node.damage || node.clinical;
    if (damage) {
        h +=
            `<h3 class="section-title">` +
            `${node.clinical ? t("clinical") : t("damaged")}</h3>` +
            `<p class="reading">${linkify(damage, seen)}</p>`;
    }
    if (node.fact) {
        h +=
            `<div class="callout"><p class="callout-title">` +
            `${t("didYouKnow")}</p><p class="reading">` +
            `${linkify(node.fact, seen)}</p></div>`;
    }
    const links = linkedConditions(node.id);
    if (links.size) {
        const psych = conditionChips(links, "psych");
        const disease = conditionChips(links, "disease");
        h +=
            `<h3 class="section-title">${t("linked")}</h3>` +
            `<p class="meta involvement-key">` +
            `${involvementSwatch("p")}${t("primary")}` +
            `${involvementSwatch("s")}${t("alsoInvolved")}</p>`;
        if (psych) {
            h +=
                `<h4 class="subsection-title">${t("psychology")}</h4>` +
                `<div class="chip-row">${psych}</div>`;
        }
        if (disease) {
            h +=
                `<h4 class="subsection-title">${t("diseases")}</h4>` +
                `<div class="chip-row">${disease}</div>`;
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
                `<h3 class="section-title">` +
                `${esc(t("alsoIn", { name: parentName }))}</h3>` +
                `<div class="cards">` +
                parent.kids
                    .map((c) => partCard(c, selSide, c.id === node.id))
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
