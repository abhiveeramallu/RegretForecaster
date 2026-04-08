"use client";

import { motion } from "framer-motion";

import type { AnalysisRecord } from "@/lib/types";

interface HistoryCardProps {
  record: AnalysisRecord;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
}

const badgeStyleByVerdict: Record<AnalysisRecord["verdict"], string> = {
  "Low risk": "border-accent-green/40 text-accent-green",
  "Moderate risk": "border-accent-amber/40 text-accent-amber",
  "High risk": "border-accent-red/40 text-accent-red",
  "Very high risk": "border-accent-red/60 text-accent-red"
};

export default function HistoryCard({ record, selected, onToggleSelect, onOpen }: HistoryCardProps) {
  const createdAt = new Date(record.created_at).toLocaleString();
  const snippet =
    record.decision_text.length > 140
      ? `${record.decision_text.slice(0, 140).trimEnd()}...`
      : record.decision_text;

  return (
    <motion.article
      layout
      className={`rounded-2xl border bg-card p-5 transition ${
        selected ? "border-accent-purple shadow-ringSoft" : "border-border"
      }`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <time className="text-xs text-text-muted">{createdAt}</time>
        <span className={`rounded-full border px-2.5 py-1 text-xs ${badgeStyleByVerdict[record.verdict]}`}>
          {record.score} · {record.verdict}
        </span>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-text-primary">{snippet}</p>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted transition hover:text-text-primary"
          onClick={() => onToggleSelect(record.id)}
        >
          {selected ? "Unselect" : "Select to compare"}
        </button>

        <button
          type="button"
          className="rounded-lg border border-accent-purple/50 bg-accent-purple/10 px-3 py-2 text-xs text-text-primary transition hover:bg-accent-purple/20"
          onClick={() => onOpen(record.id)}
        >
          Re-open analysis
        </button>
      </div>
    </motion.article>
  );
}
