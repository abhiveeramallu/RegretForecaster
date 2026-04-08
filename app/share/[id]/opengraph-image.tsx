import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

interface OGProps {
  params: {
    id: string;
  };
}

const scoreColor = (score: number) => {
  if (score <= 39) return "#3FB950";
  if (score <= 69) return "#F0A500";
  return "#E5534B";
};

export default async function OGImage({ params }: OGProps) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  let score = 0;
  let verdict = "Regret Forecast";

  try {
    const token = encodeURIComponent(params.id);
    const response = await fetch(`${appUrl}/api/share/${token}`, { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as {
        analysis?: { score?: number; verdict?: string };
      };

      if (typeof payload.analysis?.score === "number") {
        score = payload.analysis.score;
      }

      if (typeof payload.analysis?.verdict === "string") {
        verdict = payload.analysis.verdict;
      }
    }
  } catch {
    // fallback defaults
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #0A0A0A 0%, #15122A 55%, #0F0F0F 100%)",
          color: "#F5F5F5",
          padding: "56px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 28, opacity: 0.82 }}>Regret Forecaster</div>
          <div
            style={{
              border: `2px solid ${scoreColor(score)}`,
              color: scoreColor(score),
              borderRadius: 999,
              padding: "8px 20px",
              fontSize: 24
            }}
          >
            {verdict}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "20px" }}>
          <div style={{ fontSize: 220, fontWeight: 700, lineHeight: 1, color: scoreColor(score) }}>{score}</div>
          <div style={{ fontSize: 54, opacity: 0.92, lineHeight: 1.1 }}>Regret Risk Score</div>
        </div>

        <div style={{ fontSize: 28, opacity: 0.68 }}>
          Honest, bias-aware decision forecasting before you commit.
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
