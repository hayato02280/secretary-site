import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";
  const deptId = req.nextUrl.searchParams.get("dept") ?? "";
  if (!query) return NextResponse.json({ results: [] });

  const { data } = await supabase
    .from("knowledge")
    .select("id, dept_id, title, content, source")
    .or(`dept_id.eq.${deptId},dept_id.eq.gfs-general`)
    .ilike("content", `%${query.slice(0, 20)}%`)
    .limit(5);

  return NextResponse.json({ results: data ?? [] });
}
