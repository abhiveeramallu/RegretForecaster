"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import BiasTag from "@/components/BiasTag";
import BreakdownMeters from "@/components/BreakdownMeters";
import FutureVoice from "@/components/FutureVoice";
import HiddenQuestion from "@/components/HiddenQuestion";
import MitigationList from "@/components/MitigationList";
import ScoreRing from "@/components/ScoreRing";
import ShareButton from "@/components/ShareButton";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { AnalysisResult, BreakdownDimension, BiasSeverity } from "@/lib/types";
import { normalizeAnalysis } from "@/lib/types";

type StreamEvent =
  | { type: "start" }
  | { type: "partial"; data: Partial<AnalysisResult> }
  | { type: "retry"; message: string }
  | { type: "complete"; data: AnalysisResult; shareToken: string }
  | { type: "error"; code: string; message: string; waitSeconds?: number };

interface AnalyzeClientProps {
  recordId: string | null;
}

const WaveThinking = () => (
  <div className="flex items-end gap-1 rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted">
    <span>Thinking...</span>
    <div className="ml-2 flex h-4 items-end gap-1">
      {[0, 1, 2, 3, 4].map((index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-accent-purple/80"
          style={{
            height: `${10 + (index % 2) * 6}px`,
            animation: "waveform 1.2s ease-in-out infinite",
            animationDelay: `${index * 0.1}s`
          }}
        />
      ))}
    </div>
  </div>
);

