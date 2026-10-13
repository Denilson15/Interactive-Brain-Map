import { test as base, expect, type Page } from "@playwright/test";
import path from "node:path";

const THREE_DIR = path.resolve("node_modules/three");

// The current build loads three.js r128 and OrbitControls from public
// CDNs. Tests serve the identical files from node_modules instead, so
// they run offline and never depend on CDN uptime. Web fonts are
// blocked for the same reason; the app falls back to system fonts.
async function routeExternalAssets(page: Page): Promise<void> {
    await page.route(/three\.min\.js$/, (route) =>
        route.fulfill({
            path: path.join(THREE_DIR, "build/three.min.js"),
            contentType: "text/javascript",
        }),
    );
    await page.route(/OrbitControls\.js$/, (route) =>
        route.fulfill({
            path: path.join(
                THREE_DIR,
                "examples/js/controls/OrbitControls.js",
            ),
            contentType: "text/javascript",
        }),
    );
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
        route.abort(),
    );
}

type Fixtures = {
    // Uncaught exceptions on the page. Every test asserts this stays empty.
    pageErrors: string[];
    // Console warnings logged while the app starts and runs.
    consoleWarnings: string[];
    app: Page;
};

export const test = base.extend<Fixtures>({
    pageErrors: async ({}, use) => {
        await use([]);
    },
    consoleWarnings: async ({}, use) => {
        await use([]);
    },
    app: async ({ page, pageErrors, consoleWarnings }, use) => {
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("console", (message) => {
            if (message.type() === "warning") {
                consoleWarnings.push(message.text());
            }
        });
        await routeExternalAssets(page);
        await page.goto("/index.html");
        // window.__atlas is set at the very end of app start-up.
        await page.waitForFunction(() => "__atlas" in window, null, {
            timeout: 60_000,
        });
        await use(page);
        expect(pageErrors, "uncaught page errors").toEqual([]);
    },
});

export { expect };

/** The heading of the Region panel, i.e. the currently selected part. */
export function regionHeading(page: Page) {
    return page.locator("#view-region h2");
}

/** Breadcrumb trail of the Region panel, without the "›" separators. */
export async function breadcrumbs(page: Page): Promise<string[]> {
    const items = page.locator("#view-region .crumbs > *");
    return (await items.allTextContents()).filter((text) => text !== "›");
}

/** Display names for structure ids, read from the app's own data. */
export async function namesOf(
    page: Page,
    ids: string[],
): Promise<Record<string, string>> {
    return page.evaluate((list) => {
        const S = (window as any).__atlas.S;
        return Object.fromEntries(list.map((id) => [id, S[id].name]));
    }, ids);
}
