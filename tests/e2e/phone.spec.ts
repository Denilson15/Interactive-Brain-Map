import { test, expect, regionHeading } from "./fixtures";

// Runs only in the "phone" project (Pixel 7 viewport, touch).
test.describe("phone layout", () => {
    test("bottom sheet, browse map and controls menu", async ({ app }) => {
        const sheet = app.locator(".panel");
        const startHeight = (await sheet.boundingBox())!.height;

        // On phones the section map lives in the Browse tab.
        await app.locator("#tab-browse").click();
        const browse = app.locator("#view-browse");
        await expect(browse.locator('[data-node="hemiL"]').first())
            .toBeVisible();
        expect((await sheet.boundingBox())!.height).toBeGreaterThan(
            startHeight,
        );

        await browse.locator('[data-node="cerebellum"]').first().click();
        await expect(regionHeading(app)).toHaveText("Cerebellum");

        const more = app.locator("#moreBtn");
        await more.click();
        await expect(more).toHaveAttribute("aria-expanded", "true");
        await expect(app.locator("#spread")).toBeVisible();
        await more.click();
        await expect(app.locator("#spread")).toBeHidden();
    });

    test("the sheet handle cycles through its heights", async ({ app }) => {
        const sheet = app.locator(".panel");
        const handle = app.locator("#grab");
        const heights: number[] = [];
        for (let i = 0; i < 3; i++) {
            await handle.focus();
            await app.keyboard.press("Enter");
            await app.waitForTimeout(400); // height transition is 280ms
            heights.push((await sheet.boundingBox())!.height);
        }
        // peek -> half -> full -> peek
        expect(heights[1]).toBeGreaterThan(heights[0]);
        expect(heights[2]).toBeLessThan(heights[1]);
    });
});
