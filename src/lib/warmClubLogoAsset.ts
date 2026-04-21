/** Same path as `logoModelPreload` / Logo3D — warms HTTP cache without importing Three.js into the main bundle. */
const CLUB_LOGO_GLB_PATH = "/1percent-club-gold.glb";

let inserted = false;

export function warmClubLogoGlbAsset(): void {
  if (typeof document === "undefined" || inserted) return;
  inserted = true;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "fetch";
  link.href = CLUB_LOGO_GLB_PATH;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}
