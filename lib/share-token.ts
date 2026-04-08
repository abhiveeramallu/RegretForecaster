import type { AnalysisResult } from "@/lib/types";
import { normalizeAnalysis } from "@/lib/types";

export const LOCAL_SHARE_PREFIX = "local_";

export interface LocalSharePayload {
  decisionText: string;
  result: AnalysisResult;
  createdAt: string;
}

export const encodeLocalSharePayload = (payload: LocalSharePayload) => {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json, "utf8").toString("base64url");
  return `${LOCAL_SHARE_PREFIX}${encoded}`;
};

export const decodeLocalSharePayload = (token: string): LocalSharePayload | null => {
  if (!token.startsWith(LOCAL_SHARE_PREFIX)) return null;

  const encoded = token.slice(LOCAL_SHARE_PREFIX.length);
  if (!encoded) return null;

  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as {
      decisionText?: unknown;
      result?: unknown;
      createdAt?: unknown;
    };

    if (typeof parsed.decisionText !== "string") return null;
    if (typeof parsed.createdAt !== "string") return null;

    const normalized = normalizeAnalysis(parsed.result);
    if (!normalized) return null;

    return {
      decisionText: parsed.decisionText,
      createdAt: parsed.createdAt,
      result: normalized
    };
  } catch {
    return null;
  }
};
