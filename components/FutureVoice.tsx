interface FutureVoiceProps {
  text: string;
}

export default function FutureVoice({ text }: FutureVoiceProps) {
  return (
    <blockquote className="rounded-2xl border border-border bg-card px-6 py-6 text-lg italic leading-relaxed text-text-primary sm:px-8 sm:py-8 sm:text-2xl">
      <p className="font-[family-name:var(--font-lora)]">“{text}”</p>
    </blockquote>
  );
}
