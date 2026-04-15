"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNarration } from "./NarrationProvider";
import MuteButton from "./MuteButton";
import HostSilhouette from "./HostSilhouette";
import { useParallax } from "./useParallax";

interface UserDetailsModalProps {
  onSubmit: (data: { name: string; phone: string; email: string }) => void;
}

// Phonetically tuned for ElevenLabs multilingual — short, clean sentences
const DETAILS_NARRATION =
  "Game shuroo karne se pehle, apne baare mein thodi si jaankaari dijiye. " +
  "Neeche form mein apna naam, phone number, aur email bhar dijiye. " +
  "Sirf ek chhoti si formality, phir asli game shuroo karte hain.";

export default function UserDetailsModal({ onSubmit }: UserDetailsModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { narrate, stop } = useNarration();

  // Auto-narrate when this modal mounts (after welcome video ends)
  useEffect(() => {
    narrate("details-intro", DETAILS_NARRATION);
    return () => stop();
  }, [narrate, stop]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !phone.trim() || !email.trim()) return;
    onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim() });
  };

  const fields = [
    { id: "name", label: "Your name", type: "text", value: name, setter: setName, placeholder: "Full name", delay: 0.12 },
    { id: "phone", label: "Phone", type: "tel", value: phone, setter: setPhone, placeholder: "+91 · · · · · · · · · ·", delay: 0.18 },
    { id: "email", label: "Email", type: "email", value: email, setter: setEmail, placeholder: "you@example.com", delay: 0.24 },
  ];

  const isValid = name.trim() && phone.trim() && email.trim();

  const parallax = useParallax();

  return (
    <div className="w-full max-w-md mx-4 relative max-h-[90vh] flex flex-col">
      <MuteButton />

      {/* Ambient host silhouette at the right edge of the stage */}
      <HostSilhouette side="right" opacity={0.16} />

      {/* Atmospheric parallax halo behind the card */}
      <div
        className="absolute -inset-20 bg-brass/[0.05] rounded-[3rem] blur-[90px] pointer-events-none"
        style={{
          transform: `translate(${parallax.x * 10}px, ${parallax.y * 8}px)`,
          transition: "transform 0.05s linear",
        }}
      />
      <div className="absolute -inset-12 bg-brass/[0.04] rounded-[2rem] blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl border-2 border-brass/25 bg-gradient-to-b from-surface-light/90 to-surface/95 shadow-[0_40px_100px_-24px_rgba(0,0,0,0.75),0_0_60px_-10px_rgba(196,160,53,0.12)] overflow-hidden backdrop-blur-sm">
        <div className="absolute inset-0 opacity-[0.018] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-brass-bright/70 to-transparent shadow-[0_0_20px_rgba(228,207,106,0.35)]" />

        <div className="relative p-8 md:p-10">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="mb-9"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-brass-dim mb-4">Registration</p>
            <h2 className="font-display text-3xl md:text-[2rem] font-semibold tracking-[-0.02em] text-foreground leading-tight">
              Enter the club
            </h2>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              One short form — then the floor is yours.
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {fields.map((field) => (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: field.delay, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              >
                <label
                  htmlFor={field.id}
                  className={`block text-[11px] font-semibold uppercase tracking-[0.12em] mb-2 transition-colors duration-200 ${
                    focusedField === field.id ? "text-brass-bright" : "text-muted"
                  }`}
                >
                  {field.label}
                </label>
                <div className="relative rounded-xl">
                  {focusedField === field.id && (
                    <motion.div
                      className="absolute -inset-px rounded-xl bg-brass/10 ring-1 ring-brass/25"
                      layoutId="input-focus"
                      transition={{ type: "spring", duration: 0.38, bounce: 0.12 }}
                    />
                  )}
                  <input
                    id={field.id}
                    type={field.type}
                    value={field.value}
                    onChange={(e) => field.setter(e.target.value)}
                    onFocus={() => setFocusedField(field.id)}
                    onBlur={() => setFocusedField(null)}
                    placeholder={field.placeholder}
                    className="relative w-full px-4 py-3.5 rounded-xl bg-black/25 border border-white/[0.06] text-foreground placeholder:text-muted/50 text-[15px] outline-none transition-colors duration-200 focus:border-brass/20 focus:bg-black/35"
                  />
                </div>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              className="pt-2"
            >
              {isValid ? (
                <motion.button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSubmit();
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="game-show-btn relative z-0 w-full cursor-pointer rounded-xl bg-brass py-4 text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-[#14110a] transition-colors hover:bg-brass-bright"
                >
                  <span className="relative z-10">Continue</span>
                </motion.button>
              ) : (
                <div className="w-full py-4 rounded-xl bg-white/[0.04] border-2 border-white/[0.14] text-center cursor-not-allowed">
                  <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-muted/55">Continue</span>
                </div>
              )}
            </motion.div>
          </form>
        </div>
      </div>
    </div>
  );
}
