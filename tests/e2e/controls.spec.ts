import { test, expect, regionHeading } from "./fixtures";

test.describe("model controls and language", () => {
    test("labels toggle hides and shows the model labels", async ({ app }) => {
        const button = app.locator("#lblBtn");
        await expect(app.locator(".lbl:visible").first()).toBeVisible();
        await button.click();
        await expect(button).toHaveAttribute("aria-pressed", "false");
        await expect(app.locator(".lbl:visible")).toHaveCount(0);
        await button.click();
        await expect(app.locator(".lbl:visible").first()).toBeVisible();
    });

    test("sliders adjust the model and Reset returns home", async ({ app }) => {
        for (const id of ["#spread", "#opac", "#bright"]) {
            await app.locator(id).fill("80");
        }
        await app.evaluate(() =>
            (window as any).__atlas.selectNode("putamen", "L"),
        );
        await app.locator("#resetBtn").click();
        await expect(app.locator("#spread")).toHaveValue("0");
        await expect(regionHeading(app)).toHaveText("Human brain");
    });

    test("Spanish is applied everywhere and remembered", async ({ app }) => {
        await app.locator('[data-lang="es"]').click();
        await expect(app.locator("h1")).toHaveText(
            "Mapa Interactivo del Cerebro",
        );
        await expect(app.locator("html")).toHaveAttribute("lang", "es");
        await expect(app.locator("#tab-region")).toHaveText("Región");
        await expect(regionHeading(app)).toHaveText("Cerebro humano");

        await app.reload();
        await app.waitForFunction(() => "__atlas" in window);
        await expect(app.locator("h1")).toHaveText(
            "Mapa Interactivo del Cerebro",
        );

        await app.locator('[data-lang="en"]').click();
        await expect(app.locator("h1")).toHaveText("Interactive Brain Map");
    });
});
