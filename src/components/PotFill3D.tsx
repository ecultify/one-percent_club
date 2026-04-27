"use client";

/**
 * PotFill3D
 * ─────────────────────────────────────────────────────────────────
 * A real-time 3D treasure pot rendered as a glass vessel with
 * gold coins stacking inside. The stack is cumulative across
 * rounds: previously-collected coins are already settled at the
 * bottom when the screen mounts, and new coins drop in on top
 * with simple gravity + bounce physics.
 *
 * The pot itself is glass (transmission-based MeshPhysicalMaterial)
 * with a gold-metallic rim ring on top, so the user reads the
 * vessel without losing visibility of the coin stack inside.
 *
 * Props are coin counts (not fill ratios), because the visual is
 * driven by the count of physical objects, not a continuous level.
 */

import { useRef, useEffect } from "react";
import * as THREE from "three";
// cannon-es is no longer used — coin movement is now driven by deterministic
// tweens in the animate loop. Removing the import keeps the bundle lean and
// stops the dead dependency from confusing future maintainers.

interface PotFill3DProps {
  /** Cumulative coins already collected from previous rounds (settled at start). */
  previousCoinTotal: number;
  /** New coins to drop this round (animated). */
  newCoinsThisRound: number;
  /** Bump to re-trigger the drop animation. */
  playKey: number;
  /** Drop animation duration in ms (default 1500). */
  durationMs?: number;
  /** Delay before drops begin, in ms (default 300). */
  delayMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

const POT_INNER_BOTTOM = -0.85;
const POT_INNER_HEIGHT = 1.7;
const GRAVITY = -8.5;

// Pot rocking spring
const POT_SPRING = 95;
const POT_DAMPING = 7.5;
const POT_IMPACT_KICK = 1.4;
const POT_MAX_TILT = 0.085;

// Coin stacking
const COINS_PER_LAYER = 5;          // 1 center + 4 around
const LAYER_HEIGHT = 0.052;
const STACK_RING_RADIUS = 0.3;
const MAX_VISIBLE_COINS = 80;       // hard cap (also the pool size)

/** Procedural gold environment cubemap.
 *  Even with a glass pot, this drives reflections + tints on the
 *  rim ring and on each coin so they read as polished metal. */
function buildGoldEnvMap(): THREE.CubeTexture {
  const size = 256;
  const faces: HTMLCanvasElement[] = [];
  const kinds: Array<"side" | "top" | "bottom"> = [
    "side", "side", "top", "bottom", "side", "side",
  ];
  kinds.forEach((kind) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    if (kind === "top") {
      const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/1.3);
      grad.addColorStop(0, "#fff5e0");
      grad.addColorStop(0.4, "#ffe399");
      grad.addColorStop(1, "#ffd060");
      ctx.fillStyle = grad;
    } else if (kind === "bottom") {
      const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/1.1);
      grad.addColorStop(0, "#5a3010");
      grad.addColorStop(1, "#100804");
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, "#fff5d8");
      grad.addColorStop(0.25, "#ffd860");
      grad.addColorStop(0.6, "#a06820");
      grad.addColorStop(1, "#1a0a04");
      ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, size, size);
    if (kind === "side") {
      const band = ctx.createLinearGradient(0, size * 0.18, 0, size * 0.32);
      band.addColorStop(0, "rgba(255,255,255,0)");
      band.addColorStop(0.5, "rgba(255,255,255,0.85)");
      band.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, size, size);
    }
    faces.push(c);
  });
  const tex = new THREE.CubeTexture(faces);
  tex.mapping = THREE.CubeReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Deterministic per-coin slot position for index `i` (0-based) in the stack.
 *  Layered packing: each layer is one center coin + 4 ring coins, with a
 *  small per-coin jitter so the pile doesn't read as a perfect lattice. */
