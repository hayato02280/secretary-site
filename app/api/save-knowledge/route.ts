import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { deptId, title, content, source } = await req.json();
  if (!deptId || !content) return NextResponse.json({ ok: false });
  const { error } = await supabaseAdmin()
    .from("knowledge")
    .insert({ dept_id: deptId, title, content, source: source ?? "chat" });
  return NextResponse.json({ ok: !error });
}
