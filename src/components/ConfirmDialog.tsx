"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * App-styled (shadcn) replacement for the browser's native confirm().
 *
 *   if (await confirm({ title: "End quiz?", danger: true })) { … }
 *
 * Pass `action` to run an async task on confirm — the button shows a spinner
 * and the dialog stays open until it resolves (e.g. deleting a lobby).
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling for destructive actions (end / remove / kick). */
  danger?: boolean;
  /** Optional async work; dialog keeps a spinner until it resolves. */
  action?: () => Promise<unknown> | unknown;
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
  const [busy, setBusy] = useState(false);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpts(options);
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setBusy(false);
    setOpts(null);
  }, []);

  const onConfirm = useCallback(async () => {
    if (!opts) return;
    if (opts.action) {
      setBusy(true);
      try {
        await opts.action();
      } catch {
        /* surfaced by the caller; close regardless */
      } finally {
        close(true);
      }
    } else {
      close(true);
    }
  }, [opts, close]);

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
            transition={{ duration: 0.18 }}
            onClick={() => !busy && close(false)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-950 p-6 shadow-2xl"
            >
              <h2 className="text-base font-semibold text-white">{opts.title}</h2>
              {opts.message && <p className="mt-2 text-sm leading-relaxed text-white/60">{opts.message}</p>}
              <div className="mt-6 flex justify-end gap-2.5">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => close(false)}>
                  {opts.cancelLabel || "Cancel"}
                </Button>
                <Button
                  variant={opts.danger ? "destructive" : "gold"}
                  size="sm"
                  disabled={busy}
                  onClick={onConfirm}
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {busy ? "Working…" : opts.confirmLabel || "Confirm"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
