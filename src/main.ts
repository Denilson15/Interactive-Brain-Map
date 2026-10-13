// Entry point: styles and fonts, then the content, then the app.

import "./styles/fonts";
import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/layout.css";

import { loadCoreContent } from "./app/content";
import { startApp } from "./app/controller";

void startApp(loadCoreContent());
