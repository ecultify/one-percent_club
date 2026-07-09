/**
 * Subtle "Powered by eCultify" credit pinned to the bottom of every page.
 *
 * Deliberately understated so it never competes with the game: tiny, light
 * (not bold), low-opacity white, at the very bottom edge. The wrapper is
 * pointer-events-none so it can never intercept a tap meant for the game —
 * only the eCultify link re-enables pointer events so it stays clickable.
 */
export default function PoweredByFooter() {
  return (
    <footer
      aria-label="Powered by eCultify"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)" }}
    >
      <p className="select-none text-[10px] font-normal leading-none tracking-[0.08em] text-white/30">
        Powered by{" "}
        <a
          href="https://ecultify.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto text-white/45 underline-offset-2 transition-colors hover:text-white/70 hover:underline"
        >
          eCultify
        </a>
      </p>
    </footer>
  );
}
