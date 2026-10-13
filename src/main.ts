// Entry point: styles and fonts, then the content, then the app.

// Self-hosted web fonts (SIL Open Font License). Bundling them instead of
// loading Google Fonts avoids a third-party request on every visit.
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/source-serif-4/opsz.css";
import "@fontsource-variable/source-serif-4/opsz-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles.css";

import { loadCoreContent } from "./app/content";
import { startApp } from "./app/controller";

void startApp(loadCoreContent());
