import { test, expect, regionHeading } from "./fixtures";

test.describe("psychology and disease conditions", () => {
    test("every condition opens its full write-up", async ({ app }) => {
        const problems = await app.evaluate(() => {
            const { CONDS, openCondition } = (window as any).__atlas;
            const found: string[] = [];
            for (const key of Object.keys(CONDS)) {
                const condition = CONDS[key];
                openCondition(key);
                const view = document.getElementById(
                    condition.kind === "psych" ? "view-psych" : "view-disease",
                )!;
                const heading = view.querySelector("h2")?.textContent;
                if (heading !== condition.name) {
                    found.push(`${key}: heading "${heading}"`);
                }
                const areas = view.querySelectorAll(".areas li").length;
                if (areas !== condition.brain.length) {
                    found.push(`${key}: ${condition.brain.length} areas, `
                        + `list shows ${areas}`);
                }
            }
            return found;
        });
        expect(problems).toEqual([]);
    });

    test("search a disorder, highlight it, then return to anatomy",
        async ({ app }) => {
            await app.locator("#tab-psych").click();
            const view = app.locator("#view-psych");
            await expect(view.locator(".count")).toHaveText(/^51 of 51 /);

            await view.locator(".search").fill("OCD");
            const item = view.locator(".citem").first();
            await expect(item).toContainText("Obsessive");
            await item.click();
            await expect(view.locator("h2")).toContainText("Obsessive");

            const condbar = app.locator("#condbar");
            await expect(condbar).toBeVisible();
            await expect(condbar).toContainText("OCD");

            // A brain-area button moves the camera without errors.
            await view.locator(".areas .go").first().click();

            await condbar.getByRole("button").click();
            await expect(app.locator("#tab-region"))
                .toHaveAttribute("aria-selected", "true");
            await expect(condbar).toBeHidden();
        });

    test("disease list search, empty state and back link",
        async ({ app }) => {
            await app.locator("#tab-disease").click();
            const view = app.locator("#view-disease");
            await expect(view.locator(".count")).toHaveText(/^30 of 30 /);

            await view.locator(".search").fill("zzzz");
            await expect(view.locator(".empty")).toBeVisible();

            await view.locator(".search").fill("Alzheimer");
            await view.locator(".citem").first().click();
            await expect(view.locator("h2")).toHaveText("Alzheimer's disease");
            await view.locator(".back").click();
            await expect(view.locator(".search")).toBeVisible();
        });

    test("a region links to its conditions", async ({ app }) => {
        await app.evaluate(() =>
            (window as any).__atlas.selectNode("dlpfc", "L"),
        );
        await expect(regionHeading(app)).not.toHaveText("Human brain");
        const chip = app.locator("#view-region .chip.cond").first();
        await chip.click();
        await expect(app.locator("#tab-psych"))
            .toHaveAttribute("aria-selected", "true");
        await expect(app.locator("#condbar")).toBeVisible();
    });
});
