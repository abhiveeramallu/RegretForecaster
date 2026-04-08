"use client";

import { motion } from "framer-motion";

import type { BreakdownDimension } from "@/lib/types";

interface BreakdownMetersProps {
  breakdown: BreakdownDimension[];
}

const colorForValue = (value: number) => {
  if (value <= 39) return "#3FB950";
  if (value <= 69) return "#F0A500";
  return "#E5534B";
};

export default function BreakdownMeters({ breakdown }: BreakdownMetersProps) {
  return (
    <div className="space-y-4">
      {breakdown.map((metric, index) => (
        <div key={metric.label} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-primary">{metric.label}</span>
            <span className="text-text-muted">{metric.value}</span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-surface">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: colorForValue(metric.value) }}
              initial={{ width: 0, x: -16 }}
              animate={{ width: `${metric.value}%`, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
