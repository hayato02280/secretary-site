import { NextRequest, NextResponse } from "next/server";
import { getDept } from "@/lib/departments";
import { supabaseAdmin } from "@/lib/supabase";
import type { DeptId } from "@/lib/departments";
import type { ConversationMessage } from "@/lib/supabase";

type AttachedFile = { name: string; mimeType: string; base64: string };

// Groq REST API を直接呼ぶ（SDK不使用・完全無料）
async function callGroq(systemPrompt: string, messages: ConversationMessage[], files: AttachedFile[]) {
  const apiKey = process.env.GROQ_API_KEY!;
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const groqMsgs: object[] = [{ role: "system", content: systemPrompt }];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const isLast = i === messages.length - 1;

    if (isLast && files.length > 0) {
      // 画像ありの場合はvision対応モデル用フォーマット
      const content: object[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const f of files) {
        if (f.mimeType.startsWith("image/")) {
          content.push({ type: "image_url", image_url: { url: `data:${f.mimeType};base64,${f.base64}` } });
        } else {
          content.push({ type: "text", text: `[添付ファイル: ${f.name}]` });
        }
      }
      groqMsgs.push({ role: m.role, content });
    } else {
      groqMsgs.push({ role: m.role, content: m.content });
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: groqMsgs,
      max_tokens: 2048,
      stream: true,
    }),
  });

  return res;
}

export async function POST(req: NextRequest) {
  const { messages, deptId, conversationId, knowledgeContext, files = [], userName = "" } = await req.json();

  const dept = getDept(deptId as DeptId);
  const systemPrompt =
    dept.systemPrompt +
    (knowledgeContext ? `\n\n## 関連ナレッジ\n${knowledgeContext}` : "");

  let apiRes: Response;
  try {
    apiRes = await callGroq(systemPrompt, messages, files);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(`接続エラー: ${msg}`, { status: 500 });
  }

  if (!apiRes.ok) {
    const err = await apiRes.text();
    return new NextResponse(`APIエラー (${apiRes.status}): ${err}`, { status: 500 });
  }

  // OpenAI互換SSEをストリーム
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const reader = apiRes.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const text = json.choices?.[0]?.delta?.content ?? "";
            if (text) {
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
          } catch {}
        }
      }
      controller.close();

      // 会話を保存
      if (conversationId && fullText) {
        const allMessages: ConversationMessage[] = [
          ...messages,
          { role: "assistant", content: fullText },
        ];
        await supabaseAdmin()
          .from("conversations")
          .upsert({
            id: conversationId,
            dept_id: deptId,
            title: messages[0]?.content?.slice(0, 40) ?? "新しい会話",
            messages: allMessages,
            user_name: userName,
            updated_at: new Date().toISOString(),
          });
      }
    },
  });

  return new NextResponse(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
