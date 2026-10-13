import { test, expect, regionHeading } from "./fixtures";

test.describe("dictionary and definitions", () => {
    test("search, filter and jump to the model", async ({ app }) => {
        await app.locator("#tab-gloss").click();
        await expect(app.locator("#gcount")).toHaveText("415 of 415 entries");

        await app.locator("#gq").fill("synapse");
        await expect(app.locator("#glist li").first()).toContainText(
            /synapse/i,
        );

        await app.locator("#gq").fill("putamen");
        await app.locator('#gfilters [data-f="Region"]').click();
        const entries = app.locator("#glist li");
        await expect(entries.first().locator(".tag")).toContainText("Region");
        await entries.first().locator("[data-sub]").click();
        await expect(regionHeading(app)).toHaveText("Putamen");
    });

    test("shows an empty state when nothing matches", async ({ app }) => {
        await app.locator("#tab-gloss").click();
        await app.locator("#gq").fill("qqqqzz");
        await expect(app.locator("#glist .empty")).toBeVisible();
    });

    test("a dotted term opens a definition that Escape closes",
        async ({ app }) => {
            const term = app.locator("#view-region .term").first();
            await term.click();
            const popover = app.locator("#pop");
            await expect(popover).toBeVisible();
            await expect(popover.locator("h4")).not.toBeEmpty();
            await app.keyboard.press("Escape");
            await expect(popover).toBeHidden();
        });
});
