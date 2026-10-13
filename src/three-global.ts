// Temporary bridge while app.js is still a classic script: it expects
// three.js on window.THREE, the way the old CDN build provided it.
// Removed once app.js is ported to TypeScript modules.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

(window as unknown as { THREE: unknown }).THREE = {
    ...THREE,
    OrbitControls,
};
