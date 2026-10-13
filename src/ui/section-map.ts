// The section map: every part of the brain as chips, grouped by
// hemisphere, deep structures and hindbrain. It sits under the model on
// larger screens and moves into the Browse tab on phones.
import { t } from "../app/i18n";
import { state } from "../app/state";
import { S, keyOf, pathKeys } from "../app/structures";
import type { Side, StructureNode } from "../app/types";
import { esc, isPhoneLayout } from "../app/util";

let mapEl: HTMLElement;

function chip(
    id: string,
    side: Side | null,
    label: string,
    color: string,
    pressed: boolean,
    cls?: string,
): string {
    return (
        `<button type="button" class="chip${cls ? " " + cls : ""}" ` +
        `data-node="${id}" data-side="${side || ""}" style="--c:${color}" ` +
        `aria-pressed="${pressed}"><i></i>${esc(label)}</button>`
    );
}

export function renderMap(): void {
    const selectedPath = pathKeys(state.sel, state.selSide);
    const inPath = (key: string) => selectedPath.includes(key);
    const sk = keyOf(state.sel, state.selSide);

    const section = (
        title: string,
        headId: string | null,
        headSide: Side | null,
        kids: StructureNode[],
        kidSide: Side | null,
        color: string,
    ): string => {
        const headKey = headId ? keyOf(headId, headSide as Side) : null;
        const kidKey = (k: StructureNode) =>
            keyOf(k.id, (k.lat ? kidSide : "L") as Side);
        const active =
            (headKey && inPath(headKey)) || kids.some((k) => inPath(kidKey(k)));
        const head = headId
            ? `<button type="button" class="sec-t" data-node="${headId}" ` +
              `data-side="${headSide || ""}" ` +
              `aria-pressed="${headKey === sk}">${esc(title)}</button>`
            : `<span class="sec-t">${esc(title)}</span>`;
        let h =
            `<div class="sec${active ? " open" : ""}" style="--c:${color}">` +
            `<div class="sec-h">${head}</div><div class="sec-row">`;
        h += kids
            .map((k) =>
                chip(
                    k.id,
                    k.lat ? kidSide : null,
                    k.name,
                    k.color,
                    inPath(kidKey(k)),
                ),
            )
            .join("");
        h += "</div>";

        // Expand the region on the selection path to show its parts.
        const open = kids.find((k) => inPath(kidKey(k)));
        if (open && open.kids && open.kids.length) {
            h += `<div class="sub-map" style="--c:${open.color}">`;
            const groups = open.kids.filter((k) => k.isGroup);
            const singles = open.kids.filter((k) => !k.isGroup);
            const partChips = (parts: StructureNode[]) =>
                parts
                    .map((l) =>
                        chip(
                            l.id,
                            l.lat ? kidSide : null,
                            l.short || l.name,
                            l.color,
                            inPath(keyOf(l.id, kidSide as Side)),
                            "sm",
                        ),
                    )
                    .join("");
            for (const g of groups) {
                h +=
                    `<div class="grp"><button type="button" class="grp-t" ` +
                    `data-node="${g.id}" data-side="${g.lat ? kidSide : ""}" ` +
                    `aria-pressed="${keyOf(g.id, kidSide as Side) === sk}">` +
                    `${esc(g.name)}</button>` +
                    `<div class="grp-row">${partChips(g.kids)}</div></div>`;
            }
            if (singles.length) {
                const label = groups.length ? t("otherParts") : t("parts");
                h +=
                    `<div class="grp"><span class="grp-t plain">${label}` +
                    `</span><div class="grp-row">${partChips(singles)}</div>` +
                    `</div>`;
            }
            h += "</div>";
        }
        return h + "</div>";
    };

    let h = section(
        S.hemiL.name,
        "hemiL",
        "L",
        S.hemiL.kids,
        "L",
        S.hemiL.color,
    );
    h += section(S.hemiR.name, "hemiR", "R", S.hemiR.kids, "R", S.hemiR.color);
    h += section(S.deep.name, "deep", null, S.deep.kids, null, S.deep.color);
    h += section(
        t("hindbrain"),
        null,
        null,
        [S.cerebellum, S.brainstem],
        null,
        "#B58BD6",
    );
    mapEl.innerHTML = h;
}

/** Puts the map in the Browse tab on phones, under the model otherwise. */
export function placeMap(onLeaveBrowse: () => void): void {
    const browseView = document.getElementById("view-browse")!;
    const desktopHome = document.querySelector<HTMLElement>(".left")!;
    const phone = isPhoneLayout();
    if (phone && mapEl.parentElement !== browseView) {
        browseView.appendChild(mapEl);
    }
    if (!phone && mapEl.parentElement !== desktopHome) {
        desktopHome.appendChild(mapEl);
        if (state.activeTab === "browse") onLeaveBrowse();
    }
}

export function initSectionMap(
    onSelect: (id: string, side: Side | "") => void,
): void {
    mapEl = document.getElementById("chips")!;
    mapEl.addEventListener("click", (e) => {
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
