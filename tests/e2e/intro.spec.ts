import { test, expect } from "./fixtures";

test.describe("first visit", () => {
    test.use({ firstVisit: true });

    test("the intro explains the app and leads into it", async ({ app }) => {
        const intro = app.getByRole("region", {
            name: "Explore the human brain in 3D",
        });
        await expect(intro).toBeVisible();
        // Real counts from the content, not hard-coded numbers.
        await expect(intro).toContainText("79 parts");
        await expect(intro).toContainText("81 psychological");
        await expect(intro).toContainText("415-entry dictionary");

        // The main button closes it and moves focus into the app.
        await intro.getByRole("button", { name: "Explore the brain" }).click();
        await expect(intro).toBeHidden();
        await expect(app.locator("#chips button").first()).toBeFocused();

        // Remembered on this device: a reload goes straight to the app.
        await app.reload();
        await app.waitForFunction(() => "__atlas" in window);
        await expect(app.locator("#intro")).toBeHidden();

        // About brings it back; Escape closes it again.
        const about = app.getByRole("button", { name: "About" });
        await about.click();
        await expect(app.locator("#intro")).toBeVisible();
        await expect(about).toHaveAttribute("aria-expanded", "true");
        await expect(app.locator("#introCta")).toBeFocused();
        await app.keyboard.press("Escape");
        await expect(app.locator("#intro")).toBeHidden();
    });

    test("the intro is translated", async ({ app }) => {
        await app.locator('[data-lang="es"]').click();
        await expect(app.locator("#introTitle")).toHaveText(
            "Explora el cerebro humano en 3D",
        );
        await expect(app.locator("#introCta")).toHaveText(
            "Explorar el cerebro",
        );
        await expect(app.locator("#introPoint1")).toContainText("79 partes");
    });
});
