import { ImageResponse } from "next/og";

import { decodeLocalSharePayload } from "@/lib/share-token";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

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

const decodeToken = (rawId: string) => {
  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

const loadOgData = async (rawId: string) => {
  const token = decodeToken(rawId);

  const localPayload = decodeLocalSharePayload(token);
  if (localPayload) {
    return {
      score: localPayload.result.score,
      verdict: localPayload.result.verdict
    };
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("analyses")
      .select("score, verdict")
      .eq("share_token", token)
      .single();

    if (!error && data && typeof data.score === "number" && typeof data.verdict === "string") {
      return {
        score: data.score,
        verdict: data.verdict
      };
    }
  } catch {
    // Fall through to defaults.
  }

  return {
    score: 0,
    verdict: "Regret Forecast"
  };
};

export default async function OGImage({ params }: OGProps) {
  const { score, verdict } = await loadOgData(params.id);

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
