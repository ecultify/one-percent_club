"use client";

import { motion } from "framer-motion";
import { useState, useEffect, type FormEvent } from "react";
import { useNarration } from "./NarrationProvider";
import MuteButton from "./MuteButton";
import { METALLIC_RIM_GRADIENT, PANEL_INNER_FILL } from "./QuestionScreen";

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

  const handleSubmit = (e?: FormEvent) => {
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

  return (
    <div className="w-full max-w-md mx-4 relative max-h-[90vh] flex flex-col">
      <MuteButton />

      <div
        className="relative overflow-hidden rounded-2xl p-[2.5px] shadow-[0_36px_90px_-28px_rgba(0,0,0,0.72),0_0_28px_-4px_rgba(228,207,106,0.22)]"
        style={{ background: METALLIC_RIM_GRADIENT }}
      >
        <div
          className="relative overflow-hidden rounded-[13px] backdrop-blur-sm"
          style={PANEL_INNER_FILL}
        >
          <div className="absolute top-2 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-brass-bright/35 to-transparent pointer-events-none" />
          <div className="absolute bottom-2 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-brass/32 to-transparent pointer-events-none" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass-dim/25 to-transparent pointer-events-none" />

        <div className="relative p-8 md:p-10">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="mb-9"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-brass-dim/90 mb-4">Registration</p>
            <h2 className="font-display text-3xl md:text-[2rem] font-semibold tracking-[-0.02em] text-foreground leading-tight drop-shadow-[0_1px_12px_rgba(0,0,0,0.75)]">
              Enter the club
            </h2>
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
                      className="absolute -inset-px rounded-xl bg-brass/15 ring-1 ring-brass/40"
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
                    className="relative w-full px-4 py-3.5 rounded-xl bg-black/45 border border-brass/25 text-foreground placeholder:text-muted/70 text-[15px] outline-none transition-colors duration-200 focus:border-brass/40 focus:bg-black/55 focus:ring-1 focus:ring-brass/25"
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
                <div className="w-full py-4 rounded-xl bg-black/25 border-2 border-brass/15 text-center cursor-not-allowed">
                  <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-muted/45">Continue</span>
                </div>
              )}
            </motion.div>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
