import { NextRequest, NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from "docx";

export async function POST(req: NextRequest) {
  const { title, content } = await req.json();
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

  // Markdownっぽいテキストをパースして段落に変換
  const lines = content.split("\n");
  const paragraphs: Paragraph[] = [];

  // タイトル
  if (title) {
    paragraphs.push(new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
    }));
  }

  for (const line of lines) {
    if (line.startsWith("### ")) {
      paragraphs.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }));
    } else if (line.startsWith("## ")) {
      paragraphs.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    } else if (line.startsWith("# ")) {
      paragraphs.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } }));
    } else if (line.startsWith("- ") || line.startsWith("・")) {
      const text = line.startsWith("- ") ? line.slice(2) : line.slice(1);
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: "• " + text, size: 24 })],
        indent: { left: 360 },
        spacing: { after: 60 },
      }));
    } else if (line.trim() === "") {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 100 } }));
    } else {
      // **bold** を処理
      const parts = line.split(/\*\*(.+?)\*\*/);
      const runs: TextRun[] = parts.map((p: string, i: number) =>
        new TextRun({ text: p, bold: i % 2 === 1, size: 24 })
      );
      paragraphs.push(new Paragraph({ children: runs, spacing: { after: 100 } }));
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
    styles: {
      default: {
        document: { run: { font: "游明朝", size: 24 } },
      },
    },
  });

  const buf = await Packer.toBuffer(doc);
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent((title || "document") + ".docx")}`,
    },
  });
}
