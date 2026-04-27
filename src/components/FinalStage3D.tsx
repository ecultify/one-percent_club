"use client";

/**
 * FinalStage3D
 * ─────────────────────────────────────────────────────────────────
 * Full-viewport, fully immersive end-screen 3D scene.
 *
 * Architecture (ported from the reference HTML the user shared):
 *   - PMREM-baked HDR environment built procedurally for buttery PBR
 *   - Stage box with brass edge highlights + dark inlay top
 *   - Five glass pots at varying scales, scattered across the stage
 *   - ~120 coins with cannon-es physics that rain from above and pile
 *     into the pots with collision, sleeping, and recycle-on-fall
 *   - Three LED screens floating on poles BEHIND the stage:
 *       LEFT   — journey info (player's run summary)
 *       MIDDLE — "1% Club" sign with animated god rays
 *       RIGHT  — partner CTA
 *     Each screen is a CanvasTexture redrawn every frame, so noise +
 *     scanlines + scroll-bar feel like an actual TV signal
 *   - Camera drifts on a slow lissajous and shakes on coin impacts
 *   - Floating gold dust particles for atmosphere
 *   - Tap-to-start overlay so the AudioContext can unlock
 */

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { playCoinTink, prewarmAudio } from "@/lib/uiClickSound";

// Unicorn Studio scene rendered on the giant cinema screen behind the
// stage. The scene is shipped as a local JSON export so it works without
// the unicorn.studio CDN — passing projectId here would 404 because the
// project was never published. jsonFilePath serves the offline JSON.
const UNICORN_JSON_PATH = "/animations/end_tvscreen_animate.json";
const UNICORN_SDK_URL =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.9/dist/unicornStudio.umd.js";
const UnicornScene = dynamic(() => import("unicornstudio-react/next"), {
  ssr: false,
  loading: () => null,
});

interface JourneyInfo {
  correctCount: number;
  totalQuestions: number;
  reachedPercentage: number;
  potPrize: number;
  shareOfPot?: number;
  isWinner: boolean;
}

interface FinalStage3DProps {
  journeyInfo: JourneyInfo;
  playerName?: string;
}

// ── Brand palette ────────────────────────────────────────────────
const ACCENT_HEX = 0xe4cf6a;       // gold-bright (button gold)
const ACCENT_RGB = "228, 207, 106";
const ACCENT_WARM_RGB = "212, 175, 55";  // D4AF37 deeper gold
// (BG color is now a CSS radial gradient on the wrapper div, since the
// 3D scene is alpha-transparent over the cinema screen behind it.)

