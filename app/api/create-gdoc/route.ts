import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const FOLDER_ID = "0AIsaY-Zr_Le4Uk9PVA";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Google Service Account not configured");
  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

async function formatWithGroq(fbContent: string, userQuestion: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `以下のFBをもとに、修正案ドキュメントを作成してください。
出力形式は以下の構成で、プレーンテキスト（マークダウン記法OK）で出力してください。

# タイトル
（FBの対象を一言で）

## 指摘事項
（FBで指摘された問題点を箇条書きで）

## 修正前
（元の文面や状況を簡潔に記載。不明な場合は「（元の文面を貼り付けてください）」と記載）

## 修正案
（具体的な修正後の文面や改善案を記載）

## 根拠・理由
（なぜこの修正が必要か、数字・ファクトを含めて記載）

日本語のみ。英語単語はカタカナか日本語に言い換える。
アンダースコアを含む単語（_body、_titleなど）は絶対に出力しない。不明な場合は「（記入してください）」と書く。`,
        },
        {
          role: "user",
          content: `【対象の質問・依頼】\n${userQuestion}\n\n【FBの内容】\n${fbContent}`,
        },
      ],
    }),
  });
  const d = await res.json();
  return d.choices?.[0]?.message?.content ?? fbContent;
}

function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const html = lines.map(line => {
    if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
    if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
    if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
    if (line.startsWith("* ") || line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
    if (line.trim() === "") return "<br>";
    // **bold**
    return `<p>${line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
  }).join("\n");
  return `<html><body style="font-family:sans-serif">${html}</body></html>`;
}

export async function POST(req: NextRequest) {
  const { type, title, content, userQuestion = "" } = await req.json();
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

  try {
    // Googleドキュメントの場合はGroqで整形
    const body = type === "doc"
      ? await formatWithGroq(content, userQuestion)
      : content;

    const auth = getAuth();
    const drive = google.drive({ version: "v3", auth });

    const mimeType = type === "sheet"
      ? "application/vnd.google-apps.spreadsheet"
      : "application/vnd.google-apps.document";

    // ドキュメントはHTMLに変換してアップロード（見出し書式が適用される）
    const uploadContent = type === "sheet" ? body : mdToHtml(body);
    const contentMime = type === "sheet" ? "text/csv" : "text/html";

    const res = await drive.files.create({
      supportsAllDrives: true,
      fields: "id,webViewLink",
      requestBody: {
        name: title || (type === "sheet" ? "GFS AI秘書 - スプレッドシート" : "GFS AI秘書 - 修正案"),
        mimeType,
        parents: [FOLDER_ID],
      },
      media: { mimeType: contentMime, body: uploadContent },
    });

    return NextResponse.json({ url: res.data.webViewLink });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
