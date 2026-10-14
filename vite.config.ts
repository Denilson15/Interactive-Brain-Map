import { defineConfig, loadEnv, type Plugin } from "vite";
import { parse } from "yaml";

/**
 * Lets the app import .yaml content files. Each file is parsed at build
 * time and becomes a plain JavaScript module, so visitors' browsers
 * never parse YAML.
 */
function yamlContent(): Plugin {
    return {
        name: "yaml-content",
        transform(source, id) {
            if (!id.endsWith(".yaml")) return null;
            return {
                code: `export default ${JSON.stringify(parse(source))};`,
                map: null,
            };
        },
    };
}

/**
 * Writes robots.txt and sitemap.xml into the build from VITE_SITE_URL
 * (set in .env), so the site's address lives in one place. Only the app
 * is listed: the design system page is a noindex reference.
 */
function searchFiles(siteUrl: string): Plugin {
    return {
        name: "search-files",
        apply: "build",
        generateBundle() {
            this.emitFile({
                type: "asset",
                fileName: "robots.txt",
                source:
                    "User-agent: *\nAllow: /\n\n" +
                    `Sitemap: ${siteUrl}sitemap.xml\n`,
            });
            this.emitFile({
                type: "asset",
                fileName: "sitemap.xml",
                source:
                    '<?xml version="1.0" encoding="UTF-8"?>\n' +
                    '<urlset xmlns="http://www.sitemaps.org/schemas/' +
                    'sitemap/0.9">\n' +
                    `    <url><loc>${siteUrl}</loc></url>\n` +
                    "</urlset>\n",
            });
        },
    };
}

export default defineConfig(({ mode }) => ({
    plugins: [
        yamlContent(),
        searchFiles(loadEnv(mode, process.cwd(), "VITE_").VITE_SITE_URL),
    ],
    // Relative asset URLs, so the site works from any GitHub Pages path
    // (e.g. /interactive-brain-map/) without hard-coding the repo name.
    base: "./",
    build: {
        outDir: "dist",
        rolldownOptions: {
            // Two pages: the app, and the design system reference.
            input: {
                main: "index.html",
                designSystem: "docs/design-system.html",
            },
        },
    },
    preview: {
        host: "127.0.0.1",
        port: 4173,
        strictPort: true,
    },
}));
