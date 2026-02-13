import type { GitHubEvent } from "@/types";

/** 日付を「YYYY年M月D日（曜日）」形式に変換 */
export function formatDate(d: string) {
  const dt = new Date(d);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${wd}）`;
}

/** 日付を「M/D」形式に変換 */
export function shortDate(d: string) {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

/** 指定日からの経過日数 */
export function daysAgo(d: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  );
}

/** コンテンツ/ブログ系リポジトリか判定 */
export function isContentRepo(name: string) {
  return /[-_](content|blog|articles|posts|zenn)/i.test(name);
}

/** プロダクトリポを先頭に、コンテンツリポを後方にソート */
export function sortByRelevance<T extends { repo?: { name: string } }>(arr: T[]) {
  const product = arr.filter((e) => !isContentRepo(e.repo?.name || ""));
  const content = arr.filter((e) => isContentRepo(e.repo?.name || ""));
  return [...product, ...content];
}

/** bioからURL・SNSサービス名ラベル・区切り文字を除去 */
export function cleanBio(bio: string): string {
  return bio
    .replace(/https?:\/\/\S+/g, "")
    .replace(
      /\b(Qiita|Dribbble|Medium|Twitter|X|LinkedIn|Facebook|Instagram|YouTube|Note|Wantedly)\s*:?\s*/gi,
      ""
    )
    .replace(/[|/·・]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** PRアクションに対応する色を返す */
export function prColor(action?: string) {
  if (action === "merged") return "#238636";
  if (action === "opened") return "#6f42c1";
  if (action === "closed") return "#cf222e";
  return "#666";
}

/** PushEventsをリポジトリ別にグループ化 */
export function groupPushEventsByRepo(pushEvents: GitHubEvent[]) {
  const grouped = new Map<
    string,
    {
      fullName: string;
      commits: { sha: string; message: string }[];
      latestDate: string;
      pushCount: number;
    }
  >();

  for (const e of pushEvents) {
    const fullName = e.repo?.name || "unknown";
    const repo = fullName.split("/")[1] || fullName;
    const prev = grouped.get(repo);
    const evCommits = (e.payload?.commits || []).map((c) => ({
      sha: c.sha,
      message: c.message,
    }));
    if (prev) {
      prev.commits.push(...evCommits);
      if (e.created_at > prev.latestDate) prev.latestDate = e.created_at;
      prev.pushCount++;
    } else {
      grouped.set(repo, {
        fullName,
        commits: evCommits,
        latestDate: e.created_at,
        pushCount: 1,
      });
    }
  }

  return grouped;
}
