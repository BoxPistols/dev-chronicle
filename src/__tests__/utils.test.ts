import { describe, it, expect } from "vitest";
import {
  formatDate,
  shortDate,
  daysAgo,
  isContentRepo,
  sortByRelevance,
  cleanBio,
  prColor,
  groupPushEventsByRepo,
} from "@/lib/utils";
import type { GitHubEvent } from "@/types";

// -- formatDate --

describe("formatDate", () => {
  it("日本語の曜日付きで日付を表示する", () => {
    // 2025-01-06 は月曜日
    const result = formatDate("2025-01-06T00:00:00Z");
    expect(result).toBe("2025年1月6日（月）");
  });

  it("日曜日を正しく表示する", () => {
    // 2025-01-05 は日曜日
    const result = formatDate("2025-01-05T00:00:00Z");
    expect(result).toBe("2025年1月5日（日）");
  });
});

// -- shortDate --

describe("shortDate", () => {
  it("M/D形式で返す", () => {
    expect(shortDate("2025-02-13T00:00:00Z")).toBe("2/13");
  });

  it("ゼロ埋めしない", () => {
    expect(shortDate("2025-01-05T00:00:00Z")).toBe("1/5");
  });
});

// -- daysAgo --

describe("daysAgo", () => {
  it("今日の日付は0日前", () => {
    expect(daysAgo(new Date().toISOString())).toBe(0);
  });

  it("過去の日付は正の数を返す", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect(daysAgo(yesterday)).toBe(1);
  });

  it("未来の日付は0を返す（負にならない）", () => {
    const future = new Date(Date.now() + 86400000 * 10).toISOString();
    expect(daysAgo(future)).toBe(0);
  });
});

// -- isContentRepo --

describe("isContentRepo", () => {
  it("zenn-contentはコンテンツリポ", () => {
    expect(isContentRepo("user/zenn-content")).toBe(true);
  });

  it("my-blogはコンテンツリポ", () => {
    expect(isContentRepo("user/my-blog")).toBe(true);
  });

  it("tech_articlesはコンテンツリポ", () => {
    expect(isContentRepo("user/tech_articles")).toBe(true);
  });

  it("my-postsはコンテンツリポ", () => {
    expect(isContentRepo("user/my-posts")).toBe(true);
  });

  it("通常のリポジトリはfalse", () => {
    expect(isContentRepo("user/my-app")).toBe(false);
    expect(isContentRepo("user/react-ui")).toBe(false);
    expect(isContentRepo("user/api-server")).toBe(false);
  });

  it("大文字小文字を区別しない", () => {
    expect(isContentRepo("user/Zenn-Content")).toBe(true);
    expect(isContentRepo("user/MY-BLOG")).toBe(true);
  });
});

// -- sortByRelevance --

describe("sortByRelevance", () => {
  it("プロダクトリポを先頭、コンテンツリポを後方に並べる", () => {
    const events = [
      { repo: { name: "u/zenn-content" }, id: 1 },
      { repo: { name: "u/my-app" }, id: 2 },
      { repo: { name: "u/my-blog" }, id: 3 },
      { repo: { name: "u/api-server" }, id: 4 },
    ];
    const sorted = sortByRelevance(events);
    expect(sorted.map((e) => e.id)).toEqual([2, 4, 1, 3]);
  });

  it("全てプロダクトリポの場合は順序を維持", () => {
    const events = [
      { repo: { name: "u/app1" }, id: 1 },
      { repo: { name: "u/app2" }, id: 2 },
    ];
    const sorted = sortByRelevance(events);
    expect(sorted.map((e) => e.id)).toEqual([1, 2]);
  });

  it("空配列に対応", () => {
    expect(sortByRelevance([])).toEqual([]);
  });
});

// -- cleanBio --

