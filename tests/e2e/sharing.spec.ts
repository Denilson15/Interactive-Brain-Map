import { test, expect } from "./fixtures";

// What search engines and link previews (LinkedIn, Slack, X) read.
// These checks don't need the app to start, so they use the plain page.

test("link previews and search have what they need", async ({
    page,
    request,
}) => {
    await page.goto("/");
    const meta = (selector: string) =>
        page.locator(selector).first().getAttribute("content");

    await expect(page).toHaveTitle(/Interactive Brain Map/);
    expect(await meta('meta[name="description"]')).toBeTruthy();
    expect(await meta('meta[property="og:title"]')).toBeTruthy();
    expect(await meta('meta[property="og:description"]')).toBeTruthy();
    expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");

    // Previews need absolute URLs; the site address came from .env.
    const site = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
    expect(site).toMatch(/^https:\/\/.+\/$/);
    expect(await meta('meta[property="og:url"]')).toBe(site);
    const image = await meta('meta[property="og:image"]');
    expect(image).toBe(`${site}social-preview.jpg`);

    // The files these tags point at are in the build.
    for (const file of [
        "social-preview.jpg",
        "favicon.svg",
        "favicon-32.png",
        "apple-touch-icon.png",
    ]) {
        const response = await request.get(`/${file}`);
        expect(response.ok(), file).toBe(true);
    }

    // Structured data parses and describes a free educational app.
    const jsonLd = JSON.parse(
        (await page
            .locator('script[type="application/ld+json"]')
            .textContent())!,
    );
    expect(jsonLd["@type"]).toContain("WebApplication");
    expect(jsonLd.url).toBe(site);
    expect(jsonLd.isAccessibleForFree).toBe(true);

    // robots.txt points at the sitemap, which lists the home page.
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain(`Sitemap: ${site}sitemap.xml`);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`<loc>${site}</loc>`);
});

test("the tab title follows the language", async ({ app }) => {
    await expect(app).toHaveTitle(
        "Interactive Brain Map: explore the human brain in 3D",
    );
    await app.getByRole("button", { name: "ES", exact: true }).click();
    await expect(app).toHaveTitle(/Mapa Interactivo del Cerebro/);
});
