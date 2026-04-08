interface MitigationListProps {
  items: string[];
}

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20 6L9 17L4 12"
      stroke="#3FB950"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function MitigationList({ items }: MitigationListProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <p className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">
        What Would Reduce Your Regret Risk
      </p>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-text-primary sm:text-base">
            <span className="mt-0.5">
              <CheckIcon />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
