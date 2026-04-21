"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { getPreloadedClubLogoScene, preloadClubLogoModel } from "@/lib/logoModelPreload";

interface Logo3DProps {
  settled: boolean;
  className?: string;
  style?: React.CSSProperties;
  onReady?: () => void;
}

export default function Logo3D({ settled, className, style, onReady }: Logo3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    model: THREE.Group | null;
    frameId: number;
    clock: THREE.Clock;
  } | null>(null);

  const settledRef = useRef(settled);
  settledRef.current = settled;

  const [modelReady, setModelReady] = useState(false);

  const init = useCallback(
    (container: HTMLDivElement) => {
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.8;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      // Use LAYOUT dimensions (offsetWidth/Height) — NOT getBoundingClientRect.
      // The parent motion.div is often in mid-transform (scale: 0 → 1) when
      // Logo3D mounts, and getBoundingClientRect returns TRANSFORMED dims
      // (0×0 or tiny), which falls through to a fallback 200×200 — the canvas
      // then stays at 200×200 forever because ResizeObserver doesn't fire on
      // CSS transform changes. offsetWidth/offsetHeight ignore transforms.
      const w = container.offsetWidth || 300;
      const h = container.offsetHeight || 300;
      const dpr = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      // Ensure canvas fills the container via CSS even if WebGL framebuffer
      // was initialized at a smaller size (belt-and-suspenders for animation
      // edge cases).
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
      // Will be repositioned after model loads
      camera.position.set(0, 0, 3);

      // ── Lighting ──
      // Key light: bright warm from top (brighter top glow)
      const keyLight = new THREE.DirectionalLight("#ffe8a0", 4.5);
      keyLight.position.set(1, 6, 4);
      scene.add(keyLight);

      // Top spot: concentrated bright glow from directly above
      const topSpot = new THREE.SpotLight("#fff2cc", 5, 20, Math.PI / 4, 0.5);
      topSpot.position.set(0, 8, 2);
      topSpot.target.position.set(0, 0, 0);
      scene.add(topSpot);
      scene.add(topSpot.target);

      // Fill light: cooler from left
      const fillLight = new THREE.PointLight("#b4c7ff", 1.4);
      fillLight.position.set(-3, 1, 3);
      scene.add(fillLight);

      // Rim light: amber from behind for edge pop
      const rimLight = new THREE.PointLight("#ffa726", 3.0);
      rimLight.position.set(0, 2, -3);
      scene.add(rimLight);

      // Bottom fill so underside isn't pitch black
      const bottomLight = new THREE.PointLight("#ff8f00", 0.5);
      bottomLight.position.set(0, -3, 2);
      scene.add(bottomLight);

      // Ambient base
      const ambient = new THREE.AmbientLight("#ffffff", 0.3);
      scene.add(ambient);

      // ── Bright studio environment map for gold reflections ──
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      const envScene = new THREE.Scene();

      // 1) Warm gradient background sphere (the base reflection)
      const envGeo = new THREE.SphereGeometry(10, 64, 64);
      const envColors: number[] = [];
      const posAttr = envGeo.getAttribute("position");
      for (let i = 0; i < posAttr.count; i++) {
        const y = posAttr.getY(i);
        const t = (y + 10) / 20; // 0 at bottom, 1 at top
        // Warm gradient: dark amber at bottom to bright cream at top
        envColors.push(
          0.15 + t * 0.85,   // R: 0.15 → 1.0
          0.10 + t * 0.70,   // G: 0.10 → 0.80
          0.05 + t * 0.35,   // B: 0.05 → 0.40
        );
      }
      envGeo.setAttribute("color", new THREE.Float32BufferAttribute(envColors, 3));
      const envMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
      envScene.add(new THREE.Mesh(envGeo, envMat));

      // 2) Hot spot panels (simulate studio soft boxes for sharp reflections)
      const panelGeo = new THREE.PlaneGeometry(4, 4);

      // Top panel: bright warm white (main shine source)
      const topPanel = new THREE.Mesh(
        panelGeo,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.2, 1.8), side: THREE.DoubleSide }),
      );
      topPanel.position.set(0, 7, 0);
      topPanel.rotation.x = Math.PI / 2;
      envScene.add(topPanel);

      // Front-right panel: warm gold highlight
      const rightPanel = new THREE.Mesh(
        panelGeo,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.6, 0.8), side: THREE.DoubleSide }),
      );
      rightPanel.position.set(5, 2, 4);
      rightPanel.lookAt(0, 0, 0);
      envScene.add(rightPanel);

      // Front-left panel: cooler fill
      const leftPanel = new THREE.Mesh(
        panelGeo,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.4, 1.8), side: THREE.DoubleSide }),
      );
      leftPanel.position.set(-5, 2, 4);
      leftPanel.lookAt(0, 0, 0);
      envScene.add(leftPanel);

      // Back rim panel: amber edge highlight
      const backPanel = new THREE.Mesh(
        panelGeo,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.2, 0.4), side: THREE.DoubleSide }),
      );
      backPanel.position.set(0, 3, -5);
      backPanel.lookAt(0, 0, 0);
      envScene.add(backPanel);

      scene.environment = pmremGenerator.fromScene(envScene, 0).texture;
      pmremGenerator.dispose();

      const clock = new THREE.Clock();

      const state = {
        renderer,
        scene,
        camera,
        model: null as THREE.Group | null,
        frameId: 0,
        clock,
      };

      // ── Load model (or use preloaded) ──
      const addModel = (original: THREE.Group) => {
        // Clone so multiple Logo3D instances don't fight over the same scene graph
        const model = original.clone(true);

        // Boost gold material from Blender export
        model.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const mat = child.material as THREE.MeshStandardMaterial;
            // Clone material so we don't mutate the shared preloaded one
            child.material = mat.clone();
            const m = child.material as THREE.MeshStandardMaterial;

            // Ensure gold metallic properties
            m.metalness = 1.0;
            m.roughness = 0.08;
            m.envMapIntensity = 3.0;
            // Add emissive glow for the gold shine
            m.emissive = new THREE.Color(0xffd700);
            m.emissiveIntensity = 0.2;
            m.side = THREE.DoubleSide;
            m.needsUpdate = true;
          }
        });

        // ── Center the model at origin so it rotates in place ──
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        // Offset the model so its geometric center sits at (0,0,0)
        model.position.set(-center.x, -center.y, -center.z);

        // Fix mirrored text: flip on X axis
        model.scale.x = -1;

        // Wrap in a pivot group that we'll rotate
        const pivot = new THREE.Group();
        pivot.add(model);

        // Camera looks at origin (where model center now is)
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const padding = 1.25;
        const dist = (maxDim * padding) / (2 * Math.tan(fov / 2));

        camera.position.set(0, 0, dist);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        scene.add(pivot);
        state.model = pivot; // Rotate the pivot, not the offset model
        setModelReady(true);
        onReady?.();
      };

      const tryLoad = () => {
        const cached = getPreloadedClubLogoScene();
        if (cached) {
          addModel(cached);
        } else {
          preloadClubLogoModel()
            .then(addModel)
            .catch((err) => {
              console.warn("[Logo3D] preload failed, retrying once:", err);
              preloadClubLogoModel().then(addModel).catch((e) => {
                console.error("[Logo3D] model load failed:", e);
                // Unblock the UI — signal ready even though we have no model,
                // otherwise GameFlow stays stuck at logo-center forever waiting
                // for logoModelReady to flip. A missing 3D logo is better than
                // a frozen experience.
                setModelReady(true);
                onReady?.();
              });
            });
        }
      };
      tryLoad();

      // ── Render loop ──
      function animate() {
        state.frameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        if (state.model) {
          // Clean Y-axis turntable spin (model is centered at origin via pivot)
          const speed = settledRef.current ? 1.2 : 2.0;
          state.model.rotation.y += delta * speed;
          // Keep X and Z level (no wobble)
          state.model.rotation.x = 0;
          state.model.rotation.z = 0;
        }

        renderer.render(scene, camera);
      }
      animate();

      stateRef.current = state;
      return state;
    },
    [onReady],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const state = init(container);

    const observer = new ResizeObserver(() => {
      // Same reasoning as in init(): use layout dimensions, not transformed.
      const w = container.offsetWidth || 300;
      const h = container.offsetHeight || 300;
      state.camera.aspect = w / h;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(w, h, false);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(state.frameId);
      state.renderer.dispose();
      if (container.contains(state.renderer.domElement)) {
        container.removeChild(state.renderer.domElement);
      }
    };
  }, [init]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        // Opacity only — `visibility:hidden` on a WebGL canvas parent can suppress
        // compositing in some browsers so the logo never appears after load.
        opacity: modelReady ? 1 : 0,
        transition: "opacity 0.4s ease-out",
        pointerEvents: "none",
      }}
    />
  );
}
