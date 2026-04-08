"use client";

import { useMemo, useState } from "react";

interface ShareButtonProps {
  shareToken: string;
}

export default function ShareButton({ shareToken }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/share/${shareToken}`;
  }, [shareToken]);

  const ogUrl = useMemo(() => `${shareUrl}/opengraph-image`, [shareUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copyLink}
        className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted transition hover:border-accent-purple hover:text-text-primary"
      >
        {copied ? "Link copied" : "Copy share link"}
      </button>

      <a
        href={shareUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted transition hover:border-accent-purple hover:text-text-primary"
      >
        Open shared view
      </a>

      <a
        href={ogUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted transition hover:border-accent-purple hover:text-text-primary"
      >
        Preview OG image
      </a>
    </div>
  );
}
