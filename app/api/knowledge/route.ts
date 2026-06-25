import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";
  if (!query) return NextResponse.json({ results: [] });

  // クエリをスペース・句読点で分割してキーワード抽出（最大5個）
  const keywords = query
    .split(/[\s　、。，．！？!?]+/)
    .map(k => k.trim())
    .filter(k => k.length >= 2)
    .slice(0, 5);

  if (keywords.length === 0) return NextResponse.json({ results: [] });

  // 各キーワードでタイトルまたはコンテンツを検索
  const seen = new Set<string>();
  const all = [];

  for (const kw of keywords) {
    const { data } = await supabase
      .from("knowledge")
      .select("id, dept_id, title, content, source")
      .or(`dept_id.eq.quality-check,dept_id.eq.gfs-general`)
      .or(`title.ilike.%${kw}%,content.ilike.%${kw}%`)
      .limit(6);

    for (const row of data ?? []) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        all.push(row);
      }
    }
    if (all.length >= 15) break;
  }

  return NextResponse.json({ results: all.slice(0, 15) });
}
