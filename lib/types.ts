export type Verdict = "Low risk" | "Moderate risk" | "High risk" | "Very high risk";

export type BiasSeverity = "low" | "medium" | "high";

export interface BreakdownDimension {
  label:
    | "Emotional reactivity"
    | "Irreversibility"
    | "Social pressure"
    | "Information gap"
    | "Time pressure";
  value: number;
}

export interface AnalysisResult {
  score: number;
  verdict: Verdict;
  biases: string[];
  biases_severity: BiasSeverity[];
  biases_explanation: string[];
  breakdown: BreakdownDimension[];
  future_voice: string;
  hidden_question: string;
  mitigations: string[];
}

export interface AnalysisRecord {
  id: string;
  user_id: string | null;
  decision_text: string;
  result: AnalysisResult;
  score: number;
  verdict: Verdict;
  share_token: string;
  created_at: string;
}

export const BREAKDOWN_LABELS: BreakdownDimension["label"][] = [
  "Emotional reactivity",
  "Irreversibility",
  "Social pressure",
  "Information gap",
  "Time pressure"
];

const verdictByScore = (score: number): Verdict => {
  if (score <= 39) return "Low risk";
  if (score <= 69) return "Moderate risk";
  if (score <= 84) return "High risk";
  return "Very high risk";
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const asSeverityArray = (value: unknown): BiasSeverity[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => {
      if (item === "low" || item === "medium" || item === "high") return item;
      return "medium";
    });
};

const parseBreakdown = (value: unknown): BreakdownDimension[] => {
  if (!Array.isArray(value)) {
    return BREAKDOWN_LABELS.map((label) => ({ label, value: 0 }));
  }

  const byLabel = new Map<string, number>();

  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const label = (item as { label?: unknown }).label;
    const metric = (item as { value?: unknown }).value;
    if (typeof label !== "string" || typeof metric !== "number") return;
    byLabel.set(label, clamp(Math.round(metric), 0, 100));
  });

  return BREAKDOWN_LABELS.map((label) => ({ label, value: byLabel.get(label) ?? 0 }));
};

export const normalizeAnalysis = (candidate: unknown): AnalysisResult | null => {
  if (!candidate || typeof candidate !== "object") return null;

  const source = candidate as Record<string, unknown>;

  const scoreRaw = source.score;
  const score = typeof scoreRaw === "number" ? clamp(Math.round(scoreRaw), 0, 100) : NaN;
  if (Number.isNaN(score)) return null;

  const verdictRaw = source.verdict;
  const verdict: Verdict =
    verdictRaw === "Low risk" ||
    verdictRaw === "Moderate risk" ||
    verdictRaw === "High risk" ||
    verdictRaw === "Very high risk"
      ? verdictRaw
      : verdictByScore(score);

  const biases = asStringArray(source.biases).slice(0, 4);
  const biasesSeverity = asSeverityArray(source.biases_severity).slice(0, 4);
  const biasesExplanation = asStringArray(source.biases_explanation).slice(0, 4);

  while (biasesSeverity.length < biases.length) biasesSeverity.push("medium");
  while (biasesExplanation.length < biases.length) biasesExplanation.push("Explanation unavailable.");

  const futureVoice = typeof source.future_voice === "string" ? source.future_voice.trim() : "";
  const hiddenQuestion = typeof source.hidden_question === "string" ? source.hidden_question.trim() : "";
  const mitigations = asStringArray(source.mitigations).slice(0, 3);

  if (!futureVoice || !hiddenQuestion || mitigations.length === 0) return null;

  return {
    score,
    verdict,
    biases,
    biases_severity: biasesSeverity,
    biases_explanation: biasesExplanation,
    breakdown: parseBreakdown(source.breakdown),
    future_voice: futureVoice,
    hidden_question: hiddenQuestion,
    mitigations
  };
};
