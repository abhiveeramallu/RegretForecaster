"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { motion } from "framer-motion";

import HistoryCard from "@/components/HistoryCard";
import ScoreRing from "@/components/ScoreRing";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { AnalysisRecord } from "@/lib/types";
import { normalizeAnalysis } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setBooting(false);
    };

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    void init();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadAnalyses = async () => {
      if (!session?.user?.id) {
        setAnalyses([]);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      setLoading(true);
      setStatusMessage("");

      const { data, error } = await supabase
        .from("analyses")
        .select("id, user_id, decision_text, result, score, verdict, share_token, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setStatusMessage("Could not load your analysis history.");
        setLoading(false);
        return;
      }

      const normalizedRows: AnalysisRecord[] = (data ?? [])
        .map((row) => {
          const normalized = normalizeAnalysis(row.result);
          if (!normalized) return null;

          return {
            id: row.id,
            user_id: row.user_id,
            decision_text: row.decision_text,
            result: normalized,
            score: normalized.score,
            verdict: normalized.verdict,
            share_token: row.share_token,
            created_at: row.created_at
          } satisfies AnalysisRecord;
        })
        .filter((row): row is AnalysisRecord => row !== null);

      setAnalyses(normalizedRows);
      setLoading(false);
    };

    void loadAnalyses();
  }, [session]);

  const sendMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");
    const supabase = getSupabaseBrowserClient();

    if (!email.trim()) {
      setStatusMessage("Enter a valid email first.");
      return;
    }

    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/history` : process.env.NEXT_PUBLIC_APP_URL;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo
      }
    });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setStatusMessage("Magic link sent. Open your inbox to sign in.");
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((selected) => selected !== id);
      }

      if (current.length === 2) {
        return [current[1], id];
      }

      return [...current, id];
    });
  };

  const selectedAnalyses = analyses.filter((item) => selectedIds.includes(item.id));

  if (booting) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-8">
        <div className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="mb-2 text-2xl font-semibold">History Dashboard</h1>
          <p className="mb-6 text-sm text-text-muted">
            Sign in with a magic link to access your private decision forecasts.
          </p>

          <form className="space-y-3" onSubmit={sendMagicLink}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent-purple"
            />
            <button
              type="submit"
              className="rounded-full border border-accent-purple/50 bg-accent-purple/15 px-4 py-2 text-sm"
            >
              Send magic link
            </button>
          </form>

          {statusMessage && <p className="mt-3 text-xs text-text-muted">{statusMessage}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">History Dashboard</h1>
          <p className="text-sm text-text-muted">Re-open past analyses and compare decisions side by side.</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted transition hover:text-text-primary"
          >
            New forecast
          </button>
          <button
            type="button"
            onClick={() => {
              const supabase = getSupabaseBrowserClient();
              void supabase.auth.signOut();
              setSelectedIds([]);
            }}
            className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted transition hover:text-text-primary"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Past analyses</p>
        <button
          type="button"
          disabled={selectedAnalyses.length !== 2}
          className="rounded-full border border-accent-purple/50 bg-accent-purple/10 px-4 py-2 text-xs transition disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-text-muted"
        >
          Compare two decisions
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-52 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : analyses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-text-muted">
          No analyses yet. Run your first forecast to see history here.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {analyses.map((record) => (
            <HistoryCard
              key={record.id}
              record={record}
              selected={selectedIds.includes(record.id)}
              onToggleSelect={toggleSelection}
              onOpen={(id) => router.push(`/analyze?id=${id}`)}
            />
          ))}
        </div>
      )}

      {statusMessage && <p className="mt-4 text-sm text-text-muted">{statusMessage}</p>}

      {selectedAnalyses.length === 2 && (
        <motion.section
          className="mt-8 rounded-2xl border border-border bg-card p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="mb-5 text-xs uppercase tracking-[0.2em] text-text-muted">Decision comparison</p>

          <div className="grid gap-5 md:grid-cols-2">
            {selectedAnalyses.map((analysis) => (
              <div key={analysis.id} className="rounded-2xl border border-border bg-surface p-5">
                <p className="mb-3 text-xs text-text-muted">{new Date(analysis.created_at).toLocaleString()}</p>
                <p className="mb-5 text-sm leading-relaxed text-text-primary">{analysis.decision_text}</p>

                <div className="mb-4 flex justify-center">
                  <ScoreRing score={analysis.score} verdict={analysis.verdict} size={170} />
                </div>

                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-text-muted">Hidden question</p>
                <p className="text-sm text-text-primary">{analysis.result.hidden_question}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}
    </main>
  );
}
