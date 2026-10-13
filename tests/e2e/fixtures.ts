import { test as base, expect, type Page } from "@playwright/test";

// The site makes no third-party requests: fonts and three.js are bundled.
// Tests record any request that leaves the local server so a stray CDN
// or tracking call fails the test instead of slipping in unnoticed.
function recordExternalRequests(page: Page, external: string[]): void {
    page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.protocol.startsWith("http") && url.hostname !== "127.0.0.1") {
            external.push(request.url());
        }
    });
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
        const external: string[] = [];
        recordExternalRequests(page, external);
        await page.goto("/");
        // window.__atlas is set at the very end of app start-up.
        await page.waitForFunction(() => "__atlas" in window, null, {
            timeout: 60_000,
        });
        await use(page);
        expect(pageErrors, "uncaught page errors").toEqual([]);
        expect(external, "requests to other servers").toEqual([]);
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
