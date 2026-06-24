import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VAULT_PATH = "/Users/tf-fl0142/Documents/Obsidian Vault";

const DEPT_MAP: Record<string, string> = {
  "ブンゼミ": "bunzemi-plan",
  "相場分析": "bunzemi-plan",
  "相場ゼミ": "bunzemi-plan",
  "体験会": "bunzemi-plan",
  "セミナー": "bunzemi-plan",
  "メール": "bunzemi-mail",
  "文面": "bunzemi-mail",
  "デザイン": "bunzemi-design",
  "バナー": "bunzemi-design",
  "個別株": "kobetsu-plan",
  "LP": "bunzemi-lp",
  "Google Docs": "gfs-general",
};

function getDeptId(filePath: string, content: string): string {
  const text = filePath + content.slice(0, 200);
  for (const [key, dept] of Object.entries(DEPT_MAP)) {
    if (text.includes(key)) return dept;
  }
  return "gfs-general";
}

function getMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      results.push(...getMarkdownFiles(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

async function upsert(records: object[]) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(records),
  });
  return res.status;
}

async function main() {
  const files = getMarkdownFiles(VAULT_PATH);
  console.log(`Found ${files.length} markdown files`);

  const CHUNK = 2000;
  let saved = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf-8");
    const title = path.basename(file, ".md");
    const deptId = getDeptId(file, raw);
    const source = file.includes("Google Docs") ? "google-docs" : "obsidian";

    // 長いファイルはチャンク分割
    for (let i = 0; i < raw.length; i += CHUNK) {
      const chunk = raw.slice(i, i + CHUNK);
      const chunkTitle = raw.length > CHUNK
        ? `${title} (${Math.floor(i / CHUNK) + 1}/${Math.ceil(raw.length / CHUNK)})`
        : title;

      const status = await upsert([{
        dept_id: deptId,
        title: chunkTitle,
        content: chunk,
        source,
      }]);

      if (status === 201 || status === 200) saved++;
      else console.warn(`  WARN: ${chunkTitle} → HTTP ${status}`);
    }
    console.log(`  ✓ ${title}`);
  }

  console.log(`\n完了: ${saved} エントリ保存`);
}

main().catch(console.error);