function getCoinSlot(i: number): {
  x: number; y: number; z: number;
  rotY: number; tiltX: number; tiltZ: number;
} {
  const layer = Math.floor(i / COINS_PER_LAYER);
  const inLayer = i % COINS_PER_LAYER;

  let x = 0;
  let z = 0;
  if (inLayer > 0) {
    const angle = ((inLayer - 1) / 4) * Math.PI * 2 + layer * 0.42;
    x = Math.cos(angle) * STACK_RING_RADIUS;
    z = Math.sin(angle) * STACK_RING_RADIUS;
  }

  // Deterministic pseudo-random jitter for natural variation.
  const seedA = Math.sin(i * 91.3) * 43758.5453;
  const seedB = Math.sin(i * 137.7) * 43758.5453;
  const seedC = Math.sin(i * 47.1) * 43758.5453;
  const seedD = Math.sin(i * 71.9) * 43758.5453;
  const seedE = Math.sin(i * 13.5) * 43758.5453;
  const r = (s: number) => (s - Math.floor(s)) - 0.5;

  x += r(seedA) * 0.06;
  z += r(seedB) * 0.06;
  const tiltX = r(seedC) * 0.4;
  const tiltZ = r(seedD) * 0.4;
  const rotY = (r(seedE) + 0.5) * Math.PI * 2;

  const y = POT_INNER_BOTTOM + LAYER_HEIGHT / 2 + layer * LAYER_HEIGHT;

  return { x, y, z, rotY, tiltX, tiltZ };
}

