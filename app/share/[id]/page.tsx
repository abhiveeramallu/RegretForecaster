import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import BreakdownMeters from "@/components/BreakdownMeters";
import FutureVoice from "@/components/FutureVoice";
import HiddenQuestion from "@/components/HiddenQuestion";
import MitigationList from "@/components/MitigationList";
import ScoreRing from "@/components/ScoreRing";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { AnalysisResult } from "@/lib/types";
import { normalizeAnalysis } from "@/lib/types";

interface PageProps {
  params: {
    id: string;
  };
}

const loadSharedAnalysis = async (token: string) => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("decision_text, result, score, verdict, created_at")
    .eq("share_token", token)
    .single();

  if (error || !data) return null;

  const normalized = normalizeAnalysis(data.result) as AnalysisResult | null;
  if (!normalized) return null;

  return {
    decisionText: data.decision_text,
    score: data.score,
    verdict: data.verdict,
    createdAt: data.created_at,
    result: normalized
  };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const token = params.id;

  return {
    title: "Shared Regret Forecast",
    description: "Read-only regret forecast analysis",
    openGraph: {
      title: "Regret Forecaster",
      description: "Shared regret forecast",
      images: appUrl ? [`${appUrl}/share/${token}/opengraph-image`] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title: "Regret Forecaster",
      description: "Shared regret forecast",
      images: appUrl ? [`${appUrl}/share/${token}/opengraph-image`] : undefined
    }
  };
}

export default async function SharePage({ params }: PageProps) {
  const shared = await loadSharedAnalysis(params.id);
  if (!shared) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Read-only share</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Regret Forecast</h1>
        </div>

        <Link
          href="/"
          className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted transition hover:text-text-primary"
        >
          Open app
        </Link>
      </div>

      <section className="mb-5 rounded-2xl border border-border bg-card p-6">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-text-muted">Decision</p>
        <p className="text-sm leading-relaxed text-text-primary sm:text-base">{shared.decisionText}</p>
      </section>

      <section className="mb-5 rounded-2xl border border-border bg-card p-6">
        <p className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">Regret Risk Score</p>
        <div className="flex justify-center">
          <ScoreRing score={shared.result.score} verdict={shared.result.verdict} />
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-border bg-card p-6">
        <p className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">Regret Risk Breakdown</p>
        <BreakdownMeters breakdown={shared.result.breakdown} />
      </section>

      <section className="mb-5 rounded-2xl border border-border bg-card p-6">
        <p className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">Your Future Self Speaks</p>
        <FutureVoice text={shared.result.future_voice} />
      </section>

      <section className="mb-5 rounded-2xl border border-border bg-card p-6">
        <HiddenQuestion question={shared.result.hidden_question} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <MitigationList items={shared.result.mitigations} />
      </section>
    </main>
  );
}
