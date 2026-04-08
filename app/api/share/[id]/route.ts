import { NextResponse } from "next/server";

import { decodeLocalSharePayload } from "@/lib/share-token";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

interface Context {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: Context) {
  const token = params.id;

  if (!token || token.length < 12) {
    return NextResponse.json({ error: "Invalid share token" }, { status: 400 });
  }

  const localPayload = decodeLocalSharePayload(token);
  if (localPayload) {
    return NextResponse.json({
      analysis: {
        id: null,
        decision_text: localPayload.decisionText,
        result: localPayload.result,
        score: localPayload.result.score,
        verdict: localPayload.result.verdict,
        share_token: token,
        created_at: localPayload.createdAt
      }
    });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, decision_text, result, score, verdict, share_token, created_at")
    .eq("share_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  return NextResponse.json({ analysis: data });
}
