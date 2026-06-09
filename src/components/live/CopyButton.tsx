"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Copy-to-clipboard button whose leading icon eases from Copy → Check (and
 * the label to "Copied") for ~1.5s after a click, then reverts.
 */
interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  value: string;
  label: string;
}

export function CopyButton({ value, label, ...buttonProps }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onCopy = () => {
    try {
      void navigator.clipboard?.writeText(value);
    } catch {
      /* ignore */
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button {...buttonProps} onClick={onCopy} title={value}>
      <span className="relative inline-flex size-3.5 items-center justify-center">
        <AnimatePresence initial={false} mode="wait">
          {copied ? (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Check className="size-3.5" />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Copy className="size-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {copied ? "Copied" : label}
    </Button>
  );
}
