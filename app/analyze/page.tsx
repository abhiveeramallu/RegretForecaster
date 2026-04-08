import { Suspense } from "react";

import AnalyzeClient from "@/components/AnalyzeClient";

interface AnalyzePageProps {
  searchParams: {
    id?: string;
  };
}

export default function AnalyzePage({ searchParams }: AnalyzePageProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          <div className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
        </main>
      }
    >
      <AnalyzeClient recordId={searchParams.id ?? null} />
    </Suspense>
  );
}
