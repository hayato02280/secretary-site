import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  try {
    if (name.endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buf);
      return NextResponse.json({ text: data.text.slice(0, 8000), name: file.name });
    }

    if (name.endsWith(".docx") || name.endsWith(".doc")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      return NextResponse.json({ text: result.value.slice(0, 8000), name: file.name });
    }

    if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
      const text = buf.toString("utf-8").slice(0, 8000);
      return NextResponse.json({ text, name: file.name });
    }

    return NextResponse.json({ error: "未対応の形式です" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
