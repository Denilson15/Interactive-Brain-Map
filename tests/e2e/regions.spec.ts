import {
    test,
    expect,
    regionHeading,
    breadcrumbs,
    namesOf,
} from "./fixtures";

test.describe("region hierarchy", () => {
    test("every structure opens with the right heading and breadcrumb",
        async ({ app }) => {
            // Selects every node on both sides (for lateralized parts) and
            // checks the panel heading and last breadcrumb match its name.
            const problems = await app.evaluate(() => {
                const { S, selectNode } = (window as any).__atlas;
                const found: string[] = [];
                for (const id of Object.keys(S)) {
                    const node = S[id];
                    const sides = node.lat && !node.isHemi
                        ? ["L", "R"]
                        : [node.isHemi ? node.side : "L"];
                    for (const side of sides) {
                        selectNode(id, side, { focus: false });
                        const view = document.getElementById("view-region")!;
                        const heading = view.querySelector("h2")?.textContent;
                        if (heading !== node.name) {
                            found.push(`${id}@${side}: heading "${heading}"`);
                        }
                        const crumbs = view.querySelectorAll(".crumbs > *");
                        const last = crumbs[crumbs.length - 1]?.textContent;
                        if (last !== node.name) {
                            found.push(`${id}@${side}: crumb "${last}"`);
                        }
                    }
                }
                return found;
            });
            expect(problems).toEqual([]);
        });

    test("the drill-down tree matches the reference snapshot",
        async ({ app }) => {
            // Starting at the whole brain, follow the part cards the panel
            // actually renders and record every level reached. Comparing
            // against a committed snapshot (not the app's own data) catches
            // any part that becomes unreachable or moves in the tree.
            const tree = await app.evaluate(() => {
                const { selectNode } = (window as any).__atlas;
                const result: Record<string, string[]> = {};
                const queue: [string, string][] = [["brain", "L"]];
                while (queue.length) {
                    const [id, side] = queue.shift()!;
                    const key = `${id}@${side}`;
                    if (key in result) continue;
                    selectNode(id, side, { focus: false });
                    const cards = [...document.querySelectorAll(
                        "#view-region .subgrid .subcard",
                    )] as HTMLElement[];
                    result[key] = cards.map((card) =>
                        `${card.dataset.node}@${card.dataset.side || side}`);
                    for (const card of cards) {
                        queue.push([
                            card.dataset.node!,
                            card.dataset.side || side,
                        ]);
                    }
                }
                return result;
            });
            expect(JSON.stringify(tree, null, 4) + "\n")
                .toMatchSnapshot("drill-down-tree.json");
        });

    test("start-up reports no missing geometry or unknown structures",
        async ({ app, consoleWarnings }) => {
            // app.js warns when data and generated geometry disagree.
            const dataWarnings = consoleWarnings.filter((text) =>
                /No geometry|Unknown structure|Missing leaf/.test(text),
            );
            expect(dataWarnings).toEqual([]);
            await expect(app.locator("h1")).toBeVisible();
        });

    test("drills down through every level by clicking, then back up",
        async ({ app }) => {
            const names = await namesOf(app, [
                "brain", "hemiL", "frontal", "g_pfc", "dlpfc",
            ]);
            await expect(regionHeading(app)).toHaveText(names.brain);

            // Level 1: hemisphere, from the section map under the model.
            await app.locator('#chips [data-node="hemiL"]').first().click();
            await expect(regionHeading(app)).toHaveText(names.hemiL);

            // Levels 2-4: lobe, group, part, from the cards in the panel.
            for (const id of ["frontal", "g_pfc", "dlpfc"]) {
                await app.locator(`#view-region .subcard[data-node="${id}"]`)
                    .first().click();
                await expect(regionHeading(app)).toHaveText(names[id]);
            }
            expect(await breadcrumbs(app)).toEqual([
                names.brain, names.hemiL, names.frontal, names.g_pfc,
                names.dlpfc,
            ]);

            // Back up: toolbar button, Escape key, then a breadcrumb.
            await app.locator("#upBtn").click();
            await expect(regionHeading(app)).toHaveText(names.g_pfc);
            await app.keyboard.press("Escape");
            await expect(regionHeading(app)).toHaveText(names.frontal);
            await app.locator("#view-region .crumbs button")
                .filter({ hasText: names.brain }).click();
            await expect(regionHeading(app)).toHaveText(names.brain);
        });

    test("reaches deep structures and the hindbrain", async ({ app }) => {
        const names = await namesOf(app, [
            "deep", "basalganglia", "g_striatum", "caudate", "cerebellum",
            "vermis",
        ]);
        await app.locator('#chips [data-node="deep"]').first().click();
        await expect(regionHeading(app)).toHaveText(names.deep);
        for (const id of ["basalganglia", "g_striatum", "caudate"]) {
            await app.locator(`#view-region .subcard[data-node="${id}"]`)
                .first().click();
            await expect(regionHeading(app)).toHaveText(names[id]);
        }

        await app.locator('#chips [data-node="cerebellum"]').first().click();
        await expect(regionHeading(app)).toHaveText(names.cerebellum);
        await app.locator('#view-region .subcard[data-node="vermis"]')
            .first().click();
        await expect(regionHeading(app)).toHaveText(names.vermis);
    });

    test("a label on the 3D model opens its section", async ({ app }) => {
        const names = await namesOf(app, ["deep"]);
        const label = app.locator(".lbl").filter({ hasText: names.deep });
        await expect(label).toBeVisible();
        await label.click();
        await expect(regionHeading(app)).toHaveText(names.deep);
    });

    test("clicking the model selects a part; empty space goes back up",
        async ({ app }) => {
            const canvas = app.locator("#brain");
            const box = (await canvas.boundingBox())!;
            const startName = await regionHeading(app).textContent();

            // The brain fills the middle of the stage at start-up.
            await canvas.click({
                position: { x: box.width / 2, y: box.height / 2 },
            });
            await expect(regionHeading(app)).not.toHaveText(startName!);

            // The top-left corner is empty background.
            await canvas.click({ position: { x: 8, y: box.height - 8 } });
            await expect(regionHeading(app)).toHaveText(startName!);
        });
});