export default function PotFill3D({
  previousCoinTotal,
  newCoinsThisRound,
  playKey,
  durationMs = 1500,
  delayMs = 300,
  className,
  style,
}: PotFill3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer ────────────────────────────────────────────────
    // Cap pixel ratio at 1.5 — Retina-2 was quadrupling fragment work for
    // basically zero perceptual gain on a small inline canvas, and was a
    // major contributor to the "slow" feel of this scene.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const initialW = container.offsetWidth || 320;
    const initialH = container.offsetHeight || 320;
    renderer.setSize(initialW, initialH, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const goldEnvMap = buildGoldEnvMap();
    scene.environment = goldEnvMap;

    const camera = new THREE.PerspectiveCamera(38, initialW / initialH, 0.1, 100);
    camera.position.set(0, 1.7, 4.4);
    camera.lookAt(0, 0.05, 0);

    // ── Lighting ────────────────────────────────────────────────
    // Light count cut from 8 → 4. Each PBR fragment evaluates every dynamic
    // light, so 8 lights × ~80 coins × every pixel under each material was
    // a major contributor to the slowdown. The remaining four cover ambient,
    // hemisphere fill, a top key spot, and one warm rim — visually similar
    // to the previous lighting once the env map (already strong) takes over.
    scene.add(new THREE.AmbientLight("#fff0c0", 0.7));
    const hemi = new THREE.HemisphereLight("#fff2c4", "#3a2410", 1.4);
    hemi.position.set(0, 4, 0);
    scene.add(hemi);
    const keySpot = new THREE.SpotLight("#fff5cc", 55, 18, Math.PI / 5, 0.4);
    keySpot.position.set(0, 6, 2.4);
    scene.add(keySpot);
    scene.add(keySpot.target);
    const rimLight = new THREE.PointLight("#ffd060", 28, 10);
    rimLight.position.set(-2.4, 1.1, 1.8);
    scene.add(rimLight);

    // ── Pot geometry — same lathe profile as before ────────────
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.0, -1.0),
      new THREE.Vector2(0.42, -1.0),
      new THREE.Vector2(0.72, -0.85),
      new THREE.Vector2(0.94, -0.55),
      new THREE.Vector2(1.0, -0.15),
      new THREE.Vector2(0.94, 0.22),
      new THREE.Vector2(0.78, 0.5),
      new THREE.Vector2(0.72, 0.7),
      new THREE.Vector2(0.86, 0.78),
      new THREE.Vector2(0.78, 0.78),
      new THREE.Vector2(0.66, 0.7),
      new THREE.Vector2(0.62, 0.5),
      new THREE.Vector2(0.86, 0.0),
      new THREE.Vector2(0.66, -0.85),
      new THREE.Vector2(0.0, -0.85),
    ];
    const potGeo = new THREE.LatheGeometry(profile, 96);
    potGeo.computeVertexNormals();

    // ── Pot material — TRULY transparent glass ────────────────────
    // The previous version used color #fffaf0 + opacity 0.42 which read as
    // a milky white plastic over the black backdrop. The user explicitly
    // wants "transparent so I can always see the coins inside" — so we go
    // much harder on transparency:
    //   - color is barely-tinted (almost neutral white) so the body doesn't
    //     paint on top of the coins
    //   - opacity 0.18 — body is now mostly invisible, only the silhouette
    //     and the highlights from envMap reflections read
    //   - envMapIntensity bumped to 2.4 so the bits we DO see are crisp
    //     gold-tinted reflections (the env cube is gold)
    //   - depthWrite: false so coins behind the pot never get culled by
    //     the body's depth buffer write — this is the real fix for
    //     "I can't see the coins through the pot" if it ever happens
    //   - emissive zero'd — any warmth was reading as a white glow
    const potMat = new THREE.MeshStandardMaterial({
      color: "#f8f6ee",
      metalness: 0.0,
      roughness: 0.08,
      envMapIntensity: 2.4,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const pot = new THREE.Mesh(potGeo, potMat);
    // Render order: coins (default 0) draw first, pot (1) draws after so
    // the alpha blends correctly against the coins behind it.
    pot.renderOrder = 1;

    // ── Gold rim ring on top — keeps the "treasure pot" identity ──
    // Downgraded from `MeshPhysicalMaterial` (with clearcoat) to plain
    // `MeshStandardMaterial`. The env map + emissive already give us the
    // polished-gold look; clearcoat was adding a second BRDF pass we don't
    // visually need on a small inline canvas.
    const rimGeo = new THREE.TorusGeometry(0.82, 0.05, 18, 110);
    const rimMat = new THREE.MeshStandardMaterial({
      color: "#fff5d8",
      metalness: 1.0,
      roughness: 0.18,
      emissive: "#e0a040",
      emissiveIntensity: 1.2,
      envMapIntensity: 2.4,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.78;

    // Group everything that should rock together
    const potGroup = new THREE.Group();
    potGroup.add(pot);
    potGroup.add(rim);
    scene.add(potGroup);

    // ── Coin pool with cannon-es physics ───────────────────────
    // Each coin is a cylinder rigid body that drops into the pot
    // interior (built from a ring of static walls + a floor disc).
    // Coins collide with each other and pile naturally, then sleep
    // when at rest so they don't jitter forever.
    // Coin segment count cut from 28 → 18: visually indistinguishable at
    // the scene scale, ~36% fewer triangles per coin × up to 80 coins.
    const coinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 18);
    // Coins downgraded to MeshStandardMaterial. With up to 80 coins on
    // screen, every BRDF feature multiplies. Clearcoat dropped (the env map
    // already sells the polished metal); roughness nudged a hair to keep
    // the coins reading like soft polished gold rather than mirror chrome.
    const coinMat = new THREE.MeshStandardMaterial({
      color: "#fff0a8",
      metalness: 1.0,
      roughness: 0.22,
      emissive: "#c08018",
      emissiveIntensity: 0.5,
      envMapIntensity: 2.4,
    });

    // ── Coin pool — TWEENED (no physics) ───────────────────────────
    // Previous implementation used cannon-es to simulate every coin as a
    // rigid body. Three problems with that:
    //   1) Cylinder-cylinder contacts are a known weak spot in cannon-es —
    //      coins occasionally jitter, sink into each other, or flick out.
    //   2) Even with sleep enforcement, lots of awake bodies = lots of
    //      per-frame work, which read as the "load on the website".
    //   3) The simulated rest pose is non-deterministic, so the "settled"
    //      pile can drift slightly between rounds.
    //
    // Replaced with deterministic tweened drops: each new coin animates
    // from a randomised spawn position above the rim to its computed slot
    // (`getCoinSlot(i)`) over ~700 ms, with a custom curve that mimics
    // gravity acceleration plus a tiny end-of-fall bounce. Pre-existing
    // coins are placed directly at their slot positions on mount.
    //
    // Net: no physics steps in the animate loop, no jitter, no clipping,
    // and the pile looks identical between runs. cannon-es is still
    // imported (it ships with the bundle either way), but no longer
    // contributes to per-frame cost on this scene.
    type CoinState =
      | { mode: "hidden"; mesh: THREE.Mesh }
      | {
          mode: "settled";
          mesh: THREE.Mesh;
        }
      | {
          mode: "preDrop";
          mesh: THREE.Mesh;
          spawnAtMs: number;
          slotIndex: number;
        }
      | {
          mode: "dropping";
          mesh: THREE.Mesh;
          startMs: number;
          durationMs: number;
          startPos: THREE.Vector3;
          targetPos: THREE.Vector3;
          startQuat: THREE.Quaternion;
          targetQuat: THREE.Quaternion;
          impactScheduled: boolean;
        };

    const coins: CoinState[] = [];
    for (let i = 0; i < MAX_VISIBLE_COINS; i++) {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.visible = false;
      scene.add(m);
      coins.push({ mode: "hidden", mesh: m });
    }

    /** Build the deterministic resting quaternion for a slot. */
    const slotQuat = (slotIndex: number): THREE.Quaternion => {
      const slot = getCoinSlot(slotIndex);
      const qX = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        slot.tiltX,
      );
      const qZ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        slot.tiltZ,
      );
      const qY = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        slot.rotY,
      );
      return qY.multiply(qZ).multiply(qX);
    };

    /** Custom drop curve — accelerating gravity + small bounce + settle.
     *  Returns 0..~1.04..1 across t ∈ [0,1]. */
    const dropCurve = (t: number): number => {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      if (t < 0.78) {
        const u = t / 0.78;
        return u * u; // ease in quadratic — feels like falling
      }
      // 0.78 → 1.0: damped overshoot bounce (~5% past target, recovers)
      const u = (t - 0.78) / 0.22;
      return 1 + 0.05 * Math.sin(Math.PI * u) * Math.pow(1 - u, 1.5);
    };

    // Initial assignment.
    const totalAfter = Math.min(
      MAX_VISIBLE_COINS,
      Math.max(0, Math.floor(previousCoinTotal + newCoinsThisRound)),
    );
    const preCount = Math.min(MAX_VISIBLE_COINS, Math.max(0, Math.floor(previousCoinTotal)));
    const newCount = Math.max(0, totalAfter - preCount);

    // Pre-existing coins → settle at their slot positions immediately.
    for (let i = 0; i < preCount; i++) {
      const c = coins[i];
      const slot = getCoinSlot(i);
      const q = slotQuat(i);
      c.mesh.position.set(slot.x, slot.y, slot.z);
      c.mesh.quaternion.copy(q);
      c.mesh.visible = true;
      coins[i] = { mode: "settled", mesh: c.mesh };
    }

    // New coins → queued to start dropping after `dropBeginAt + spawnAtMs`.
    for (let i = preCount; i < preCount + newCount; i++) {
      const inGroup = i - preCount;
      coins[i] = {
        mode: "preDrop",
        mesh: coins[i].mesh,
        // Stagger so coins land in sequence — same cadence as the previous
        // physics version (every 95 ms).
        spawnAtMs: 80 + inGroup * 95,
        slotIndex: i,
      };
    }
    // The rest stay hidden.
    for (let i = preCount + newCount; i < MAX_VISIBLE_COINS; i++) {
      coins[i] = { mode: "hidden", mesh: coins[i].mesh };
    }

    // ── Pot rocking spring ─────────────────────────────────────
    // Pot stays facing forward — only the impact swing drives rotation.
    // No idle Y revolution.
    let swingX = 0, swingZ = 0, swingVelX = 0, swingVelZ = 0;
    const applyImpactKick = () => {
      swingVelX += (Math.random() - 0.5) * POT_IMPACT_KICK;
      swingVelZ += (Math.random() - 0.5) * POT_IMPACT_KICK;
    };

    // ── Animation loop ─────────────────────────────────────────
    const startedAt = performance.now();
    const dropBeginAt = startedAt + delayMs;
    let lastFrame = startedAt;
    let frameId = 0;
    let cancelled = false;

    // Reusable scratch quaternion for slerp (avoids per-frame allocations).
    const scratchQuat = new THREE.Quaternion();

    const animate = () => {
      if (cancelled) return;
      const now = performance.now();
      const delta = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      // ── Coin state transitions + tween updates ───────────────────
      for (let i = 0; i < coins.length; i++) {
        const c = coins[i];

        // preDrop → dropping: when the staggered spawn time elapses,
        // pick a randomised start position above the rim and lock the
        // drop trajectory to its slot.
        if (c.mode === "preDrop" && now >= dropBeginAt + c.spawnAtMs) {
          const slot = getCoinSlot(c.slotIndex);
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * 0.32;
          const startPos = new THREE.Vector3(
            slot.x + Math.cos(ang) * r * 0.6,
            1.55 + Math.random() * 0.35,
            slot.z + Math.sin(ang) * r * 0.6,
          );
          // Random orientation at spawn → settled slot orientation at land.
          const startQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
              Math.random() * Math.PI * 2,
              Math.random() * Math.PI * 2,
              Math.random() * Math.PI * 2,
            ),
          );
          const targetPos = new THREE.Vector3(slot.x, slot.y, slot.z);
          const targetQuat = slotQuat(c.slotIndex);

          c.mesh.position.copy(startPos);
          c.mesh.quaternion.copy(startQuat);
          c.mesh.visible = true;

          coins[i] = {
            mode: "dropping",
            mesh: c.mesh,
            startMs: now,
            // 700 ms ± ~120 ms — slight per-coin variation reads as natural.
            durationMs: 700 + Math.random() * 240,
            startPos,
            targetPos,
            startQuat,
            targetQuat,
            impactScheduled: false,
          };
          continue;
        }

        // dropping: advance the tween. When the curve crosses ~0.7 we
        // schedule the pot's impact kick once (matches the moment the
        // coin would visually hit the pile).
        if (c.mode === "dropping") {
          const t = Math.min(1, (now - c.startMs) / c.durationMs);
          const k = dropCurve(t);

          c.mesh.position.x = c.startPos.x + (c.targetPos.x - c.startPos.x) * k;
          c.mesh.position.y = c.startPos.y + (c.targetPos.y - c.startPos.y) * k;
          c.mesh.position.z = c.startPos.z + (c.targetPos.z - c.startPos.z) * k;
          // Slerp orientation on the same eased curve.
          scratchQuat.copy(c.startQuat).slerp(c.targetQuat, Math.min(1, k));
          c.mesh.quaternion.copy(scratchQuat);

          if (!c.impactScheduled && t >= 0.78) {
            applyImpactKick();
            c.impactScheduled = true;
          }

          if (t >= 1) {
            // Snap to exact target so floating-point drift doesn't leave
            // the pile micro-misaligned across many rounds.
            c.mesh.position.copy(c.targetPos);
            c.mesh.quaternion.copy(c.targetQuat);
            coins[i] = { mode: "settled", mesh: c.mesh };
          }
        }
      }

      // ── Pot rocking spring ───────────────────────────────────────
      // Cheap explicit-Euler spring driven by impact kicks. Same logic
      // as before — physics-free apart from this one analytic spring.
      swingVelX += (-POT_SPRING * swingX - POT_DAMPING * swingVelX) * delta;
      swingVelZ += (-POT_SPRING * swingZ - POT_DAMPING * swingVelZ) * delta;
      swingX += swingVelX * delta;
      swingZ += swingVelZ * delta;
      if (swingX > POT_MAX_TILT) { swingX = POT_MAX_TILT; swingVelX *= -0.3; }
      if (swingX < -POT_MAX_TILT) { swingX = -POT_MAX_TILT; swingVelX *= -0.3; }
      if (swingZ > POT_MAX_TILT) { swingZ = POT_MAX_TILT; swingVelZ *= -0.3; }
      if (swingZ < -POT_MAX_TILT) { swingZ = -POT_MAX_TILT; swingVelZ *= -0.3; }
      potGroup.rotation.set(swingX, 0, swingZ);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    // ── Resize ─────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    });
    ro.observe(container);

    // ── Cleanup ────────────────────────────────────────────────
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      ro.disconnect();

      potGeo.dispose();
      potMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();
      coinGeo.dispose();
      coinMat.dispose();
      goldEnvMap.dispose();
      renderer.dispose();
      try {
        container.removeChild(renderer.domElement);
      } catch {
        /* container may already be detached */
      }
    };
  }, [playKey, previousCoinTotal, newCoinsThisRound, durationMs, delayMs]);

  return <div ref={containerRef} className={className} style={style} />;
}
