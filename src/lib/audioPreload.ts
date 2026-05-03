/* ─────────────────────────────────────────────────────────────────────────
 *  audioPreload.ts
 *  ─────────────────────────────────────────────────────────────────────────
 *  Warms the browser's HTTP cache for every audio asset the app plays
 *  during a session. Without this, every `new Audio(SRC).play()` call in
 *  the codebase incurs a cold-cache fetch from Vercel (DNS + TLS + RTT +
 *  decode) the first time the cue fires — easily 300-900ms of perceived
 *  latency on each cue, which is the lag Abhinav noticed after deploy.
 *
 *  Strategy:
 *    Tier 1 (eager) — short SFX cues that fire in the first ~30s of a
 *                     session: dhak, theme, correct/wrong dings, tick,
 *                     timer bed, applause, elimination sting.
 *    Tier 2 (deferred) — per-question host VO files. Loaded on next tick
 *                        so Tier 1 has bandwidth priority.
 *    Tier 3 (lazy) — ending VO files. Loaded a second after Tier 2 since
 *                    they only fire once at the very end.
 *
 *  We instantiate `Audio()` objects, set `preload = "auto"`, kick `load()`,
 *  and hold strong references in a Map so the elements (and their pending
 *  fetches) aren't garbage-collected mid-download. The elements stay
 *  muted + paused — they exist purely to populate the browser's HTTP
 *  cache so subsequent `new Audio(SAME_URL)` calls hit instantly.
 *  ─────────────────────────────────────────────────────────────────── */

/** Critical SFX that fire in the first 30s of a session — must be ready
 *  the moment the user clicks "Continue with sound" on the priming gate. */
const TIER_1_CRITICAL_AUDIO: readonly string[] = [
  // Welcome video stingers (T=0 and T=3)
  "/sound/dhak.wav",
  // Game show theme bed
  encodeURI("/sound/The 1 Club Theme Tune - Twin Petes (1).mp3"),
  // Quiz round SFX
  encodeURI("/sound/644963__craigscottuk__quiz-gameshow-correct-ping-14.mp3"),
  encodeURI("/sound/131657__bertrof__game-sound-wrong.wav"),
  encodeURI("/sound/ITV's _ The 1 club - 30 Second Timer.mp3"),
  "/sound/timerVO.mp3",
  encodeURI("/sound/450509__abyeditsound__clockticksound_01.wav"),
  encodeURI("/sound/appluase2.wav"),
  "/sound/applause_2s.wav",
  "/sound/eliminationdecision.wav",
];

/** Per-question host narration VOs. Each fires once when the matching
 *  question first appears. Ordered Q1→Q10 so the earliest-needed file
 *  starts downloading first. */
const TIER_2_QUESTION_VOS: readonly string[] = [
  encodeURI("/questionscreenimages/question1(findthemistake-90)/q1VO(canyoufindthemistake).mp3"),
  encodeURI("/questionscreenimages/question2(gandhijirealornot-80)/q2VO(gandhiji).mp3"),
  encodeURI("/questionscreenimages/question3(cardsnglasses-70)/q3VO(cardsnglasses).mp3"),
  encodeURI("/questionscreenimages/question4(jessicanmandy-60)/q4VO.mp3"),
  encodeURI("/questionscreenimages/question5(biggestsquare-50)/q5VOrevised.mp3"),
  encodeURI("/questionscreenimages/question6(4transports-40)/q6VO.mp3"),
  encodeURI("/questionscreenimages/question7(earthnmars-30)/q7VO.mp3"),
  encodeURI("/questionscreenimages/question8(gymnast-20)/q8VO.mp3"),
  encodeURI("/questionscreenimages/question9(number1to6-10)/q9VO.mp3"),
  encodeURI("/questionscreenimages/question10(onepercent-1)/q10VO.mp3"),
];

// NOTE: the ending VO MP3s (endingvoallcorrect.mp3 / endvoifevenonewrong.mp3)
// used to be preloaded here. They were removed once the .mp4 ending videos
// (endingvoifallcorrect.mp4 / endvoifevenonewrong.mp4) took over — those
// videos carry the same VO baked into video, and the standalone MP3
// playback on the FinalResult screen was removed to stop the duplicate
// narration. No reason to spend bandwidth prewarming files we don't play.