const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-xl bg-surface ${className}`} />
);

export default function AnalyzeClient({ recordId }: AnalyzeClientProps) {
  const router = useRouter();
  const hasStartedRef = useRef(false);

  const [decisionText, setDecisionText] = useState("");
  const [analysis, setAnalysis] = useState<Partial<AnalysisResult>>({});
  const [shareToken, setShareToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [retryNotice, setRetryNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const start = async () => {
      setLoading(true);
      setError("");
      setRetryNotice("");

      const supabase = getSupabaseBrowserClient();

      if (recordId) {
        const { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData.session) {
          setError("Sign in to reopen private analyses from history.");
          setLoading(false);
          return;
        }

        const { data, error: loadError } = await supabase
          .from("analyses")
          .select("decision_text, result, share_token")
          .eq("id", recordId)
          .single();

        if (loadError || !data) {
          setError("Could not load this analysis.");
          setLoading(false);
          return;
        }

        const normalized = normalizeAnalysis(data.result);
        if (!normalized) {
          setError("Stored analysis format is invalid.");
          setLoading(false);
          return;
        }

        setDecisionText(data.decision_text);
        setAnalysis(normalized);
        setShareToken(data.share_token);
        setLoading(false);
        return;
      }

      const draft = sessionStorage.getItem("rf:decision:draft")?.trim() ?? "";
      if (draft.length < 40) {
        setError("No valid decision draft found. Go back and describe your decision first.");
        setLoading(false);
        return;
      }

      setDecisionText(draft);

      const { data: sessionData } = await supabase.auth.getSession();
      const headers: HeadersInit = {
        "content-type": "application/json"
      };

      if (sessionData.session?.access_token) {
        headers.authorization = `Bearer ${sessionData.session.access_token}`;
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({ decisionText: draft })
      });

      if (!response.ok || !response.body) {
        let apiMessage = "Could not start analysis.";

        try {
          const json = (await response.json()) as { error?: string };
          if (json.error) apiMessage = json.error;
        } catch {
          // no-op
        }

        setError(apiMessage);
        setLoading(false);
        return;
      }

      setThinking(true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let doneTerminally = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newLineIndex = buffer.indexOf("\n");
        while (newLineIndex !== -1) {
          const line = buffer.slice(0, newLineIndex).trim();
          buffer = buffer.slice(newLineIndex + 1);

          if (line) {
            try {
              const event = JSON.parse(line) as StreamEvent;

              if (event.type === "partial") {
                setAnalysis((current) => ({ ...current, ...event.data }));
              }

              if (event.type === "retry") {
                setRetryNotice(event.message);
                setAnalysis({});
              }

              if (event.type === "error") {
                doneTerminally = true;
                if (event.code === "rate_limited" && event.waitSeconds) {
                  setError(`Rate limited. Please retry in about ${event.waitSeconds} seconds.`);
                } else {
                  setError(event.message);
                }
                setThinking(false);
                setLoading(false);
                await reader.cancel();
                break;
              }

              if (event.type === "complete") {
                doneTerminally = true;
                setAnalysis(event.data);
                setShareToken(event.shareToken);
                setThinking(false);
                setLoading(false);
                await reader.cancel();
                break;
              }
            } catch {
              // ignore malformed event line
            }
          }

          newLineIndex = buffer.indexOf("\n");
        }

        if (doneTerminally) break;
      }

      if (!doneTerminally) {
        setThinking(false);
        setLoading(false);
        setError("Analysis stream ended unexpectedly. Please run it again.");
      }
    };

    void start();
  }, [recordId]);

  const score = typeof analysis.score === "number" ? analysis.score : null;
  const verdict = typeof analysis.verdict === "string" ? analysis.verdict : null;

  const biases = Array.isArray(analysis.biases) ? analysis.biases : [];
  const biasSeverity = Array.isArray(analysis.biases_severity)
    ? (analysis.biases_severity as BiasSeverity[])
    : [];
  const biasExplanation = Array.isArray(analysis.biases_explanation)
    ? analysis.biases_explanation
    : [];

  const breakdown = Array.isArray(analysis.breakdown)
    ? (analysis.breakdown as BreakdownDimension[])
    : [];

  const futureVoice = typeof analysis.future_voice === "string" ? analysis.future_voice : "";
  const hiddenQuestion = typeof analysis.hidden_question === "string" ? analysis.hidden_question : "";
  const mitigations = Array.isArray(analysis.mitigations) ? analysis.mitigations : [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted transition hover:text-text-primary"
        >
          ← New forecast
        </button>

        <Link
          href="/history"
          className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted transition hover:text-text-primary"
        >
          History dashboard
        </Link>
      </div>

      <motion.section
        className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-text-muted">Decision Input</p>
        <p className="text-sm leading-relaxed text-text-primary sm:text-base">
          {decisionText || "Waiting for input..."}
        </p>
      </motion.section>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {thinking && <WaveThinking />}
        {retryNotice && <p className="text-xs text-accent-amber">{retryNotice}</p>}
        {error && <p className="text-sm text-accent-red">{error}</p>}
      </div>

      <div className="space-y-5">
        <motion.section
          className="rounded-2xl border border-border bg-card p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">Regret Risk Score</p>
          {score !== null && verdict ? (
            <ScoreRing score={score} verdict={verdict} />
          ) : (
            <div className="flex justify-center">
              <Skeleton className="h-56 w-56 rounded-full" />
            </div>
          )}
        </motion.section>

        <motion.section
          className="rounded-2xl border border-border bg-card p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">Cognitive Bias Detector</p>
          {biases.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {biases.map((bias, index) => (
                <BiasTag
                  key={`${bias}-${index}`}
                  label={bias}
                  severity={biasSeverity[index] ?? "medium"}
                  explanation={biasExplanation[index] ?? "Explanation unavailable."}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-8 w-52" />
            </div>
          )}
        </motion.section>

        <motion.section
          className="rounded-2xl border border-border bg-card p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">Regret Risk Breakdown</p>
          {breakdown.length === 5 ? (
            <BreakdownMeters breakdown={breakdown} />
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-6 w-full" />
              ))}
            </div>
          )}
        </motion.section>

        <motion.section
          className="rounded-2xl border border-border bg-card p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">Your Future Self Speaks</p>
          {futureVoice ? <FutureVoice text={futureVoice} /> : <Skeleton className="h-36 w-full" />}
        </motion.section>

        <motion.section
          className="rounded-2xl border border-border bg-card p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          {hiddenQuestion ? (
            <HiddenQuestion question={hiddenQuestion} />
          ) : (
            <>
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">
                The Question You Haven&apos;t Asked
              </p>
              <Skeleton className="h-20 w-full" />
            </>
          )}
        </motion.section>

        <motion.section
          className="rounded-2xl border border-border bg-card p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          {mitigations.length > 0 ? (
            <MitigationList items={mitigations} />
          ) : (
            <>
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">
                What Would Reduce Your Regret Risk
              </p>
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-[90%]" />
                <Skeleton className="h-8 w-[84%]" />
              </div>
            </>
          )}
        </motion.section>
      </div>

      {shareToken && !loading && !error && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-text-muted">Share this analysis</p>
          <ShareButton shareToken={shareToken} />
        </div>
      )}
    </main>
  );
}
