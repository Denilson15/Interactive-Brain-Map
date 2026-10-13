import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the built index.html served over HTTP.
// WebGL runs on SwiftShader (software rendering) so tests work on CI
// machines without a GPU. It is slow, which is why timeouts are generous.
export default defineConfig({
    testDir: "tests/e2e",
    // One snapshot per test for every OS: the snapshots are plain JSON.
    snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
    timeout: 180_000,
    expect: { timeout: 15_000 },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: process.env.CI
        ? [["list"], ["html", { open: "never" }]]
        : "list",
    use: {
        baseURL: "http://127.0.0.1:4173",
        launchOptions: {
            args: [
                "--use-gl=swiftshader",
                "--enable-unsafe-swiftshader",
                "--ignore-gpu-blocklist",
            ],
        },
    },
    projects: [
        {
            name: "desktop",
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1280, height: 800 },
            },
            testIgnore: /phone\.spec/,
        },
        {
            name: "phone",
            use: { ...devices["Pixel 7"] },
            testMatch: /phone\.spec/,
        },
    ],
    webServer: {
        command: "python3 -m http.server 4173 --bind 127.0.0.1",
        url: "http://127.0.0.1:4173/index.html",
        reuseExistingServer: !process.env.CI,
    },
});