/** Process-wide flag so a re-mount of AudioPrimingGate (e.g. fast-refresh
 *  in dev, or a Suspense remount) doesn't kick off a second wave of
 *  fetches for files already warming. */
let preloadStarted = false;

/** Strong references to the in-flight Audio elements. Without this, the
 *  garbage collector can reap them before the fetch completes — at which
 *  point the browser cancels the pending request and the cache stays
 *  cold. We never read from this map again; it just keeps the elements
 *  alive for the lifetime of the page. */
const preloadRegistry = new Map<string, HTMLAudioElement>();

function warmOne(url: string): void {
  if (preloadRegistry.has(url)) return;
  const el = new Audio();
  // Muted in case any browser tries to autoplay during preload (it
  // shouldn't — we never call play() — but defense in depth).
  el.muted = true;
  el.preload = "auto";
  el.crossOrigin = "anonymous";
  // Setting src + calling load() triggers the network fetch. Browser
  // populates its HTTP cache with the response, keyed by URL. Future
  // `new Audio(SAME_URL)` reads from that cache.
  el.src = url;
  try {
    el.load();
  } catch {
    /* ignore — some browsers throw on load() during teardown */
  }
  preloadRegistry.set(url, el);
}

/**
 * Kick off the audio prewarm. Idempotent: safe to call multiple times.
 * Call from AudioPrimingGate after the user grants the audio activation
 * gesture (so any browser that gates fetch() on user activation also
 * lets these requests through immediately).
 *
 * Bandwidth strategy:
 *   - Tier 1 fires immediately. Small SFX files, ~10 of them. Browser
 *     queues beyond 6 concurrent connections per origin so they finish
 *     in 2-3 waves.
 *   - Tier 2 (per-question VOs) waits for the home intro video to fire
 *     "homevideo:enter-cue", which is the moment the welcome hero beat
 *     completes and the Enter button surfaces. By that time the welcome
 *     video has finished its critical playback window and bandwidth is
 *     free for the next tier.
 *   - Within Tier 2, files load in batches of 2 with a 4s stagger. Since
 *     the user spends ~30s on each question, q3+q4 only need to be in
 *     cache 60s after the user reaches Q1. Loading all 10 in parallel
 *     was wasting bandwidth that the welcome video and home loop video
 *     needed.
 *   - Fallback: if "homevideo:enter-cue" never fires (e.g., the dev
 *     ?devq=N quick-jump skips HomeIntroVideo entirely), Tier 2 starts
 *     after a 15s safety timer.
 */
export function preloadAllAudioAssets(): void {
  if (typeof window === "undefined") return;
  if (preloadStarted) return;
  preloadStarted = true;

  // Tier 1: eager. Critical SFX needed in first 30 seconds.
  for (const url of TIER_1_CRITICAL_AUDIO) warmOne(url);

  // Tier 2: gated on the home video signaling its hero beat is done.
  let tier2Started = false;
  // window.setTimeout returns number (DOM lib). The Node global setTimeout
  // returns NodeJS.Timeout — these conflict in a Next.js TS project, so we
  // pin to number explicitly to match window.setTimeout / window.clearTimeout.
  let tier2Fallback: number | undefined;
  const startTier2 = () => {
    if (tier2Started) return;
    tier2Started = true;
    window.removeEventListener("homevideo:enter-cue", startTier2);
    if (tier2Fallback !== undefined) window.clearTimeout(tier2Fallback);

    // Stagger in batches of 2 with a 4s gap. q1+q2 fire at t=0, q3+q4 at
    // t=4s, etc. Maximum 2 concurrent question-VO downloads so the home
    // loop video and any user-triggered audio cues stay smooth.
    const STAGGER_MS = 4000;
    for (let i = 0; i < TIER_2_QUESTION_VOS.length; i += 2) {
      window.setTimeout(() => {
        const batch = TIER_2_QUESTION_VOS.slice(i, i + 2);
        for (const url of batch) warmOne(url);
      }, (i / 2) * STAGGER_MS);
    }
  };

  window.addEventListener("homevideo:enter-cue", startTier2, { once: true });
  // Safety net for non-standard entry paths (e.g., ?devq=N skips home video).
  tier2Fallback = window.setTimeout(startTier2, 15000);
}