describe("cleanBio", () => {
  it("URLを除去する", () => {
    expect(cleanBio("Dev https://example.com foo")).toBe("Dev foo");
  });

  it("SNSサービス名ラベルを除去する", () => {
    expect(cleanBio("Qiita: Dribbble: Medium:")).toBe("");
  });

  it("区切り文字を除去する", () => {
    expect(cleanBio("hello | world · foo / bar")).toBe("hello world foo bar");
  });

  it("複合的なbioを正しくクリーニングする", () => {
    const bio =
      "Frontend Dev Qiita: https://qiita.com/user Dribbble: https://dribbble.com/user Medium: https://medium.com/@user";
    expect(cleanBio(bio)).toBe("Frontend Dev");
  });

  it("空文字列は空文字列を返す", () => {
    expect(cleanBio("")).toBe("");
  });

  it("URLもサービス名もないbioはそのまま", () => {
    expect(cleanBio("TypeScript enthusiast")).toBe("TypeScript enthusiast");
  });
});

// -- prColor --

describe("prColor", () => {
  it("mergedは緑", () => {
    expect(prColor("merged")).toBe("#238636");
  });

  it("openedは紫", () => {
    expect(prColor("opened")).toBe("#6f42c1");
  });

  it("closedは赤", () => {
    expect(prColor("closed")).toBe("#cf222e");
  });

  it("不明なアクションはグレー", () => {
    expect(prColor("unknown")).toBe("#666");
  });

  it("undefinedはグレー", () => {
    expect(prColor()).toBe("#666");
  });
});

// -- groupPushEventsByRepo --

describe("groupPushEventsByRepo", () => {
  const makeEvent = (
    repoName: string,
    date: string,
    commits: { sha: string; message: string }[] = []
  ): GitHubEvent => ({
    type: "PushEvent",
    repo: { name: repoName },
    created_at: date,
    payload: { commits },
  });

  it("同リポジトリのイベントをグループ化する", () => {
    const events = [
      makeEvent("user/app", "2025-02-10T00:00:00Z", [
        { sha: "a1", message: "fix bug" },
      ]),
      makeEvent("user/app", "2025-02-12T00:00:00Z", [
        { sha: "b1", message: "add feature" },
      ]),
    ];
    const grouped = groupPushEventsByRepo(events);
    expect(grouped.size).toBe(1);
    const app = grouped.get("app");
    expect(app).toBeDefined();
    expect(app!.commits).toHaveLength(2);
    expect(app!.pushCount).toBe(2);
    expect(app!.latestDate).toBe("2025-02-12T00:00:00Z");
    expect(app!.fullName).toBe("user/app");
  });

  it("異なるリポジトリは別グループになる", () => {
    const events = [
      makeEvent("user/app", "2025-02-10T00:00:00Z"),
      makeEvent("user/lib", "2025-02-11T00:00:00Z"),
    ];
    const grouped = groupPushEventsByRepo(events);
    expect(grouped.size).toBe(2);
    expect(grouped.has("app")).toBe(true);
    expect(grouped.has("lib")).toBe(true);
  });

  it("コミットが空のイベントも正しく処理する", () => {
    const events = [makeEvent("user/app", "2025-02-10T00:00:00Z")];
    const grouped = groupPushEventsByRepo(events);
    const app = grouped.get("app");
    expect(app!.commits).toHaveLength(0);
    expect(app!.pushCount).toBe(1);
  });

  it("空配列は空のMapを返す", () => {
    expect(groupPushEventsByRepo([]).size).toBe(0);
  });

  it("最新日付が正しく記録される", () => {
    const events = [
      makeEvent("user/app", "2025-02-12T00:00:00Z"),
      makeEvent("user/app", "2025-02-08T00:00:00Z"),
      makeEvent("user/app", "2025-02-10T00:00:00Z"),
    ];
    const grouped = groupPushEventsByRepo(events);
    expect(grouped.get("app")!.latestDate).toBe("2025-02-12T00:00:00Z");
  });
});
