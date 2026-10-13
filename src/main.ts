// Entry point. Import order matters: three.js first, then the content
// files (each assigns a global), then the Spanish overlays, then the app.
// Self-hosted web fonts (SIL Open Font License). Bundling them instead of
// loading Google Fonts avoids a third-party request on every visit.
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/source-serif-4/opsz.css";
import "@fontsource-variable/source-serif-4/opsz-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles.css";
import "./three-global";

import "./anatomy.js";
import "./hierarchy.js";
import "./psych.js";
import "./diseases.js";
import "./glossary.js";
import "./cond_ext.js";
import "./ext_d1.js";
import "./ext_d2.js";
import "./ext_p1.js";
import "./ext_p2.js";
import "./ext_p3.js";
import "./es_0_ui.js";
import "./es_1_anatomy.js";
import "./es_2_parts.js";
import "./es_3_psych1.js";
import "./es_4_psych2.js";
import "./es_5_psych3a.js";
import "./es_5_psych3b.js";
import "./es_6_dis1.js";
import "./es_7_dis2.js";
import "./es_8_gloss1.js";
import "./es_9_gloss2.js";

import "./app.js";
