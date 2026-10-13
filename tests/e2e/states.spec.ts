import { test, expect, regionHeading } from "./fixtures";

test.describe("loading state", () => {
    test("the loader finishes and hands over to the model", async ({ app }) => {
        await expect(app.locator("body")).toHaveAttribute(
            "data-stage",
            "ready",
        );
        await expect(app.locator("#stageStatus")).toBeHidden();
        await expect(app.locator("#stageProgress")).toHaveAttribute(
            "value",
            "100",
        );
        await expect(app.locator("#upBtn")).toBeVisible();
        await expect(app.locator("#stageError")).toBeHidden();
    });
});

test.describe("without WebGL", () => {
    test.use({ withoutWebGL: true });

    test("explains the problem and keeps every panel working", async ({
        app,
    }) => {
        await expect(app.locator("body")).toHaveAttribute(
            "data-stage",
            "error",
        );
        const error = app.getByRole("alert");
        await expect(error).toContainText("can't start on this device");
        await expect(
            error.getByRole("button", { name: "Try again" }),
        ).toBeVisible();
        // 3D-only controls are hidden; they would do nothing.
        await expect(app.locator(".toolbar")).toBeHidden();
        await expect(app.locator("#stageStatus")).toBeHidden();

        // Regions, conditions and the dictionary still work.
        await app.locator('#chips [data-node="hemiL"]').first().click();
        await expect(regionHeading(app)).toHaveText("Left hemisphere");
        await app
            .locator('#view-region .card[data-node="frontal"]')
            .first()
            .click();
        await expect(regionHeading(app)).toHaveText("Frontal lobe");

        await app.locator("#tab-disease").click();
        await app.locator("#view-disease .list-item").first().click();
        await expect(app.locator("#view-disease h2")).not.toBeEmpty();

        await app.locator("#tab-gloss").click();
        await app.locator("#gq").fill("synapse");
        await expect(app.locator("#glist li").first()).toContainText(
            /synapse/i,
        );
    });
});

test.describe("when Spanish can't be downloaded", () => {
    test.use({ failDownloads: /\/spanish-[^/]*\.js$/ });

    test("stays in English and says why", async ({ app }) => {
        await app.locator('[data-lang="es"]').click();
        const notice = app.locator("#notice");
        await expect(notice).toBeVisible();
        await expect(notice).toContainText("Spanish couldn't be downloaded");
        await expect(app.locator("h1")).toHaveText("Interactive Brain Map");
        await expect(app.locator("html")).toHaveAttribute("lang", "en");
        await expect(app.locator('[data-lang="en"]')).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        await notice.getByRole("button", { name: "Dismiss" }).click();
        await expect(notice).toBeHidden();
    });
});

test.describe("when a condition's write-up can't be downloaded", () => {
    test.use({ failDownloads: /\/write-ups-[^/]*\.js$/ });

    test("shows the short version with a note", async ({ app }) => {
        await app.locator("#tab-psych").click();
        await app.locator("#view-psych .search").fill("OCD");
        await app.locator("#view-psych .list-item").first().click();
        const view = app.locator("#view-psych");
        await expect(view.locator("h2")).toContainText("Obsessive");
        // The summary stands in for the long overview.
        const summary = await app.evaluate(
            () => (window as any).__atlas.CONDS["psych:ocd"].summary,
        );
        await expect(view.locator(".accordion").first()).toContainText(
            summary.slice(0, 40),
        );
        await expect(app.locator("#notice")).toContainText(
            "full write-up couldn't be downloaded",
        );
    });
});

test.describe("when the device drops the 3D context", () => {
    test("pauses with a message and recovers", async ({ app }) => {
        await app.evaluate(() => {
            const canvas = document.getElementById(
                "brain",
            ) as HTMLCanvasElement;
            const gl =
                canvas.getContext("webgl2") ?? canvas.getContext("webgl");
            const ext = gl!.getExtension("WEBGL_lose_context")!;
            (window as any).__loseContext = ext;
            ext.loseContext();
        });
        await expect(app.getByRole("alert")).toContainText(
            "paused by your device",
        );
        await app.evaluate(() =>
            (window as any).__loseContext.restoreContext(),
        );
        await expect(app.locator("#stageError")).toBeHidden();
        await expect(app.locator("body")).toHaveAttribute(
            "data-stage",
            "ready",
        );
    });
});
