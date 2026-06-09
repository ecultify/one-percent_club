"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { METALLIC_RIM_GRADIENT, PANEL_INNER_FILL } from "./QuestionScreen";

/**
 * App-styled replacement for the browser's native confirm() dialog. Provides
 * a promise-based useConfirm() hook so call sites read almost the same:
 *
 *   if (await confirm({ title: "End quiz?", message: "…", danger: true })) { … }
 *
 * The provider lives in the root layout, so any client component can use it.
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling for destructive actions (end / remove / kick). */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpts(options);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpts(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {opts && (
          <motion.div
            key="confirm-backdrop"
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => settle(false)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: EASE }}
              className="relative w-full max-w-sm overflow-hidden rounded-2xl p-[2.5px] shadow-[0_36px_90px_-28px_rgba(0,0,0,0.75)]"
              style={{ background: METALLIC_RIM_GRADIENT }}
            >
              <div className="relative overflow-hidden rounded-[13px] px-7 py-7" style={PANEL_INNER_FILL}>
                <h2 className="font-display text-lg font-semibold text-foreground">{opts.title}</h2>
                {opts.message && (
                  <p className="mt-2 text-sm leading-relaxed text-foreground/65">{opts.message}</p>
                )}
                <div className="mt-7 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => settle(false)}
                    className="rounded-xl border border-brass/25 bg-black/40 px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-foreground/70 transition-colors hover:border-brass/45 hover:text-foreground"
                  >
                    {opts.cancelLabel || "Cancel"}
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => settle(true)}
                    className={
                      opts.danger
                        ? "rounded-xl px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-red-50 bg-red-600/90 hover:bg-red-600 transition-colors border border-red-400/40"
                        : "game-show-btn relative z-0 rounded-xl px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#14110a]"
                    }
                  >
                    <span className="relative z-10">{opts.confirmLabel || "Confirm"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
