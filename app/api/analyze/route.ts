import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  getActiveAiProvider,
  LlmApiError,
  LlmRateLimitError,
  streamForecastJsonTokens
} from "@/lib/claude";
import { parseTopLevelJsonProgress } from "@/lib/streaming-json";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { normalizeAnalysis } from "@/lib/types";

export const runtime = "nodejs";

type AnalyzePayload = {
  decisionText?: string;
};

const MAX_ATTEMPTS = 2;

const parseBearerToken = (header: string | null): string | null => {
  if (!header || !header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
};

export async function POST(request: NextRequest) {
  let payload: AnalyzePayload;

  try {
    payload = (await request.json()) as AnalyzePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const decisionText = payload.decisionText?.trim() ?? "";
  if (decisionText.length < 40) {
    return NextResponse.json(
      { error: "Please provide at least 40 characters for a reliable forecast." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  const token = parseBearerToken(request.headers.get("authorization"));

  let userId: string | null = null;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error) {
      userId = data.user?.id ?? null;
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (payloadObject: object) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payloadObject)}\n`));
      };

      const close = () => {
        controller.close();
      };

      void (async () => {
        send({ type: "start", provider: getActiveAiProvider() });

        let finalAnalysis: ReturnType<typeof normalizeAnalysis> = null;
        let lastError = "Unknown model parsing error";

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
          if (attempt > 1) {
            send({
              type: "retry",
              message: "Received malformed model JSON. Retrying once automatically."
            });
          }

          let rawModelText = "";
          let partialObject: Record<string, unknown> = {};
          const seenKeys = new Set<string>();

          try {
            for await (const tokenChunk of streamForecastJsonTokens(decisionText)) {
              rawModelText += tokenChunk;

              const { updates } = parseTopLevelJsonProgress(rawModelText, seenKeys);
              if (Object.keys(updates).length > 0) {
                partialObject = { ...partialObject, ...updates };
                send({
                  type: "partial",
                  data: partialObject,
                  received: Object.keys(updates)
                });
              }
            }

            const { completeObject } = parseTopLevelJsonProgress(rawModelText, new Set<string>());
            const normalized = normalizeAnalysis(completeObject);

            if (!normalized) {
              throw new Error("Model response was not valid JSON matching schema");
            }

            finalAnalysis = normalized;
            break;
          } catch (error) {
            if (error instanceof LlmRateLimitError) {
              send({
                type: "error",
                code: "rate_limited",
                waitSeconds: error.waitSeconds,
                message: `Rate limited by ${error.provider}. Try again in about ${error.waitSeconds} seconds.`
              });
              close();
              return;
            }

            if (error instanceof LlmApiError) {
              lastError = error.message;
            } else if (error instanceof Error) {
              lastError = error.message;
            }

            if (attempt === MAX_ATTEMPTS) {
              const lowerError = lastError.toLowerCase();
              const providerUnavailable =
                lowerError.includes("fetch failed") ||
                lowerError.includes("ecconnrefused") ||
                lowerError.includes("network") ||
                lowerError.includes("enotfound");

              send({
                type: "error",
                code: providerUnavailable ? "provider_unavailable" : "invalid_json",
                message: providerUnavailable
                  ? "Could not reach the AI provider. If using Ollama, ensure the Ollama server is running."
                  : "We could not parse a valid forecast JSON from the model after one retry. Please try again.",
                details: lastError
              });
              close();
              return;
            }
          }
        }

        if (!finalAnalysis) {
          send({
            type: "error",
            code: "unknown",
            message: "Forecast failed unexpectedly. Please retry.",
            details: lastError
          });
          close();
          return;
        }

        const shareToken = randomUUID().replace(/-/g, "");

        const { data: savedRow, error: saveError } = await supabase
          .from("analyses")
          .insert({
            user_id: userId,
            decision_text: decisionText,
            result: finalAnalysis,
            score: finalAnalysis.score,
            verdict: finalAnalysis.verdict,
            share_token: shareToken
          })
          .select("id, share_token, created_at")
          .single();

        if (saveError || !savedRow) {
          send({
            type: "error",
            code: "db_error",
            message: "Analysis generated, but saving failed. Please retry once.",
            details: saveError?.message ?? "Unknown Supabase insert error"
          });
          close();
          return;
        }

        send({
          type: "complete",
          data: finalAnalysis,
          id: savedRow.id,
          shareToken: savedRow.share_token,
          createdAt: savedRow.created_at
        });

        close();
      })().catch((error) => {
        send({
          type: "error",
          code: "fatal",
          message: "Unexpected server failure.",
          details: error instanceof Error ? error.message : "Unknown error"
        });
        close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive"
    }
  });
}
