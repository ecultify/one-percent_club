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
import * as CANNON from "cannon-es";

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
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    scene.add(new THREE.AmbientLight("#fff0c0", 0.55));
    const hemi = new THREE.HemisphereLight("#fff2c4", "#3a2410", 1.3);
    hemi.position.set(0, 4, 0);
    scene.add(hemi);
    const keySpot = new THREE.SpotLight("#fff5cc", 50, 18, Math.PI / 5, 0.4);
    keySpot.position.set(0, 6, 2.4);
    scene.add(keySpot);
    scene.add(keySpot.target);
    const rimL = new THREE.PointLight("#ffd860", 22, 10);
    rimL.position.set(-2.6, 1.3, 1.6);
    scene.add(rimL);
    const rimR = new THREE.PointLight("#ffaa3a", 18, 10);
    rimR.position.set(2.6, 1.0, -1.8);
    scene.add(rimR);
    const fillR = new THREE.PointLight("#ffe399", 14, 9);
    fillR.position.set(2.4, 0.6, 2.4);
    scene.add(fillR);
    const fillL = new THREE.PointLight("#ffd9a3", 10, 9);
    fillL.position.set(-2.2, 0.4, 2.2);
    scene.add(fillL);
    const bottomGlow = new THREE.PointLight("#ff9a40", 5, 5);
    bottomGlow.position.set(0, -1.5, 0);
    scene.add(bottomGlow);

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

    // ── Glass pot material — fully clear with a gold rim breath ──
    // Maxed transmission + paper-thin geometry path + long attenuation
    // distance = the body reads as crystal glass with a warm halo, not a
    // tinted surface. Coins inside should be unmistakably visible.
    const potMat = new THREE.MeshPhysicalMaterial({
      color: "#fffaf0",
      metalness: 0.0,
      roughness: 0.02,
      transmission: 1.0,
      thickness: 0.06,
      ior: 1.42,
      attenuationColor: new THREE.Color("#ffd870"),
      attenuationDistance: 6.5,
      envMapIntensity: 1.6,
      emissive: "#5a3008",
      emissiveIntensity: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    const pot = new THREE.Mesh(potGeo, potMat);

    // ── Gold rim ring on top — keeps the "treasure pot" identity ──
    const rimGeo = new THREE.TorusGeometry(0.82, 0.05, 18, 110);
    const rimMat = new THREE.MeshPhysicalMaterial({
      color: "#fff5d8",
      metalness: 1.0,
      roughness: 0.08,
      emissive: "#e0a040",
      emissiveIntensity: 1.4,
      envMapIntensity: 2.6,
      clearcoat: 0.7,
      clearcoatRoughness: 0.05,
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
    const coinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 28);
    const coinMat = new THREE.MeshPhysicalMaterial({
      color: "#fff0a8",
      metalness: 1.0,
      roughness: 0.13,
      emissive: "#c08018",
      emissiveIntensity: 0.55,
      envMapIntensity: 2.6,
      clearcoat: 0.6,
      clearcoatRoughness: 0.06,
    });

    // Physics world
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.8, 0),
    });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = true;
    (world.solver as CANNON.GSSolver).iterations = 10;

    const coinPhysicsMat = new CANNON.Material("coin");
    const wallPhysicsMat = new CANNON.Material("wall");
    world.addContactMaterial(
      new CANNON.ContactMaterial(coinPhysicsMat, coinPhysicsMat, {
        friction: 0.45,
        restitution: 0.18,
      }),
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(coinPhysicsMat, wallPhysicsMat, {
        friction: 0.55,
        restitution: 0.12,
      }),
    );

    // Pot interior collision: a thin disc floor + a ring of vertical walls
    // approximating the interior radius. The pot's inner profile bulges
    // (widest at the belly, narrower at the rim), so we use 3 stacked rings
    // at progressively smaller radii to roughly track that shape.
    const floor = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Cylinder(0.7, 0.6, 0.05, 24),
      material: wallPhysicsMat,
    });
    floor.position.set(0, POT_INNER_BOTTOM - 0.02, 0);
    world.addBody(floor);

    const addRing = (y: number, radius: number, segments = 18) => {
      const wallH = 0.45;
      const wallW = (Math.PI * 2 * radius) / segments + 0.05;
      const halfExt = new CANNON.Vec3(wallW / 2, wallH / 2, 0.02);
      const wallShape = new CANNON.Box(halfExt);
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;
        const body = new CANNON.Body({
          mass: 0,
          shape: wallShape,
          material: wallPhysicsMat,
        });
        body.position.set(x, y, z);
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -a + Math.PI / 2);
        world.addBody(body);
      }
    };
    addRing(POT_INNER_BOTTOM + 0.18, 0.62);     // belly band 1
    addRing(POT_INNER_BOTTOM + 0.55, 0.78);     // belly band 2 (widest)
    addRing(POT_INNER_BOTTOM + 0.95, 0.78);     // belly band 3
    addRing(POT_INNER_BOTTOM + 1.35, 0.66);     // neck

    type CoinState = {
      mesh: THREE.Mesh;
      body: CANNON.Body;
      mode: "hidden" | "preDrop" | "live";
      spawnAtMs: number;
      hadFirstHit: boolean;
      sleepTimer: number;
    };

    const coins: CoinState[] = [];
    const coinShape = new CANNON.Cylinder(0.12, 0.12, 0.04, 16);
    for (let i = 0; i < MAX_VISIBLE_COINS; i++) {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.visible = false;
      scene.add(m);

      const body = new CANNON.Body({
        mass: 0.06,
        shape: coinShape,
        material: coinPhysicsMat,
        sleepSpeedLimit: 0.18,
        sleepTimeLimit: 0.35,
        linearDamping: 0.18,
        angularDamping: 0.4,
      });
      body.allowSleep = true;
      body.collisionResponse = false;
      world.addBody(body);

      coins.push({
        mesh: m,
        body,
        mode: "hidden",
        spawnAtMs: 0,
        hadFirstHit: false,
        sleepTimer: 0,
      });
    }

    // Initial assignment.
    const totalAfter = Math.min(
      MAX_VISIBLE_COINS,
      Math.max(0, Math.floor(previousCoinTotal + newCoinsThisRound)),
    );
    const preCount = Math.min(MAX_VISIBLE_COINS, Math.max(0, Math.floor(previousCoinTotal)));
    const newCount = Math.max(0, totalAfter - preCount);

    // Helper: spawn a coin at a randomized position above the rim.
    const spawnCoin = (c: CoinState) => {
      c.body.collisionResponse = true;
      c.body.wakeUp();
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.32;
      c.body.position.set(
        Math.cos(ang) * r,
        1.6 + Math.random() * 0.45,
        Math.sin(ang) * r,
      );
      c.body.velocity.set(
        (Math.random() - 0.5) * 0.6,
        -0.5 - Math.random() * 1.0,
        (Math.random() - 0.5) * 0.6,
      );
      c.body.angularVelocity.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 6,
      );
      c.body.quaternion.setFromAxisAngle(
        new CANNON.Vec3(Math.random(), Math.random(), Math.random()).unit(),
        Math.random() * Math.PI,
      );
      c.mesh.visible = true;
      c.mode = "live";
    };

    // Pre-existing coins: drop them all instantly and let physics settle
    // before the user even sees the scene. We step the world several
    // hundred substeps so the pile is at rest at frame 1.
    for (let i = 0; i < preCount; i++) {
      spawnCoin(coins[i]);
    }
    // Pre-warm: step the physics world to settle pre-existing coins.
    // Spawning all at once would clip through each other; stagger via
    // mini-batches with substeps between.
    for (let batch = 0; batch < 8; batch++) {
      for (let s = 0; s < 30; s++) world.step(1 / 60);
    }

    // New coins: queued to drop with stagger after delayMs.
    for (let i = preCount; i < preCount + newCount; i++) {
      const c = coins[i];
      const inGroup = i - preCount;
      c.mode = "preDrop";
      c.spawnAtMs = 80 + inGroup * 95;
    }
    // Hidden remainder.
    for (let i = preCount + newCount; i < MAX_VISIBLE_COINS; i++) {
      coins[i].mode = "hidden";
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

    const animate = () => {
      if (cancelled) return;
      const now = performance.now();
      const delta = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      // Spawn queued new coins as their stagger time elapses.
      for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        if (c.mode === "preDrop" && now >= dropBeginAt + c.spawnAtMs) {
          spawnCoin(c);
          if (!c.hadFirstHit) {
            // We don't actually know the precise impact moment without
            // contact callbacks, but kicking the pot around the time of
            // first descent reads correctly. This fires once per coin.
            window.setTimeout(() => applyImpactKick(), 320);
            c.hadFirstHit = true;
          }
        }
      }

      // Step physics (clamp to a safe max so a long frame doesn't explode).
      world.step(1 / 60, delta, 3);

      // Sync each live coin's mesh to its body. Force-sleep once velocity
      // drops below threshold so the pile doesn't jitter forever.
      for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        if (c.mode !== "live") continue;
        const p = c.body.position;
        const q = c.body.quaternion;
        c.mesh.position.set(p.x, p.y, p.z);
        c.mesh.quaternion.set(q.x, q.y, q.z, q.w);

        // Manual sleep enforcement — cannon's auto-sleep can be flaky on
        // light bodies sitting on each other.
        const v = c.body.velocity;
        const av = c.body.angularVelocity;
        const speed2 = v.x*v.x + v.y*v.y + v.z*v.z + av.x*av.x + av.y*av.y + av.z*av.z;
        if (speed2 < 0.06) {
          c.sleepTimer += delta;
          if (c.sleepTimer > 0.4) {
            c.body.sleep();
            c.body.velocity.set(0, 0, 0);
            c.body.angularVelocity.set(0, 0, 0);
          }
        } else {
          c.sleepTimer = 0;
        }
      }

      // Pot rocking spring
      swingVelX += (-POT_SPRING * swingX - POT_DAMPING * swingVelX) * delta;
      swingVelZ += (-POT_SPRING * swingZ - POT_DAMPING * swingVelZ) * delta;
      swingX += swingVelX * delta;
      swingZ += swingVelZ * delta;
      if (swingX > POT_MAX_TILT) { swingX = POT_MAX_TILT; swingVelX *= -0.3; }
      if (swingX < -POT_MAX_TILT) { swingX = -POT_MAX_TILT; swingVelX *= -0.3; }
      if (swingZ > POT_MAX_TILT) { swingZ = POT_MAX_TILT; swingVelZ *= -0.3; }
      if (swingZ < -POT_MAX_TILT) { swingZ = -POT_MAX_TILT; swingVelZ *= -0.3; }
      // Pot stays statically forward-facing; only impact swing tilts it.
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
