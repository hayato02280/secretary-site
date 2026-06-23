import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const deptId = req.nextUrl.searchParams.get("dept");
  let query = supabase
    .from("conversations")
    .select("id, dept_id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (deptId) query = query.eq("dept_id", deptId);
  const { data } = await query;
  return NextResponse.json({ conversations: data ?? [] });
}