function formatRupees(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function FinalStage3D({ journeyInfo, playerName }: FinalStage3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const journeyRef = useRef(journeyInfo);
  journeyRef.current = journeyInfo;
  const playerRef = useRef(playerName);
  playerRef.current = playerName;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Pre-warm the audio graph so the very first coin tink fires the
    // instant the first coin lands, instead of waiting on AudioContext
    // suspension to lift. Without this the user hears 1+ seconds of
    // silent coin rain before the audio graph wakes up.
    prewarmAudio();

    // ── Renderer / scene / camera ────────────────────────────
    // alpha:true + transparent clear color is what lets the giant
    // Unicorn Studio cinema screen behind the canvas show through. The
    // backdrop dome was removed for the same reason — without the dome
    // we now see the actual screen underneath, framed in 3D by the side
    // TVs, stage, coin rain and atmosphere on top.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Exposure bumped 1.15 → 1.35 so highlights pop harder. Combined
    // with the brighter beams + ambient below, the whole stage reads
    // more vibrant within the existing warm-gold palette.
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const scene = new THREE.Scene();
    // No scene.background and no fog — we WANT to see through to the
    // cinema screen DOM layer behind the canvas.

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    );
    camera.position.set(0, 4.4, 13.2);
    camera.lookAt(0, 3, -3);

    // ── Procedural HDR environment ───────────────────────────
    const buildEnvironmentMap = () => {
      const c = document.createElement("canvas");
      c.width = 1024; c.height = 512;
      const cx = c.getContext("2d")!;
      const sky = cx.createLinearGradient(0, 0, 0, 512);
      // Cool purple-blue ambient gradient (replaces legacy brown sky).
      // Drives the PMREM HDR env, so reflections on coins/pots pick up
      // a subtle purple cast at top fading to deep blue-black below —
      // keeps gold pop, kills the brown read.
      sky.addColorStop(0,    "#160a2a");
      sky.addColorStop(0.45, "#0e1438");
      sky.addColorStop(0.55, "#0a0820");
      sky.addColorStop(1,    "#02020a");
      cx.fillStyle = sky;
      cx.fillRect(0, 0, 1024, 512);

      const blob = (x: number, y: number, r: number, color: string) => {
        const g = cx.createRadialGradient(x, y, 1, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
        cx.fillStyle = g;
        cx.fillRect(0, 0, 1024, 512);
      };
      blob(180, 140, 110, "rgba(255,235,180,0.95)");
      blob(820, 170, 100, "rgba(228,207,106,0.85)");
      blob(500, 180, 130, "rgba(212,175,55,0.6)");
      blob(320, 220, 70,  "rgba(255,200,140,0.45)");
      blob(680, 240, 60,  "rgba(228,207,106,0.4)");
      for (let i = 0; i < 16; i++) {
        blob(
          Math.random() * 1024, 100 + Math.random() * 250,
          20 + Math.random() * 40,
          `rgba(255,${(180 + Math.random() * 60) | 0},${(100 + Math.random() * 80) | 0},${0.1 + Math.random() * 0.2})`,
        );
      }
      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const envMap = pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      pmrem.dispose();
      return envMap;
    };
    const envMap = buildEnvironmentMap();
    scene.environment = envMap;

    // ── Studio side curtains ─────────────────────────────────
    // Fabric texture is now PAINTED into a CanvasTexture instead of
    // generated by a sin-pleat shader. That fixes the "jittery stripes"
    // look — the texture has organic, varying-width folds with soft
    // gradients, fabric grain noise and a subtle velvet sheen. Once
    // painted, the texture is static, so it never wobbles regardless of
    // camera/curtain motion.
    const buildCurtainTexture = () => {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 1536; // 3:1 portrait so the fabric grain repeats
                      // believably down a tall hanging curtain
      const cx = c.getContext("2d")!;

      // Base velvet — bright crimson with a vertical gradient that
      // dims toward the bottom (gravity-weighted velvet). Boosted
      // significantly from the previous version which was rendering
      // near-black under MeshStandardMaterial light absorption.
      const vGrad = cx.createLinearGradient(0, 0, 0, c.height);
      vGrad.addColorStop(0,    "#8a2014");  // bright crimson top
      vGrad.addColorStop(0.45, "#6a1810");  // saturated mid
      vGrad.addColorStop(0.8,  "#3d0d08");  // shadowed lower
      vGrad.addColorStop(1,    "#1f0604");  // dark hem
      cx.fillStyle = vGrad;
      cx.fillRect(0, 0, c.width, c.height);

      // Vertical folds — varying widths, soft gradients. Each fold is
      // a column with a bright sheen line at center and shadow at the
      // edges. Widths picked deterministically (not pure-random) so
      // the pattern looks like real pleats, not noise.
      const foldXs = [16, 52, 95, 138, 180, 225, 270, 318, 364, 410, 456, 498];
      const foldWidths = [40, 48, 44, 42, 50, 46, 52, 44, 48, 50, 42, 46];
      for (let i = 0; i < foldXs.length; i++) {
        const x = foldXs[i];
        const w = foldWidths[i];
        const grad = cx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        grad.addColorStop(0,   "rgba(40, 8, 6, 0.55)");
        grad.addColorStop(0.4, "rgba(180, 70, 30, 0.0)");
        grad.addColorStop(0.5, "rgba(255, 145, 60, 0.55)"); // bright sheen line
        grad.addColorStop(0.6, "rgba(180, 70, 30, 0.0)");
        grad.addColorStop(1,   "rgba(40, 8, 6, 0.55)");
        cx.fillStyle = grad;
        cx.fillRect(x - w / 2, 0, w, c.height);
      }

      // Fabric grain — thousands of 1-2 px noise dots biased warm
      const imgData = cx.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = (Math.random() - 0.5) * 24;
        d[i]     = Math.max(0, Math.min(255, d[i]     + noise * 1.0));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise * 0.6));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise * 0.5));
      }
      cx.putImageData(imgData, 0, 0);

      // Subtle horizontal threading — short dashes at high frequency
      cx.globalAlpha = 0.06;
      cx.strokeStyle = "#5a2412";
      cx.lineWidth = 0.6;
      for (let y = 0; y < c.height; y += 2) {
        cx.beginPath();
        for (let x = 0; x < c.width; x += 8) {
          cx.moveTo(x + Math.random() * 2, y);
          cx.lineTo(x + 6, y);
        }
        cx.stroke();
      }
      cx.globalAlpha = 1.0;

      // Gold trim ribbon along the inner vertical edge — thicker and
      // brighter so the proscenium framing reads from across the room.
      const trimGrad = cx.createLinearGradient(c.width - 28, 0, c.width, 0);
      trimGrad.addColorStop(0,    "rgba(228, 207, 106, 0)");
      trimGrad.addColorStop(0.4,  "rgba(228, 175, 60, 0.75)");
      trimGrad.addColorStop(0.75, "rgba(255, 220, 120, 1.0)");
      trimGrad.addColorStop(1,    "rgba(255, 240, 170, 1.0)");
      cx.fillStyle = trimGrad;
      cx.fillRect(c.width - 28, 0, 28, c.height);
      // A bright hairline highlight on the very inner edge — sells
      // the gold rod look.
      cx.fillStyle = "rgba(255, 250, 200, 0.95)";
      cx.fillRect(c.width - 2, 0, 2, c.height);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    };
    const curtainTexL = buildCurtainTexture();
    const curtainTexR = buildCurtainTexture();
    // Mirror right curtain so the gold trim hangs on the inner side.
    curtainTexR.wrapS = THREE.RepeatWrapping;
    curtainTexR.repeat.x = -1;
    curtainTexR.offset.x = 1;

    // ── Procedural normal map (fold geometry) ────────────────
    // For each fold position painted in the color texture, we encode a
    // matching surface normal: convex bulge toward viewer at the fold
    // center (blue dominant), tilting -x on the left half and +x on
    // the right half. PBR rendering uses this to compute proper
    // shading and specular highlights, giving the fabric real depth
    // even when the geometry stays flat.
    const buildCurtainNormalMap = () => {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 1536;
      const cx = c.getContext("2d")!;
      // Default flat normal = (128, 128, 255) — neutral, points +z
      cx.fillStyle = "rgb(128, 128, 255)";
      cx.fillRect(0, 0, c.width, c.height);

      const foldXs = [16, 52, 95, 138, 180, 225, 270, 318, 364, 410, 456, 498];
      const foldWidths = [40, 48, 44, 42, 50, 46, 52, 44, 48, 50, 42, 46];
      // Each fold cross-section: red channel sweeps from low (left
      // tilt) to high (right tilt), green stays neutral, blue stays
      // high (mostly facing viewer with horizontal tilt at edges).
      for (let i = 0; i < foldXs.length; i++) {
        const x = foldXs[i];
        const w = foldWidths[i];
        for (let dx = -w / 2; dx <= w / 2; dx += 1) {
          // -1..+1 across the fold width
          const t = dx / (w / 2);
          // Red channel: 64 (left tilt) → 192 (right tilt)
          const r = Math.round(128 + t * 64);
          // Blue channel: 220 at edges (more tilt), 255 at center
          const b = Math.round(220 + (1 - Math.abs(t)) * 35);
          cx.fillStyle = `rgb(${r}, 128, ${b})`;
          cx.fillRect(Math.round(x + dx), 0, 1, c.height);
        }
      }

      // Add per-pixel grain in the normal map so the fabric weave
      // catches light unevenly — gives it tactile realism.
      const imgData = cx.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const grain = (Math.random() - 0.5) * 14;
        d[i]     = Math.max(0, Math.min(255, d[i]     + grain));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + grain));
        // blue stays mostly stable
      }
      cx.putImageData(imgData, 0, 0);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.NoColorSpace; // normal maps must NOT be sRGB-decoded
      tex.anisotropy = 8;
      return tex;
    };
    const curtainNormalTex = buildCurtainNormalMap();

    // ── Curtain materials with bunching vertex shader ────────
    // The mesh transform stays anchored at the rail position. The
    // VERTEX SHADER does all the opening: it compresses the local x
    // coordinates toward the outer edge proportional to uOpenFactor,
    // which is exactly how real fabric on a pull-cord curtain behaves.
    // The cloth gathers at the sides, pleats pop out in z-depth, and
    // the bottom sways slightly. No rigid translation — fabric physics.
    const CURTAIN_W = 7;
    const CURTAIN_HALF_W = CURTAIN_W / 2;

    // Direct ShaderMaterial — uniforms are exposed on `mat.uniforms`
    // immediately, no onBeforeCompile timing race. Vertex shader does
    // the bunching; fragment shader samples painted velvet color +
    // perturbs surface normal from the procedural normal map and runs
    // a two-light Lambert that mimics warm curtain-wash spotlights
    // baked into the shader (so curtains always have light, regardless
    // of scene lighting reach).
    const buildCurtainMaterial = (texture: THREE.CanvasTexture, outerDir: 1 | -1) => {
      return new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        transparent: false,
        depthWrite: true,
        uniforms: {
          uTexture:    { value: texture },
          uNormalMap:  { value: curtainNormalTex },
          uOpenFactor: { value: 0 },
          uTime:       { value: 0 },
          uOuterDir:   { value: outerDir },
        },
        vertexShader: `
          uniform float uOpenFactor;
          uniform float uTime;
          uniform float uOuterDir;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;

          const float CURTAIN_HALF_W = ${CURTAIN_HALF_W.toFixed(3)};
          const float CURTAIN_W = ${CURTAIN_W.toFixed(3)};

          void main() {
            vUv = uv;
            vec3 transformed = position;

            // distFromOuter: 0 at the OUTER edge (where fabric bunches
            // when open), 1 at the INNER edge (the leading edge that
            // meets the other curtain when closed).
            float distFromOuter = (uOuterDir > 0.0) ? (1.0 - uv.x) : uv.x;

            // BUNCHING — as openFactor 0→1, every horizontal position
            // is pulled toward the outer edge. At fully-open the
            // curtain occupies ~16% of its original width, gathered at
            // the outer side.
            float bunchedWidth = 0.16;
            float compressedDist = mix(distFromOuter, distFromOuter * bunchedWidth, uOpenFactor);

            if (uOuterDir > 0.0) {
              transformed.x = CURTAIN_HALF_W - compressedDist * CURTAIN_W;
            } else {
              transformed.x = -CURTAIN_HALF_W + compressedDist * CURTAIN_W;
            }

            // Z-axis pleats: bunched fabric pops out of the plane
            float pleatLow = sin(distFromOuter * 14.0) * 0.42;
            float pleatHi  = sin(distFromOuter * 38.0) * 0.14;
            transformed.z += (pleatLow + pleatHi) * uOpenFactor;

            // Bottom sway: lower vertices lag the rail above them
            float bottomFactor = 1.0 - uv.y;
            float swayAmp = (0.04 + 0.06 * uOpenFactor) * bottomFactor;
            transformed.x += sin(uTime * 1.4 + uv.y * 5.0) * swayAmp;
            transformed.z += sin(uTime * 1.1 + uv.y * 3.0) * swayAmp * 0.6;

            // Forward drift — bunched fabric pushes toward camera
            transformed.z += uOpenFactor * 0.35;

            // Compute world-space position + normal for fragment lighting
            vec4 worldPos4 = modelMatrix * vec4(transformed, 1.0);
            vWorldPos = worldPos4.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);

            gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uTexture;
          uniform sampler2D uNormalMap;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;

          void main() {
            vec3 base = texture2D(uTexture, vUv).rgb;

            // Perturb surface normal from the painted normal map. The
            // map's RGB encodes XYZ tilt; combine with the geometry
            // normal for fold-aware shading.
            vec3 nm = texture2D(uNormalMap, vUv).rgb * 2.0 - 1.0;
            vec3 N = normalize(vWorldNormal + vec3(nm.x, 0.0, nm.z) * 0.85);

            // Two warm wash lights matching the stage-rim spots —
            // baked into the shader so curtains always have lighting,
            // independent of scene lights reaching the back wall.
            vec3 lightL_pos = vec3(-5.0, 5.0, -2.5);
            vec3 lightR_pos = vec3( 5.0, 5.0, -2.5);
            vec3 lightColor = vec3(1.0, 0.72, 0.40); // warm amber

            vec3 toL = normalize(lightL_pos - vWorldPos);
            vec3 toR = normalize(lightR_pos - vWorldPos);
            float diffL = max(0.0, dot(N, toL));
            float diffR = max(0.0, dot(N, toR));

            // Distance falloff so each curtain is mostly lit by its
            // own wash, not the opposite one (otherwise everything
            // averages flat).
            float distL = length(lightL_pos - vWorldPos);
            float distR = length(lightR_pos - vWorldPos);
            float attenL = 1.0 / (1.0 + 0.08 * distL * distL);
            float attenR = 1.0 / (1.0 + 0.08 * distR * distR);

            float lighting = 0.45 + (diffL * attenL + diffR * attenR) * 1.6;
            vec3 col = base * lightColor * lighting;

            // Subtle warm rim along the inside edge (UV.x near 1 for
            // left curtain, near 0 for right) makes the gold trim pop
            float trim = pow(max(vUv.x, 1.0 - vUv.x), 8.0);
            col += vec3(0.3, 0.22, 0.10) * trim * 0.6;

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });
    };

    const curtainMatL = buildCurtainMaterial(curtainTexL, -1);
    const curtainMatR = buildCurtainMaterial(curtainTexR,  1);

    // Subdivided plane — needs enough segments for the bunching
    // displacement to read smoothly. 24 horizontal × 32 vertical is
    // plenty for organic fabric without burning frame budget.
    const curtainGeo = new THREE.PlaneGeometry(CURTAIN_W, 26, 24, 32);
    // Curtains anchored at fixed rail positions. They MEET at world x=0
    // when closed (each spans world x = -7..0 and 0..+7). No rigid
    // translation — the bunching shader does the opening.
    const curtainL = new THREE.Mesh(curtainGeo, curtainMatL);
    curtainL.position.set(-CURTAIN_HALF_W, 4, -4.6);
    curtainL.rotation.y = Math.PI / 7;
    scene.add(curtainL);
    const curtainR = new THREE.Mesh(curtainGeo, curtainMatR);
    curtainR.position.set(CURTAIN_HALF_W, 4, -4.6);
    curtainR.rotation.y = -Math.PI / 7;
    scene.add(curtainR);
    // Curtain-open progress: 0 = closed, 1 = fully open
    let curtainOpenT = 0;
    const CURTAIN_OPEN_DURATION = 2.4;
    // Slight delay so the user sees the closed curtains for a beat
    // before they part — sells the "show is starting" moment.
    const CURTAIN_OPEN_DELAY = 0.5;

    // ── Lights ───────────────────────────────────────────────
    // Vibrance pass: ambient lifted 0.45→0.6, key spotlight 6→7.5,
    // fill 2.4→3.2, back 1.6→2.2. All within the existing warm-gold
    // palette — no new hues introduced. The stage now reads punchy
    // under the brighter exposure instead of feeling muddy.
    scene.add(new THREE.AmbientLight(0x4a3025, 0.6));
    const keyLight = new THREE.SpotLight(0xfff0d0, 7.5, 30, Math.PI / 5, 0.4, 1.5);
    keyLight.position.set(-6, 12, 6);
    keyLight.target.position.set(0, 1, 0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.radius = 4;
    scene.add(keyLight, keyLight.target);

    const fillLight = new THREE.SpotLight(0xe4cf6a, 3.2, 30, Math.PI / 5, 0.5);
    fillLight.position.set(6, 11, 5);
    fillLight.target.position.set(0, 1, 0);
    scene.add(fillLight, fillLight.target);

    const backLight = new THREE.PointLight(0xc4a035, 2.2, 25);
    backLight.position.set(0, 5, -7);
    scene.add(backLight);

    const goldGlow = new THREE.PointLight(0xffaa33, 1.0, 8);
    goldGlow.position.set(0, 1, 2);
    scene.add(goldGlow);

    // (Curtain wash lights are now baked into the curtain shader,
    // not added to the scene — keeps stage lighting clean and ensures
    // curtains always get correct illumination regardless of scene
    // light reach.)

    // ── Volumetric spotlight cones (game-show beams) ─────────
    // The single biggest fix for the "AI slop" feel was adding visible
    // light shafts cutting through the dust haze. Each cone is a hollow
    // ConeGeometry with an additive gradient shader that's bright at
    // the tip and feathered at the base — a poor-man's volumetric light
    // straight out of John Chapman's classic technique. Six beams angled
    // from above and behind the side TVs create the trademark KBC /
    // Millionaire stage rake.
    const beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 1.3 } },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        void main() {
          vUv = uv;
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        uniform float uTime;
        uniform float uIntensity;
        void main() {
          // bright at the top of the cone (apex), fades toward the base
          float topToBottom = 1.0 - vUv.y;
          float coreFalloff = pow(topToBottom, 1.4);
          // soften the rim of the cone
          float angularFalloff = smoothstep(0.0, 0.5, sin(vUv.x * 3.14159));
          float beam = coreFalloff * angularFalloff;
          // breathing pulse so the beams don't feel static
          float pulse = 0.85 + 0.15 * sin(uTime * 1.2);
          // richer gold with slight warm bias — within the existing palette
          vec3 col = vec3(1.0, 0.90, 0.55) * beam * pulse * uIntensity;
          gl_FragColor = vec4(col, beam * 0.7);
        }
      `,
    });
    const beamGeo = new THREE.ConeGeometry(2.6, 14, 32, 1, true);

    const beams: THREE.Mesh[] = [];
    const addBeam = (x: number, z: number, tilt: number) => {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(x, 9, z);
      beam.rotation.z = tilt;
      // cone apex points down (default cone has apex up)
      beam.rotation.x = Math.PI;
      beam.renderOrder = 4;
      scene.add(beam);
      beams.push(beam);
    };
    addBeam(-5.5, -1.0,  0.18);
    addBeam( 5.5, -1.0, -0.18);
    addBeam(-2.0, -2.5,  0.06);
    addBeam( 2.0, -2.5, -0.06);
    addBeam( 0.0, -4.5,  0.0 );

    // Moving "follow" spot that traces a slow figure-8 across the stage —
    // gives the scene a real broadcast-camera feel.
    const followSpot = new THREE.Mesh(beamGeo, beamMat.clone());
    (followSpot.material as THREE.ShaderMaterial).uniforms.uIntensity.value = 1.4;
    followSpot.position.set(0, 9, 1);
    followSpot.rotation.x = Math.PI;
    followSpot.renderOrder = 5;
    scene.add(followSpot);

    // ── Physics world ────────────────────────────────────────
    const world = new CANNON.World();
    world.gravity.set(0, -14, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = true;
    (world.solver as CANNON.GSSolver).iterations = 16;
    (world.solver as CANNON.GSSolver).tolerance = 0.0005;
    world.defaultContactMaterial.contactEquationRelaxation = 4;
    world.defaultContactMaterial.contactEquationStiffness = 5e6;

    const matStage = new CANNON.Material("stage");
    const matPot = new CANNON.Material("pot");
    const matCoin = new CANNON.Material("coin");
    const matFloor = new CANNON.Material("floor");
    world.addContactMaterial(new CANNON.ContactMaterial(matCoin, matStage, { friction: 0.6, restitution: 0.04 }));
    world.addContactMaterial(new CANNON.ContactMaterial(matCoin, matPot, { friction: 0.88, restitution: 0.02 }));
    world.addContactMaterial(new CANNON.ContactMaterial(matCoin, matCoin, { friction: 0.55, restitution: 0.02 }));
    world.addContactMaterial(new CANNON.ContactMaterial(matCoin, matFloor, { friction: 0.7, restitution: 0.06 }));

    // ── Stage ────────────────────────────────────────────────
    const STAGE_W = 13, STAGE_H = 0.5, STAGE_D = 7;
    const stageGroup = new THREE.Group();

    const stageMesh = new THREE.Mesh(
      new THREE.BoxGeometry(STAGE_W, STAGE_H, STAGE_D),
      new THREE.MeshPhysicalMaterial({
        color: 0x141420, roughness: 0.32, metalness: 0.7,
        envMapIntensity: 0.8, clearcoat: 0.2, clearcoatRoughness: 0.4,
      }),
    );
    stageMesh.position.y = STAGE_H / 2;
    stageMesh.receiveShadow = true;
    stageMesh.castShadow = true;
    stageGroup.add(stageMesh);

    const inlay = new THREE.Mesh(
      new THREE.BoxGeometry(STAGE_W - 0.4, 0.02, STAGE_D - 0.4),
      new THREE.MeshPhysicalMaterial({
        color: 0x0a0a14, roughness: 0.15, metalness: 0.95,
        envMapIntensity: 1.2, clearcoat: 0.5, clearcoatRoughness: 0.15,
      }),
    );
    inlay.position.y = STAGE_H + 0.01;
    inlay.receiveShadow = true;
    stageGroup.add(inlay);

    const edgeMat = new THREE.MeshBasicMaterial({ color: ACCENT_HEX });
    const edges = [
      { w: STAGE_W + 0.05, h: 0.04, d: 0.04, x: 0, z:  STAGE_D / 2 + 0.02 },
      { w: STAGE_W + 0.05, h: 0.04, d: 0.04, x: 0, z: -STAGE_D / 2 - 0.02 },
      { w: 0.04, h: 0.04, d: STAGE_D + 0.05, x:  STAGE_W / 2 + 0.02, z: 0 },
      { w: 0.04, h: 0.04, d: STAGE_D + 0.05, x: -STAGE_W / 2 - 0.02, z: 0 },
    ];
    edges.forEach((s) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), edgeMat);
      m.position.set(s.x, STAGE_H + 0.01, s.z);
      stageGroup.add(m);
    });
    scene.add(stageGroup);

    const stageBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(STAGE_W / 2, STAGE_H / 2, STAGE_D / 2)),
      material: matStage,
    });
    stageBody.position.set(0, STAGE_H / 2, 0);
    world.addBody(stageBody);

    // Floor
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x02020a, roughness: 0.65, metalness: 0.3 }),
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.01;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const groundBody = new CANNON.Body({ mass: 0, material: matFloor });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);

    // ── Pots ─────────────────────────────────────────────────
    const potBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xfff5d8, metalness: 0.0, roughness: 0.04,
      transmission: 1.0, thickness: 0.06, ior: 1.45,
      attenuationColor: new THREE.Color("#ffd870"), attenuationDistance: 4.5,
      envMapIntensity: 1.4, clearcoat: 1.0, clearcoatRoughness: 0.04,
      transparent: true, opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const potRimMat = new THREE.MeshPhysicalMaterial({
      color: 0xfff0b3, roughness: 0.1, metalness: 1.0,
      emissive: 0xd49030, emissiveIntensity: 1.2, envMapIntensity: 2.4,
      clearcoat: 0.7, clearcoatRoughness: 0.05,
    });

    const createPot = (x: number, z: number, scale: number) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0.0, 0),
            new THREE.Vector2(0.42, 0),
            new THREE.Vector2(0.55, 0.15),
            new THREE.Vector2(0.6, 0.45),
            new THREE.Vector2(0.55, 0.7),
            new THREE.Vector2(0.58, 0.78),
          ],
          28,
        ),
        potBodyMat,
      );
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.58, 0.05, 12, 36),
        potRimMat,
      );
      rim.position.y = 0.78;
      rim.rotation.x = Math.PI / 2;
      rim.castShadow = true;
      g.add(rim);

      g.scale.setScalar(scale);
      g.position.set(x, STAGE_H, z);
      scene.add(g);

      // Compound static collider — base + ring of overlapping walls
      const potBody = new CANNON.Body({ mass: 0, material: matPot });
      const innerR = 0.5 * scale;
      const wallH  = 0.65 * scale;
      const baseH  = 0.08;
      const baseShape = new CANNON.Cylinder(innerR, innerR, baseH, 16);
      const baseQ = new CANNON.Quaternion();
      baseQ.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
      potBody.addShape(baseShape, new CANNON.Vec3(0, baseH / 2, 0), baseQ);

      const segments = 20;
      const segArc = (2 * Math.PI) / segments;
      const segWidth = 2 * innerR * Math.sin(segArc / 2) * 1.10;
      const segThick = 0.07;
      for (let i = 0; i < segments; i++) {
        const a = i * segArc;
        const wx = Math.cos(a) * (innerR + segThick / 2);
        const wz = Math.sin(a) * (innerR + segThick / 2);
        const wallShape = new CANNON.Box(new CANNON.Vec3(segWidth / 2, wallH / 2, segThick / 2));
        const wallQ = new CANNON.Quaternion();
        wallQ.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -a + Math.PI / 2);
        potBody.addShape(wallShape, new CANNON.Vec3(wx, baseH + wallH / 2, wz), wallQ);
      }
      potBody.position.set(x, STAGE_H, z);
      world.addBody(potBody);
      return { mesh: g, body: potBody };
    };

    createPot(-3.2, 1.6, 1.0);
    createPot( 3.2, 1.6, 1.0);
    createPot(-1.3, 2.4, 0.85);
    createPot( 1.3, 2.4, 0.85);
    createPot( 0.0, 0.4, 0.75);

    // ── Coin face texture ────────────────────────────────────
    const createCoinFaceTexture = () => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 512;
      const ctx = c.getContext("2d")!;
      const grad = ctx.createRadialGradient(200, 200, 30, 256, 256, 280);
      grad.addColorStop(0,    "#fff5c8");
      grad.addColorStop(0.35, "#ffd84a");
      grad.addColorStop(0.8,  "#bf8a08");
      grad.addColorStop(1,    "#7a5404");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = "rgba(85,55,3,0.7)"; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(256, 256, 232, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(255,242,180,0.55)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(256, 256, 224, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(85,55,3,0.4)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(256, 256, 200, 0, Math.PI * 2); ctx.stroke();

      ctx.font = "bold 230px Georgia, serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(85,55,3,0.7)"; ctx.fillText("✦", 260, 264);
      ctx.fillStyle = "rgba(255,240,170,0.85)"; ctx.fillText("✦", 254, 250);

      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 8;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const coinFaceTex = createCoinFaceTexture();

    // Coin materials — emissive bumped from 0.20 to 0.45 with a warmer
    // amber tint so each coin has its own subtle glow even in shadow.
    // Reads as "lit from within" without going gaudy. envMapIntensity
    // lifted slightly so highlights hit harder under the spotlights.
    const makeCoinMaterial = (hex: number, roughness: number) => (
      new THREE.MeshPhysicalMaterial({
        map: coinFaceTex,
        color: hex,
        metalness: 1.0,
        roughness,
        envMapIntensity: 2.6,
        clearcoat: 0.55,
        clearcoatRoughness: 0.08,
        emissive: 0xffaa44,
        emissiveIntensity: 0.45,
      })
    );
    const COIN_MATERIALS = [
      makeCoinMaterial(0xffd84a, 0.15),
      makeCoinMaterial(0xffe055, 0.18),
      makeCoinMaterial(0xfdc70a, 0.14),
      makeCoinMaterial(0xffd23a, 0.16),
      makeCoinMaterial(0xffcc1a, 0.20),
    ];

    // ── Coins (rain) ─────────────────────────────────────────
    const COIN_RADIUS = 0.105;
    const COIN_HEIGHT = 0.028;
    // Bumped from 120 to 150 so the rain reads as a downpour, not a
    // trickle — the extra 30 spawn across a wider area than the pots
    // (see pickSpawnPoint below) so some hit the stage like real rain.
    const COIN_COUNT = 150;
    const coinGeo = new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_HEIGHT, 24);
    coinGeo.rotateX(Math.PI / 2);

    type Coin = {
      mesh: THREE.Mesh;
      body: CANNON.Body;
      alive: boolean;
      age: number;
      idx: number;
      scale: number;
      settledFrames: number;
    };
    const coins: Coin[] = [];

    let shakeMagnitude = 0;
    let firstImpactFired = false;
    let initialAudioWindowEnd = 0; // performance.now() ms — bumped on first impact
    const onCoinImpact = (velocity: number, idx: number) => {
      // ── Audio gate ─────────────────────────────────────────
      // The very first coin landing MUST make sound, otherwise the
      // user perceives ~1+ seconds of silent rain (physics fall time
      // alone is ~1s, and the legacy 18% random gate filters out the
      // first 5-10 impacts statistically). We force-fire the first
      // qualifying impact, then run a 2.5s "loud rain" window where
      // the gate is bumped to 50% so the start of the drop reads as
      // a confident downpour, then settle back to the 18% rhythm so
      // it doesn't fight the music for the rest of the scene.
      if (!firstImpactFired) {
        firstImpactFired = true;
        initialAudioWindowEnd = performance.now() + 2500;
        playCoinTink(((idx * 53) % 200) - 100);
      } else {
        const inInitialWindow = performance.now() < initialAudioWindowEnd;
        const tinkProb = inInitialWindow ? 0.5 : 0.18;
        if (Math.random() < tinkProb) {
          playCoinTink(((idx * 53) % 200) - 100);
        }
      }
      // ── Shake gate ─────────────────────────────────────────
      // Only contribute to camera shake during the INITIAL spawn
      // wave. Once all coins have spawned, the recycler keeps
      // dropping fallen coins forever — but their impacts must NOT
      // keep shaking the stage indefinitely (that's the bug where
      // curtains/screens/stage shake until rain stops, which it
      // never does). Existing shake decays out at 0.88/frame.
      if (!initialSpawnDone) {
        shakeMagnitude = Math.min(shakeMagnitude + velocity * 0.0022, 0.05);
      }
    };

    const createCoin = (idx: number): Coin => {
      const matIdx = idx % COIN_MATERIALS.length;
      const scale = 0.92 + Math.random() * 0.16;
      const mesh = new THREE.Mesh(coinGeo, COIN_MATERIALS[matIdx]);
      mesh.scale.setScalar(scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const r = COIN_RADIUS * scale;
      const h = COIN_HEIGHT * scale;
      const shape = new CANNON.Box(new CANNON.Vec3(r, r, h / 2));
      const body = new CANNON.Body({
        mass: 0.07, shape, material: matCoin,
        linearDamping: 0.12, angularDamping: 0.65,
        allowSleep: true, sleepSpeedLimit: 0.35, sleepTimeLimit: 0.22,
      });

      const coin: Coin = {
        mesh, body, alive: false, age: 0, idx, scale, settledFrames: 0,
      };
      body.addEventListener("collide", (e: { contact: CANNON.ContactEquation }) => {
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v > 0.6) onCoinImpact(v, coin.idx);
      });
      return coin;
    };

    // Spawn directly above one of the five pots with small jitter — coins
    // now actually land in pots instead of scattering across the stage.
    // Pot positions match the createPot() calls above.
    const POT_TARGETS: Array<{ x: number; z: number }> = [
      { x: -3.2, z: 1.6 },
      { x:  3.2, z: 1.6 },
      { x: -1.3, z: 2.4 },
      { x:  1.3, z: 2.4 },
      { x:  0.0, z: 0.4 },
    ];
    // Hybrid spawn: 70% of coins target a pot (tight ±0.32 spread, drop
    // straight in), 30% rain across the full stage with wide spread —
    // those bounce off the inlay and create the actual "raining down"
    // visual the user wanted. Spawn height: y=8-10 (was 12-15, dropped
    // to cut ~0.5s of dead-air silence before the first audible
    // impact while still preserving the "sheets of rain" silhouette).
    const pickSpawnPoint = () => {
      const isPotShot = Math.random() < 0.7;
      if (isPotShot) {
        const target = POT_TARGETS[Math.floor(Math.random() * POT_TARGETS.length)];
        return {
          x: target.x + (Math.random() - 0.5) * 0.34,
          z: target.z + (Math.random() - 0.5) * 0.34,
          y: 8 + Math.random() * 2,
        };
      }
      // Rain: wide spread across the entire stage area
      return {
        x: (Math.random() - 0.5) * (STAGE_W - 1.5),
        z: (Math.random() - 0.5) * (STAGE_D - 1.0) + 0.7,
        y: 8 + Math.random() * 2,
      };
    };

    const spawnCoinAt = (coin: Coin, x: number, y: number, z: number) => {
      coin.body.position.set(x, y, z);
      const eq = new CANNON.Quaternion();
      eq.setFromEuler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
      coin.body.quaternion.copy(eq);
      coin.body.velocity.set((Math.random() - 0.5) * 0.5, -Math.random() * 0.4, (Math.random() - 0.5) * 0.3);
      coin.body.angularVelocity.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      coin.body.wakeUp();
      coin.settledFrames = 0;
      if (!coin.alive) {
        world.addBody(coin.body);
        coin.alive = true;
      }
      coin.age = 0;
    };

    for (let i = 0; i < COIN_COUNT; i++) coins.push(createCoin(i));

    const SETTLE_SPEED = 0.08, SETTLE_ANGSPEED = 0.15, SETTLE_FRAMES_REQUIRED = 20;
    const checkAndForceSleep = (coin: Coin) => {
      if (coin.body.sleepState === CANNON.Body.SLEEPING) return;
      const v = coin.body.velocity;
      const w = coin.body.angularVelocity;
      const speed = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
      const angSpeed = Math.sqrt(w.x*w.x + w.y*w.y + w.z*w.z);
      if (speed < SETTLE_SPEED && angSpeed < SETTLE_ANGSPEED) {
        coin.settledFrames++;
        if (coin.settledFrames >= SETTLE_FRAMES_REQUIRED) {
          coin.body.velocity.setZero();
          coin.body.angularVelocity.setZero();
          coin.body.sleep();
        }
      } else {
        coin.settledFrames = 0;
      }
    };

    let spawnIndex = 0;
    let spawnTimer = 0;
    let recycleTimer = 0;
    const SPAWN_INTERVAL_INITIAL = 0.06;
    let initialSpawnDone = false;

    const spawnNext = () => {
      if (spawnIndex >= coins.length) return;
      const c = coins[spawnIndex++];
      const p = pickSpawnPoint();
      spawnCoinAt(c, p.x, p.y, p.z);
    };

    const recycleFallenCoins = () => {
      for (const c of coins) {
        if (!c.alive) continue;
        if (c.body.position.y < -2.5 || Math.abs(c.body.position.x) > 30 || Math.abs(c.body.position.z) > 30) {
          const p = pickSpawnPoint();
          spawnCoinAt(c, p.x, p.y, p.z);
        }
      }
    };

    const maintainRain = (dt: number) => {
      if (!initialSpawnDone) return;
      recycleTimer += dt;
      if (recycleTimer < 1.4) return;
      recycleTimer = 0;
      let candidate: Coin | null = null;
      let oldestAge = -1;
      for (const c of coins) {
        if (!c.alive) continue;
        const onFloor = c.body.position.y < 0.4;
        if (c.body.sleepState === CANNON.Body.SLEEPING && onFloor && c.age > oldestAge) {
          candidate = c; oldestAge = c.age;
        }
      }
      if (candidate) {
        const p = pickSpawnPoint();
        spawnCoinAt(candidate, p.x, p.y, p.z);
      }
    };

    // ── LED screens (3D planes with CanvasTexture) ───────────
    type Screen = {
      group: THREE.Group;
      pole: THREE.Mesh;
      canvas: HTMLCanvasElement;
      ctx: CanvasRenderingContext2D;
      tex: THREE.CanvasTexture;
      drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;
      width: number;
      height: number;
    };

    const makeScreen = (
      width: number,
      height: number,
      drawFn: Screen["drawFn"],
    ): Screen => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = Math.round(512 * (height / width));
      const ctx = canvas.getContext("2d")!;
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;

      // Tight matte-black bezel — was a chunky brown frame with a giant
      // translucent gold halo around it; that halo was reading as a grey
      // border on dark backgrounds.
      const bezel = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.14, height + 0.14, 0.1),
        new THREE.MeshPhysicalMaterial({
          color: 0x070504, roughness: 0.4, metalness: 0.9,
          envMapIntensity: 0.7,
        }),
      );
      bezel.castShadow = true;

      // Thin gold edge rails on the four sides of the bezel — gives the
      // TV a brand identity without bloating the silhouette.
      const railMat = new THREE.MeshBasicMaterial({ color: ACCENT_HEX });
      const railThick = 0.022;
      const railZ = 0.06;
      const railTop = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.18, railThick, railThick),
        railMat,
      );
      railTop.position.set(0, (height + 0.14) / 2, railZ);
      const railBot = railTop.clone();
      railBot.position.y = -(height + 0.14) / 2;
      const railL = new THREE.Mesh(
        new THREE.BoxGeometry(railThick, height + 0.18, railThick),
        railMat,
      );
      railL.position.set(-(width + 0.14) / 2, 0, railZ);
      const railR = railL.clone();
      railR.position.x = (width + 0.14) / 2;

      const display = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
      );
      display.position.z = 0.06;

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.6, 16),
        new THREE.MeshPhysicalMaterial({
          color: 0x18140e, roughness: 0.25, metalness: 0.95, envMapIntensity: 1.0,
        }),
      );
      pole.castShadow = true;

      const group = new THREE.Group();
      group.add(bezel, railTop, railBot, railL, railR, display);
      return { group, pole, canvas, ctx, tex, drawFn, width, height };
    };

    const applyNoiseAndScanlines = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, intensity: number) => {
      const blockSize = 2;
      for (let y = 0; y < h; y += blockSize) {
        for (let x = 0; x < w; x += blockSize) {
          if (Math.random() < intensity * 0.35) {
            ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.18})`;
            ctx.fillRect(x, y, blockSize, blockSize);
          }
          if (Math.random() < intensity * 0.15) {
            ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
            ctx.fillRect(x, y, blockSize, blockSize);
          }
        }
      }
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      const barY = ((t * 60) % (h + 80)) - 40;
      const grad = ctx.createLinearGradient(0, barY - 30, 0, barY + 30);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.06)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, barY - 30, w, 60);
      if (Math.random() < 0.08) {
        const gy = Math.random() * h;
        ctx.fillStyle = `rgba(${ACCENT_RGB},${0.15 + Math.random() * 0.2})`;
        ctx.fillRect(0, gy, w, 1 + Math.random() * 3);
      }
    };

    // CENTER: 1% Club with god rays + glow
    // (drawCenter removed — middle TV is now a Unicorn Studio HTML overlay)

    // LEFT: journey summary — clean, no tech-slang. Reads like a
    // scoreboard panel, not a code comment.
    const drawLeft = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const j = journeyRef.current;
      const player = playerRef.current;

      // Warm dark background (was cool blue-black)
      ctx.fillStyle = "#0a0820"; ctx.fillRect(0, 0, w, h);

      // Header — just "Your Run", centered
      ctx.fillStyle = `rgb(${ACCENT_RGB})`;
      ctx.font = "600 16px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("YOUR RUN", w / 2, 40);

      // Underline
      ctx.strokeStyle = `rgba(${ACCENT_RGB},0.55)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(w / 2 - 38, 50); ctx.lineTo(w / 2 + 38, 50); ctx.stroke();

      // Player name
      if (player) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 30px Georgia, serif";
        ctx.fillText(player, w / 2, 88);
      }

      const rows: Array<{ label: string; value: string; accent?: boolean }> = [
        { label: "Reached",  value: `${j.reachedPercentage}%` },
        { label: "Correct",  value: `${j.correctCount} / ${j.totalQuestions}` },
        { label: "Pot total", value: formatRupees(j.potPrize) },
      ];
      if (j.shareOfPot != null && j.isWinner) {
        rows.push({ label: "Your share", value: formatRupees(j.shareOfPot), accent: true });
      }

      const startY = 138;
      const stepY = 42;
      rows.forEach((row, i) => {
        const y = startY + i * stepY;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "400 14px Georgia, serif";
        ctx.textAlign = "left";
        ctx.fillText(row.label, 28, y);
        ctx.fillStyle = row.accent ? `rgb(${ACCENT_RGB})` : "#ffffff";
        ctx.font = "600 24px Georgia, serif";
        ctx.textAlign = "right";
        ctx.fillText(row.value, w - 28, y);
      });

      // Tiny pulse dot bottom-right (subtle)
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.fillStyle = `rgba(${ACCENT_RGB}, ${pulse * 0.7})`;
      ctx.beginPath(); ctx.arc(w - 28, h - 28, 4, 0, Math.PI * 2); ctx.fill();

      applyNoiseAndScanlines(ctx, w, h, t, 0.25);
    };

    // RIGHT: brand line — text was barely readable before. Bumped sizes
    // by ~70%, moved to a strong 3-tier hierarchy (label → headline →
    // CTA) and added a soft gold glow on the headline so it carries
    // across the room the way actual game-show signage does.
    const drawRight = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#160a2a"); g.addColorStop(1, "#06061a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      // Tiny eyebrow label
      ctx.fillStyle = `rgba(${ACCENT_RGB},0.85)`;
      ctx.font = "700 16px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("PARTNER WITH", w / 2, 44);

      // Hairline under eyebrow
      ctx.strokeStyle = `rgba(${ACCENT_RGB},0.45)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w / 2 - 56, 56); ctx.lineTo(w / 2 + 56, 56); ctx.stroke();

      // Headline — much bigger, with a halo so it reads as broadcast
      // signage, not a footnote. Drawn twice: once as a soft gold halo,
      // once crisp white on top.
      const pulse = 0.6 + 0.4 * Math.sin(t * 1.2);
      ctx.shadowColor = `rgba(${ACCENT_WARM_RGB}, ${0.55 + 0.25 * pulse})`;
      ctx.shadowBlur = 22;
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 34px Georgia, serif";
      ctx.fillText("THE 1% CLUB", w / 2, 110);
      ctx.shadowBlur = 0;

      // Sub-headline
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = "500 22px Georgia, serif";
      ctx.fillText("Make your brand", w / 2, 154);
      ctx.fillText("part of the show.", w / 2, 184);

      // Spacer rule
      ctx.strokeStyle = `rgba(${ACCENT_RGB},0.7)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(w / 2 - 60, 214); ctx.lineTo(w / 2 + 60, 214); ctx.stroke();

      // CTA + date
      ctx.fillStyle = `rgb(${ACCENT_RGB})`;
      ctx.font = "800 22px Georgia, serif";
      ctx.fillText("COMING SOON", w / 2, 248);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "600 16px Georgia, serif";
      ctx.fillText("AUG 2026", w / 2, 274);

      applyNoiseAndScanlines(ctx, w, h, t, 0.25);
    };

    // The MIDDLE screen is rendered as an HTML overlay with the actual
    // Unicorn Studio scene (project bvwx8jlcK4svGCWnqqju). The 3D plane
    // version of it is removed because canvas approximation can't match
    // the real WebGL scene the user designed in Unicorn.
    const screens: Screen[] = [];

    // Side TVs lowered from y=2.9 to y=2.4 so they sit clearly BELOW
    // the cinema screen's lower edge in screen space (the cinema's
    // "CLUB" wordmark was being chopped by these before). Pole heights
    // adjusted to match, keeping them planted on the stage.
    const left = makeScreen(3.2, 2.0, drawLeft);
    left.group.position.set(-4.6, 2.4, -2.4);
    left.group.rotation.y = Math.PI / 9;
    left.pole.scale.y = 0.7;
    left.pole.position.set(-4.6, 0.95, -2.4);
    scene.add(left.group, left.pole);
    screens.push(left);

    const right = makeScreen(3.2, 2.0, drawRight);
    right.group.position.set(4.6, 2.4, -2.4);
    right.group.rotation.y = -Math.PI / 9;
    right.pole.scale.y = 0.7;
    right.pole.position.set(4.6, 0.95, -2.4);
    scene.add(right.group, right.pole);
    screens.push(right);

    // ── Dust ─────────────────────────────────────────────────
    const dustCount = 240;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3]     = (Math.random() - 0.5) * 30;
      dustPos[i * 3 + 1] = Math.random() * 12;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 3;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: ACCENT_HEX, size: 0.04, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(dust);

    // ── Confetti burst (one-shot, fires on mount) ────────────
    // Authentic game shows have the cannon-fire of confetti the moment
    // the winner is revealed. 220 paper-thin gold quads with random
    // tumble — drops with simple gravity, no physics overhead.
    const confettiCount = 220;
    const confettiGeo = new THREE.PlaneGeometry(0.08, 0.16);
    const confettiColors = [0xffd84a, 0xfff0a0, 0xd4af37, 0xfff5c8, 0xf7d360];
    type ConfettiPiece = {
      mesh: THREE.Mesh;
      vel: THREE.Vector3;
      angVel: THREE.Vector3;
      life: number;
    };
    const confettiPieces: ConfettiPiece[] = [];
    for (let i = 0; i < confettiCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: confettiColors[i % confettiColors.length],
        side: THREE.DoubleSide,
        emissive: 0x553a08,
        emissiveIntensity: 0.4,
        metalness: 0.6,
        roughness: 0.3,
      });
      const m = new THREE.Mesh(confettiGeo, mat);
      // burst origins: two cannons stage-left and stage-right at the rim
      const fromLeft = i % 2 === 0;
      m.position.set(fromLeft ? -5.0 : 5.0, 6.5, fromLeft ? 0.5 : 0.5);
      const launchX = fromLeft ? 4 + Math.random() * 4 : -(4 + Math.random() * 4);
      const launchY = 8 + Math.random() * 6;
      const launchZ = (Math.random() - 0.5) * 4;
      scene.add(m);
      confettiPieces.push({
        mesh: m,
        vel: new THREE.Vector3(launchX * 0.4, launchY * 0.4, launchZ * 0.4),
        angVel: new THREE.Vector3(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
        ),
        life: 0,
      });
    }
    const CONFETTI_LIFETIME = 6.5;

    // ── Cinematic dolly-in ───────────────────────────────────
    // Camera starts pushed back and slightly low, dollies forward to
    // the resting cinematic eye-level over 2.4 seconds with cubic ease
    // out. Replaces the previous static camera which read as flat.
    const CAM_START = new THREE.Vector3(0, 3.2, 17.5);
    const CAM_END   = new THREE.Vector3(0, 4.4, 13.2);
    const DOLLY_DURATION = 2.4;
    let dollyT = 0;

    // ── Animation loop ───────────────────────────────────────
    const clock = new THREE.Clock();
    const FIXED_DT = 1 / 60;
    let accumulator = 0;
    let raf = 0;
    let cancelled = false;

    const animate = () => {
      if (cancelled) return;
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      if (startedRef.current) {
        accumulator += dt;
        while (accumulator >= FIXED_DT) {
          world.step(FIXED_DT);
          accumulator -= FIXED_DT;
        }

        spawnTimer += dt;
        if (!initialSpawnDone) {
          if (spawnTimer >= SPAWN_INTERVAL_INITIAL) {
            spawnTimer = 0;
            spawnNext();
            if (spawnIndex >= coins.length) initialSpawnDone = true;
          }
        }

        recycleFallenCoins();
        maintainRain(dt);

        for (const c of coins) {
          if (!c.alive) continue;
          checkAndForceSleep(c);
          c.mesh.position.set(c.body.position.x, c.body.position.y, c.body.position.z);
          c.mesh.quaternion.set(c.body.quaternion.x, c.body.quaternion.y, c.body.quaternion.z, c.body.quaternion.w);
          c.age += dt;
        }
      }

      // LED screens
      screens.forEach((s) => {
        s.drawFn(s.ctx, s.canvas.width, s.canvas.height, t);
        s.tex.needsUpdate = true;
      });

      // Dust
      const dPos = dust.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        dPos[i * 3 + 1] -= 0.005;
        if (dPos[i * 3 + 1] < 0) dPos[i * 3 + 1] = 12;
      }
      dust.geometry.attributes.position.needsUpdate = true;

      // Cinematic dolly-in for the first 2.4 seconds, then HOLD steady.
      // Camera drift was the cause of the perceived stage tilt — even
      // ±0.15 makes the composition look skewed at random capture
      // moments. Locked at center; only impact-shake (decays fast) is
      // allowed, no idle wandering.
      dollyT = Math.min(dollyT + dt, DOLLY_DURATION);
      const dollyEase = 1 - Math.pow(1 - dollyT / DOLLY_DURATION, 3);
      const baseX = THREE.MathUtils.lerp(CAM_START.x, CAM_END.x, dollyEase);
      const baseY = THREE.MathUtils.lerp(CAM_START.y, CAM_END.y, dollyEase);
      const baseZ = THREE.MathUtils.lerp(CAM_START.z, CAM_END.z, dollyEase);
      shakeMagnitude *= 0.88;
      camera.position.x = baseX + (Math.random() - 0.5) * shakeMagnitude;
      camera.position.y = baseY + (Math.random() - 0.5) * shakeMagnitude;
      camera.position.z = baseZ;
      camera.lookAt(0, 2.4, -1.6);

      goldGlow.intensity = 1.0 + Math.sin(t * 1.5) * 0.3;

      // Drive shaders that breathe with time (curtains are now a
      // painted texture — no shader uniform needed)
      (beamMat.uniforms.uTime.value as number) = t;
      ((followSpot.material as THREE.ShaderMaterial).uniforms.uTime.value as number) = t;

      // Curtains open animation — runs once on mount with a small delay.
      // The mesh transforms stay anchored at the rail; we drive the
      // uOpenFactor uniform on each material, and the vertex shader
      // bunches the fabric toward the outer edges. Cubic ease-out so
      // the gather decelerates naturally into the bunched state.
      const curtainElapsed = Math.max(0, t - CURTAIN_OPEN_DELAY);
      curtainOpenT = Math.min(curtainElapsed / CURTAIN_OPEN_DURATION, 1);
      const curtainEase = 1 - Math.pow(1 - curtainOpenT, 3);
      // Direct uniform access — uniforms are exposed at construction
      // on a ShaderMaterial, no compilation race.
      curtainMatL.uniforms.uOpenFactor.value = curtainEase;
      curtainMatL.uniforms.uTime.value = t;
      curtainMatR.uniforms.uOpenFactor.value = curtainEase;
      curtainMatR.uniforms.uTime.value = t;

      // Follow spot traces a slow figure-8 across the stage front
      const fsx = Math.sin(t * 0.6) * 4.5;
      const fsz = Math.sin(t * 0.3) * 2.0 + 1.0;
      followSpot.position.x = fsx;
      followSpot.position.z = fsz;

      // Confetti tumble + drop
      for (const p of confettiPieces) {
        if (p.life > CONFETTI_LIFETIME) continue;
        p.life += dt;
        // gravity
        p.vel.y -= 9.0 * dt;
        // air resistance (stronger horizontally)
        p.vel.x *= 0.99;
        p.vel.z *= 0.99;
        p.mesh.position.x += p.vel.x * dt;
        p.mesh.position.y += p.vel.y * dt;
        p.mesh.position.z += p.vel.z * dt;
        p.mesh.rotation.x += p.angVel.x * dt;
        p.mesh.rotation.y += p.angVel.y * dt;
        p.mesh.rotation.z += p.angVel.z * dt;
        // fade out as life expires
        const life01 = p.life / CONFETTI_LIFETIME;
        const fadeStart = 0.7;
        if (life01 > fadeStart) {
          const fade = 1 - (life01 - fadeStart) / (1 - fadeStart);
          (p.mesh.material as THREE.MeshStandardMaterial).opacity = fade;
          (p.mesh.material as THREE.MeshStandardMaterial).transparent = true;
        }
        // remove from scene once expired (prevents performance creep)
        if (p.life > CONFETTI_LIFETIME && p.mesh.parent) {
          scene.remove(p.mesh);
        }
      }

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    // Auto-start (no overlay) — we've already had user gesture earlier
    // in the flow (welcome video, Next Question clicks etc), so the
    // AudioContext should be unlocked. If not, the tinks just no-op.
    startedRef.current = true;

    // ── Resize ───────────────────────────────────────────────
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    // ── Cleanup ──────────────────────────────────────────────
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      coinFaceTex.dispose();
      envMap.dispose();
      curtainTexL.dispose();
      curtainTexR.dispose();
      curtainNormalTex.dispose();
      try { container.removeChild(renderer.domElement); } catch { /* */ }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden"
      style={{
        // Layered backstage atmosphere — base solid warm-dark, then a
        // central radial halo, then a soft vignette that NEVER reaches
        // pure black (kept to #06030a minimum so the corners read as
        // ambient room shadow, not void). Was fading to #000 which
        // created the "empty black" feel the user flagged.
        background: [
          "radial-gradient(ellipse 60% 50% at 50% 28%, rgba(255,200,120,0.10) 0%, rgba(0,0,0,0) 55%)",
          "radial-gradient(ellipse 130% 110% at 50% 50%, #160a2a 0%, #0e0828 50%, #06061a 80%, #03020c 100%)",
        ].join(", "),
      }}
    >
      {/* CINEMA SCREEN (zIndex 0) — Unicorn Studio scene behind the
          stage. Sized and positioned so the entire bottom edge clears
          the side-TV upper rims in screen space (was being clipped at
          "CLUB" before). Inset gold rim removed — it was bleeding
          through the curtain shader's transparency and showing as a
          ghost rectangle on the curtains. The outer warm halo stays
          for ambiance. */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "2vh",
          left: "50%",
          transform: "translateX(-50%)",
          height: "min(40vh, 38vw)",
          aspectRatio: "16 / 9",
          padding: "8px",
          background: "linear-gradient(180deg,#160a2a 0%,#06061a 100%)",
          borderRadius: "10px",
          boxShadow: [
            // Outer warm halo only — no inset rim so nothing bleeds
            // through the (now-opaque) curtains as a hard edge.
            "0 0 90px 6px rgba(228,207,106,0.22)",
            "0 40px 100px -20px rgba(0,0,0,0.85)",
          ].join(", "),
          zIndex: 0,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            background: "#0d0d0f",
            borderRadius: "4px",
            position: "relative",
          }}
        >
          {/* Instant-show placeholder — gradient + 1% wordmark + a
              spotlight wash. Visible the moment the page renders so the
              cinema is never empty while the unicorn JSON + SDK fetch.
              UnicornScene mounts on top and covers it once ready. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: [
                "radial-gradient(ellipse at 50% 30%, rgba(255,225,140,0.18) 0%, rgba(0,0,0,0) 55%)",
                "linear-gradient(180deg,#0a0612 0%,#160a2a 50%,#06061a 100%)",
              ].join(", "),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "0.4em",
              color: "#f7d360",
              fontFamily: "Georgia, serif",
              letterSpacing: "0.04em",
            }}
          >
            <div
              style={{
                fontSize: "clamp(36px, 6vw, 72px)",
                fontWeight: 800,
                textShadow: "0 0 24px rgba(228,207,106,0.55)",
                lineHeight: 1,
              }}
            >
              1%
            </div>
            <div
              style={{
                fontSize: "clamp(14px, 1.6vw, 22px)",
                fontWeight: 700,
                opacity: 0.85,
                letterSpacing: "0.18em",
              }}
            >
              CLUB
            </div>
          </div>
          <UnicornScene
            jsonFilePath={UNICORN_JSON_PATH}
            sdkUrl={UNICORN_SDK_URL}
            width="100%"
            height="100%"
            production
            lazyLoad={false}
            dpi={1.5}
            fps={60}
          />
        </div>
      </div>

      {/* 3D scene (stage, pots, coin rain, side LED screens, confetti,
          spotlights, curtains). Canvas is alpha-transparent so the
          cinema screen behind shows through the empty regions. */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 1, pointerEvents: "none" }}
      />
    </div>
  );
}
