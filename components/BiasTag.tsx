"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import type { BiasSeverity } from "@/lib/types";

interface BiasTagProps {
  label: string;
  severity: BiasSeverity;
  explanation: string;
}

const stylesBySeverity: Record<BiasSeverity, string> = {
  low: "border-zinc-600 bg-zinc-800/50 text-zinc-200",
  medium: "border-accent-amber/50 bg-accent-amber/15 text-accent-amber",
  high: "border-accent-red/50 bg-accent-red/15 text-accent-red"
};

export default function BiasTag({ label, severity, explanation }: BiasTagProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className={`rounded-full border px-3 py-1.5 text-sm ${stylesBySeverity[severity]}`}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute left-0 top-[calc(100%+10px)] z-20 w-64 rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-text-muted shadow-ringSoft"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
          >
            {explanation}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
