"use client";

import { motion } from "framer-motion";

interface ScoreRingProps {
  score: number;
  verdict: string;
  size?: number;
}

const colorByScore = (score: number) => {
  if (score <= 39) return "#3FB950";
  if (score <= 69) return "#F0A500";
  return "#E5534B";
};

export default function ScoreRing({ score, verdict, size = 220 }: ScoreRingProps) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.max(0, Math.min(score, 100));
  const color = colorByScore(normalizedScore);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#2A2A2A"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{ strokeDashoffset: circumference * (1 - normalizedScore / 100) }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-semibold"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {normalizedScore}
          </motion.span>
          <span className="text-xs uppercase tracking-[0.2em] text-text-muted">Risk Score</span>
        </div>
      </div>

      <span className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-text-primary">
        {verdict}
      </span>
    </div>
  );
}
