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

/** Makes every WebGL request fail, as on a device without WebGL. */
function disableWebGL(): void {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
    ) {
        if (/webgl/i.test(type)) return null;
        return (original as Function).call(this, type, ...rest);
    } as typeof original;
}

type Options = {
    /** Start the page as if the device had no WebGL. */
    withoutWebGL: boolean;
    /** Make requests for matching files fail (e.g. a lazy chunk). */
    failDownloads: RegExp | null;
    /** Visit as a first-time visitor, who sees the intro. */
    firstVisit: boolean;
};

type Fixtures = {
    // Uncaught exceptions on the page. Every test asserts this stays empty.
    pageErrors: string[];
    // Console warnings logged while the app starts and runs.
    consoleWarnings: string[];
    app: Page;
};

export const test = base.extend<Fixtures & Options>({
    withoutWebGL: [false, { option: true }],
    failDownloads: [null, { option: true }],
    firstVisit: [false, { option: true }],
    pageErrors: async ({}, use) => {
        await use([]);
    },
    consoleWarnings: async ({}, use) => {
        await use([]);
    },
    app: async (
        {
            page,
            pageErrors,
            consoleWarnings,
            withoutWebGL,
            failDownloads,
            firstVisit,
        },
        use,
    ) => {
        if (withoutWebGL) await page.addInitScript(disableWebGL);
        // Most tests act as returning visitors, so the intro stays closed.
        if (!firstVisit) {
            await page.addInitScript(() =>
                localStorage.setItem("ibm-intro-seen", "1"),
            );
        }
        if (failDownloads) {
            await page.route(failDownloads, (route) => route.abort());
        }
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("console", (message) => {
            if (message.type() === "warning") {
                consoleWarnings.push(message.text());
            }
        });
        const external: string[] = [];
        recordExternalRequests(page, external);
        await page.goto("/");
        // window.__atlas is set once start-up has finished: the model is
        // ready, or the stage is showing why it can't be.
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

/** Breadcrumb trail of the Region panel, as plain text items. */
export async function breadcrumbs(page: Page): Promise<string[]> {
    const items = page.locator("#view-region .breadcrumbs li");
    return (await items.allTextContents()).map((text) => text.trim());
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
