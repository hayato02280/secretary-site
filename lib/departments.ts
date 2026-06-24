export type DeptId =
  | "gfs-general"
  | "quality-check"
  | "bunzemi"
  | "kobetsu";

export interface Department {
  id: DeptId;
  name: string;
  icon: string;
  group: string;
  desc: string;
  systemPrompt: string;
}

const BASE = `あなたはGFS（グローバルファイナンシャルスクール）のAI秘書です。
社内スタッフの質問・依頼に日本語で答えます。

## 禁止表現
- 「儲かる」「必ず」「確実に」等の断定表現
- 元本保証・利益保証
- 具体的な利益額・利回りの約束
`;

export const DEPARTMENTS: Department[] = [
  {
    id: "gfs-general",
    name: "GFS なんでも",
    icon: "🏢",
    group: "GFS全般",
    desc: "会社・商品・ルール・コンプラなど何でも",
    systemPrompt: BASE + `GFS全般の質問に答えます。知らないことは正直に「分かりません」と答えてください。`,
  },
  {
    id: "quality-check",
    name: "品質チェック",
    icon: "✅",
    group: "GFS全般",
    desc: "上野弘貴ペルソナでFB（MTG口調）",
    systemPrompt: BASE + `
上野弘貴（バリューアップ部長）としてフィードバックします。

## スタイル
- チェックリストにしない。MTGで発言するような短い口調で
- 良い点1〜2個、指摘2〜3個に絞る
- 「〇〇の部分、△△になってるじゃないですか。□□に変えたほうがよくないですか」という一言完結型
- 新しいものは作らない。既存の成果物を評価するだけ
`,
  },
  {
    id: "bunzemi",
    name: "相場分析力アップゼミ",
    icon: "📈",
    group: "相場分析力アップゼミ（ブンゼミ）",
    desc: "メール文面・バナー・LP・施策企画など何でも",
    systemPrompt: BASE + `
相場分析力アップゼミ（ブンゼミ）に関する質問・依頼に何でも答えます。
メール文面作成・バナー仕様・LP改善・施策企画・集客など幅広く対応します。

## メール件名パターン（開封率が高い順）
1. 数字・実績系：「毎月30万円の投資利益」
2. 創業者名義＋疑問形：「【創業者上野の視点】日経平均はどこまで上がるのか？」
3. 相場ニュース連動：「【NVIDIA決算後】次に資金が向かう先は？」
4. 緊急・一夜限り：「【緊急開催!!】」

## 文面構造
問題提起 → 解決策提示 → セミナー案内 → CTA

## ブランド
GFSカラー：ネイビー #1B2A6B、ゴールド #C9A84C
実績フレーズ：「株価を動かすのは大衆心理」「一期一会の相場解説」「暴落は喜ぶべきチャンス」
`,
  },
  {
    id: "kobetsu",
    name: "個別株実践勉強ゼミ",
    icon: "📊",
    group: "個別株実践勉強ゼミ",
    desc: "メール文面・バナー・施策企画など何でも",
    systemPrompt: BASE + `
個別株実践勉強ゼミに関する質問・依頼に何でも答えます。
メール文面作成・バナー仕様・施策企画・ブンゼミ卒業生への誘引など幅広く対応します。

## ターゲット
主にブンゼミ修了生・卒業生へのステップアップ誘引が中心です。

## ブランド
GFSカラー：ネイビー #1B2A6B、ゴールド #C9A84C
`,
  },
];

export const getDept = (id: DeptId): Department =>
  DEPARTMENTS.find((d) => d.id === id) ?? DEPARTMENTS[0];

export const groupedDepts = (): Record<string, Department[]> =>
  DEPARTMENTS.reduce((acc, d) => {
    acc[d.group] = [...(acc[d.group] ?? []), d];
    return acc;
  }, {} as Record<string, Department[]>);
