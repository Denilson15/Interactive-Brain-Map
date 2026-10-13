import { defineConfig, type Plugin } from "vite";
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

export default defineConfig({
    plugins: [yamlContent()],
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
