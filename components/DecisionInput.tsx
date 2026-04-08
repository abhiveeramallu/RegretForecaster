"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const MIN_CHARS = 40;

const EXAMPLES = [
  "I had a fallout with my closest friend and I want to send one final message ending the friendship for good.",
  "I got an offer to move abroad, but my parents depend on me here and I don't know if I'll regret choosing either side.",
  "I am in my final year and I want to drop out to build my startup full-time before this idea window closes.",
  "I've been delaying a hard conversation with my partner because I'm afraid of hurting them and changing everything."
];

export default function DecisionInput() {
  const router = useRouter();
  const [decisionText, setDecisionText] = useState("");

  const charCount = decisionText.trim().length;
  const canForecast = charCount >= MIN_CHARS;

  const charsLeft = useMemo(() => Math.max(0, MIN_CHARS - charCount), [charCount]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canForecast) return;

    sessionStorage.setItem("rf:decision:draft", decisionText.trim());
    router.push("/analyze");
  };

  return (
    <motion.form
      className="mx-auto flex w-full max-w-5xl flex-col gap-6"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Regret Forecaster</h1>
        <p className="max-w-2xl text-sm text-text-muted sm:text-base">
          Forecast how your future self is likely to feel before you commit.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card/80 p-4 shadow-ringSoft sm:p-6">
        <textarea
          className="min-h-[45vh] w-full resize-none rounded-2xl border border-border bg-surface p-5 text-base leading-relaxed text-text-primary outline-none transition focus:border-accent-purple sm:min-h-[52vh] sm:text-lg"
          placeholder="Describe a decision you're facing — the more honest you are, the more accurate the forecast."
          value={decisionText}
          onChange={(event) => setDecisionText(event.target.value)}
        />

        <div className="mt-4 flex items-center justify-between text-xs sm:text-sm">
          <span className={canForecast ? "text-accent-green" : "text-text-muted"}>
            {canForecast ? `Ready to forecast (${charCount} chars)` : `${charsLeft} more characters to unlock analysis`}
          </span>
          <span className="text-text-muted">{charCount} chars</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm text-text-muted transition hover:border-accent-purple hover:text-text-primary"
            onClick={() => setDecisionText(example)}
          >
            {example}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canForecast}
          className="rounded-full border border-accent-purple bg-accent-purple/20 px-6 py-3 text-sm font-medium transition hover:bg-accent-purple/30 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-text-muted"
        >
          Forecast my regret →
        </button>
      </div>
    </motion.form>
  );
}
