interface HiddenQuestionProps {
  question: string;
}

export default function HiddenQuestion({ question }: HiddenQuestionProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-text-muted">The Question You Haven&apos;t Asked</p>
      <p className="border-l-4 border-accent-purple pl-4 text-xl font-medium leading-relaxed text-text-primary">
        {question}
      </p>
    </section>
  );
}
