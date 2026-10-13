import { defineConfig } from "vite";

export default defineConfig({
    // Relative asset URLs, so the site works from any GitHub Pages path
    // (e.g. /interactive-brain-map/) without hard-coding the repo name.
    base: "./",
    build: {
        outDir: "dist",
    },
    preview: {
        host: "127.0.0.1",
        port: 4173,
        strictPort: true,
    },
});
