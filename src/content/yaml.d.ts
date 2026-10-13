// .yaml files are turned into modules by the plugin in vite.config.ts.
// Their shapes are declared where they are loaded (src/app/content.ts).
declare module "*.yaml" {
    const data: unknown;
    export default data;
}
