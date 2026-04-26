"use client";

/**
 * PotRevealScreen — DEPRECATED.
 *
 * This component was a short-lived experiment to render the pot animation
 * on its own dedicated screen between the elimination reveal and the next
 * question. The decision was reverted: the pot now lives inside the
 * elimination card itself (see EliminationReveal.tsx).
 *
 * The file remains as an orphan stub so any stale imports during a clean
 * build don't fail. It is not referenced from anywhere in the app.
 *
 * Safe to delete this file when you next clean up the components folder.
 */

export default function PotRevealScreen(): null {
  return null;
}
