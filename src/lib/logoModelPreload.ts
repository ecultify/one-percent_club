import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export const CLUB_LOGO_GLB_PATH = "/1percent-club-gold.glb";

let preloadedModel: THREE.Group | null = null;
let preloadPromise: Promise<THREE.Group> | null = null;

/**
 * Start downloading + decoding the club GLB as early as possible (e.g. from
 * GameFlow on mount). Logo3D reuses the same cached scene so the canvas can
 * appear as soon as WebGL init finishes.
 */
export function preloadClubLogoModel(): Promise<THREE.Group> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(dracoLoader);
    loader.load(
      CLUB_LOGO_GLB_PATH,
      (gltf) => {
        preloadedModel = gltf.scene;
        resolve(gltf.scene);
      },
      undefined,
      (err) => {
        preloadPromise = null;
        reject(err);
      },
    );
  });
  return preloadPromise;
}

export function getPreloadedClubLogoScene(): THREE.Group | null {
  return preloadedModel;
}
