/**
 * Performance diagnostic flags.
 *
 * TEMPORARY — used to isolate the source of the mid-playback video stutter.
 * Set a flag to FALSE to disable that subsystem at mount time.
 *
 * Toggle these to find the culprit:
 *   - threeJs:          Logo3D + final-screen 3D scenes
 *   - particles:        GoldDustField (canvas) + WinnerMetallicConfetti
 *   - cursorParticles:  CursorGoldDust (cursor trail)
 *   - framerVideoFades: AnimatePresence opacity crossfades around the
 *                       foreground video overlay (not all framer-motion)
 *   - backgroundVideo:  HomeIntroVideo (intro + looping idle background)
 *
 * Once we identify the culprit, restore the relevant flag(s) and revert.
 */
export const PERF_FLAGS = {
  threeJs: true,
  // GoldDustField (canvas 2D, ~60fps rAF + 55 particles) was the heaviest
  // always-on workload. Disabled permanently; cursor dust kept because it
  // only emits on pointer activity and is much cheaper.
  particles: false,
  cursorParticles: true,
  framerVideoFades: true,
  // HomeIntroVideo plays the main intro once, but its looping LastVid2.mp4
  // background is commented out inside the component so a second decoder
  // is never alive while quiz videos play.
  backgroundVideo: true,
} as const;
