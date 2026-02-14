"use client";

import { useState, useRef, useCallback } from "react";
import type { GitHubData, ZennData } from "@/types";
import { isContentRepo, cleanBio } from "@/lib/utils";
import Newspaper from "./Newspaper";

type AIProvider = "openai" | "anthropic" | "gemini";

interface AIModel {
  id: string;
  label: string;
}

const AI_MODELS: Record<AIProvider, AIModel[]> = {
  openai: [
    { id: "gpt-4.1-nano", label: "GPT-4.1 Nano (default)" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { id: "o4-mini", label: "o4-mini" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  gemini: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (default)" },
    { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
  ],
};

// -- SVG Icons for toolbar --

function IconBack() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconPrint() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// -- Toolbar button --

function ToolBtn({
  onClick,
  children,
  variant = "default",
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "accent";
}) {
  const base =
    "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer";
  const styles =
    variant === "accent"
      ? `${base} border border-accent/30 dark:border-accent/40 text-accent dark:text-blue-400 hover:bg-accent/5 dark:hover:bg-accent/10`
      : `${base} border border-border-light dark:border-border-dark text-text-muted dark:text-text-dark-muted hover:bg-neutral-50 dark:hover:bg-neutral-800`;
  return (
    <button onClick={onClick} className={styles}>
      {children}
    </button>
  );
}

export default function InputForm() {
  const [ghUser, setGhUser] = useState("");
  const [zennUser, setZennUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [gh, setGh] = useState<GitHubData | null>(null);
  const [zenn, setZenn] = useState<ZennData | null>(null);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [genAI, setGenAI] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProvider>("openai");
  const [aiModel, setAiModel] = useState("gpt-4.1-nano");
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const newspaperRef = useRef<HTMLDivElement>(null);

  const hasResult = gh || zenn;

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // -- HTML export --
  const buildHTML = useCallback(() => {
    if (!newspaperRef.current) return "";
    return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>週刊デベロッパー・クロニクル</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Noto Sans JP','Hiragino Sans',sans-serif;background:#fff;color:#1e293b;padding:40px;line-height:1.8;font-feature-settings:"palt";-webkit-print-color-adjust:exact;print-color-adjust:exact}.font-serif{font-family:'Noto Serif JP',Georgia,serif}@page{size:A4;margin:15mm}section{break-inside:avoid}@media print{body{padding:0}}</style>
</head><body>${newspaperRef.current.innerHTML}</body></html>`;
  }, []);

  const handleDownload = useCallback(() => {
    try {
      const html = buildHTML();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const d = new Date();
      a.href = url;
      a.download = `dev-chronicle_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.html`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("HTMLファイルをダウンロードしました");
    } catch {
      // fallback: copy to clipboard
      try {
        const html = buildHTML();
        navigator.clipboard.writeText(html).then(
          () => showToast("HTMLをクリップボードにコピーしました"),
          () => showToast("ダウンロードに失敗しました", false)
        );
      } catch {
        showToast("ダウンロードに失敗しました", false);
      }
    }
  }, [buildHTML, showToast]);

  const handleCopy = useCallback(async () => {
    try {
      const html = buildHTML();
      await navigator.clipboard.writeText(html);
      showToast("HTMLをクリップボードにコピーしました");
    } catch {
      showToast("コピーに失敗しました", false);
    }
  }, [buildHTML, showToast]);

  const handlePrint = useCallback(() => {
    try {
      window.print();
    } catch {
      showToast("この環境では印刷できません", false);
    }
  }, [showToast]);

  async function generate() {
    const ghu = ghUser.trim();
    const zu = zennUser.trim();
    if (!ghu && !zu) return;

    setLoading(true);
    setErrors([]);
    setGh(null);
    setZenn(null);
    setAiComment(null);

    const errs: string[] = [];
    let ghData: GitHubData | null = null;
    let zennData: ZennData | null = null;

    // GitHub
    if (ghu) {
      try {
        const res = await fetch(`/api/github?username=${encodeURIComponent(ghu)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "取得失敗");
        ghData = data;
        setGh(data);
      } catch (e: unknown) {
        errs.push(`GitHub: ${e instanceof Error ? e.message : "取得失敗"}`);
      }
    }

    // Zenn
    if (zu) {
      try {
        const res = await fetch(`/api/zenn?username=${encodeURIComponent(zu)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "取得失敗");
        if (data.articles?.length === 0) {
          errs.push("Zenn: 記事が見つかりませんでした");
        } else {
          zennData = data;
          setZenn(data);
        }
      } catch (e: unknown) {
        errs.push(`Zenn: ${e instanceof Error ? e.message : "取得失敗"}`);
      }
    }

    // AI Comment
    if (genAI && (ghData || zennData)) {
      try {
        const parts: string[] = [];
        if (ghData) {
          const tc = ghData.events
            .filter((e) => e.type === "PushEvent")
            .reduce((s, e) => s + (e.payload?.commits?.length || 0), 0);
          const stars = ghData.repos.reduce((s, r) => s + r.stargazers_count, 0);
          const langs: Record<string, number> = {};
          ghData.repos.forEach((r) => {
            if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
          });
          const topL = Object.entries(langs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map((e) => e[0])
            .join(", ");
          // コード系リポジトリとコンテンツ系リポジトリを区別
          const codeRepos = [...new Set(ghData.events.map((e) => e.repo?.name))].filter(
            (n) => n && !isContentRepo(n)
          );
          const contentRepos = [
            ...new Set(ghData.events.map((e) => e.repo?.name)),
          ].filter((n) => n && isContentRepo(n));
          const bio = cleanBio(ghData.profile.bio || "");
          parts.push(
            `GitHub: ${ghu}, commits: ${tc}, code repos with activity: ${codeRepos.length} (${codeRepos.slice(0, 5).join(", ")}), content/blog repos: ${contentRepos.length}, public repos: ${ghData.profile.public_repos}, stars: ${stars}, top languages: ${topL}, PRs: ${ghData.events.filter((e) => e.type === "PullRequestEvent").length}${bio ? `, bio: ${bio}` : ""}`
          );
          parts.push(
            "注意: コンテンツ/ブログ系リポジトリ(zenn-contentなど)のコミットは記事投稿であり、プロダクト開発のコミットとは区別してください。プロフィールのURL先(Dribbble, Medium等)の内容には言及しないでください。"
          );
        }
        if (zennData) {
          const likes = zennData.articles.reduce((s, a) => s + (a.liked_count || 0), 0);
          parts.push(
            `Zenn: ${zu}, ${zennData.articles.length} articles, ${likes} total likes, recent titles: ${zennData.articles
              .slice(0, 3)
              .map((a) => a.title)
              .join(" / ")}`
          );
        }

        const res = await fetch("/api/ai-comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: parts.join("\n"),
            provider: aiProvider,
            model: aiModel,
          }),
        });
        const data = await res.json();
        if (data.comment) setAiComment(data.comment);
        else if (data.error) errs.push(`AI: ${data.error}`);
      } catch {
        errs.push("AI所感の生成に失敗しました");
      }
    }

    setErrors(errs);
    setLoading(false);
  }

  // -- Result view --
  if (hasResult) {
    return (
      <div
        className={`min-h-screen dark-transition ${dark ? "dark bg-surface-dark text-text-dark" : "bg-neutral-100 text-text"}`}
      >
        <div className="p-4 md:p-8">
          {/* Toast */}
          {toast && (
            <div
              className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-lg text-[0.85em] font-semibold shadow-lg animate-[fadeIn_0.2s_ease] ${
                toast.ok
                  ? "bg-green-50 dark:bg-green-900/30 text-success border border-success/30"
                  : "bg-red-50 dark:bg-red-900/30 text-error border border-error/30"
              }`}
            >
              {toast.msg}
            </div>
          )}

          {/* Toolbar */}
          <div className="max-w-[1200px] mx-auto mb-4 flex gap-2 flex-wrap items-center print:hidden">
            <ToolBtn
              onClick={() => {
                setGh(null);
                setZenn(null);
                setAiComment(null);
                setErrors([]);
              }}
            >
              <IconBack />
              別のユーザーで生成
            </ToolBtn>
            <ToolBtn onClick={() => setDark((d) => !d)}>
              {dark ? <IconSun /> : <IconMoon />}
              {dark ? "ライト" : "ダーク"}
            </ToolBtn>
            <ToolBtn onClick={handlePrint}>
              <IconPrint />
              印刷
            </ToolBtn>
            <ToolBtn onClick={handleDownload}>
              <IconDownload />
              HTML保存
            </ToolBtn>
            <ToolBtn onClick={handleCopy} variant="accent">
              <IconCopy />
              HTMLコピー
            </ToolBtn>
          </div>

          {errors.map((e, i) => (
            <p key={i} className="text-error text-sm mb-2 max-w-[1200px] mx-auto">
              {e}
            </p>
          ))}

          <div
            ref={newspaperRef}
            className="bg-surface dark:bg-surface-dark-alt text-text dark:text-text-dark max-w-[1200px] mx-auto p-6 md:p-10 shadow-lg rounded-xl dark-transition"
          >
            <Newspaper
              gh={gh}
              zenn={zenn}
              usernames={{
                ghUser: ghUser.trim(),
                zennUser: zennUser.trim(),
              }}
              aiComment={aiComment}
            />
          </div>
        </div>
      </div>
    );
  }

  // -- Input Form --
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface p-8 rounded-2xl shadow-lg border border-border-light">
        <div className="text-center mb-8">
          <h1 className="font-serif text-[1.6em] font-bold text-primary tracking-wide">
            週刊デベロッパー・クロニクル
          </h1>
          <p className="text-text-muted text-sm mt-1.5">
            GitHub &amp; Zenn から新聞を自動生成
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label
              htmlFor="gh-user"
              className="text-sm font-semibold flex items-center gap-1.5 mb-1.5"
            >
              <span className="bg-primary text-white text-[0.68em] px-1.5 py-0.5 rounded">
                GitHub
              </span>
              ユーザー名
            </label>
            <input
              id="gh-user"
              value={ghUser}
              onChange={(e) => setGhUser(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
              placeholder="例: BoxPistols"
              className="w-full px-3.5 py-2.5 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="zenn-user"
              className="text-sm font-semibold flex items-center gap-1.5 mb-1.5"
            >
              <span className="bg-[#3ea8ff] text-white text-[0.68em] px-1.5 py-0.5 rounded">
                Zenn
              </span>
              ユーザー名
            </label>
            <input
              id="zenn-user"
              value={zennUser}
              onChange={(e) => setZennUser(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
              placeholder="例: aito"
              className="w-full px-3.5 py-2.5 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* AI Settings */}
        <div className="border border-border-light rounded-xl p-4 mb-6">
          <label
            htmlFor="gen-ai"
            className="flex items-center gap-2.5 text-sm cursor-pointer"
          >
            <input
              id="gen-ai"
              type="checkbox"
              checked={genAI}
              onChange={(e) => setGenAI(e.target.checked)}
              className="rounded accent-accent w-4 h-4 cursor-pointer"
            />
            <span className="font-medium">AI編集者の所感を生成する</span>
          </label>

          {genAI && (
            <div className="mt-4 space-y-3 animate-[fadeInUp_0.2s_ease]">
              <div>
                <label className="text-xs font-semibold text-text-muted block mb-1.5">
                  AIプロバイダ
                </label>
                <div className="flex gap-2">
                  {(
                    [
                      { key: "openai", label: "OpenAI", color: "bg-green-600" },
                      { key: "anthropic", label: "Anthropic", color: "bg-orange-600" },
                      { key: "gemini", label: "Gemini", color: "bg-blue-600" },
                    ] as const
                  ).map(({ key, label, color }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setAiProvider(key);
                        setAiModel(AI_MODELS[key][0].id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        aiProvider === key
                          ? `${color} text-white shadow-sm`
                          : "bg-neutral-100 text-text-muted hover:bg-neutral-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label
                  htmlFor="ai-model"
                  className="text-xs font-semibold text-text-muted block mb-1.5"
                >
                  モデル
                </label>
                <select
                  id="ai-model"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors cursor-pointer"
                >
                  {AI_MODELS[aiProvider].map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={generate}
          disabled={loading || (!ghUser.trim() && !zennUser.trim())}
          className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <IconSpinner />
              取得中…
            </>
          ) : (
            "新聞を生成する"
          )}
        </button>

        {errors.map((e, i) => (
          <p key={i} className="text-error text-sm mt-3 flex items-center gap-1">
            <svg
              className="w-4 h-4 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {e}
          </p>
        ))}

        <div className="mt-6 p-4 bg-neutral-50 rounded-xl text-[0.78em] text-text-muted leading-relaxed border border-border-light">
          <strong className="text-text text-[1.05em]">
            データソース（認証不要の公開API）
          </strong>
          <div className="mt-1.5 space-y-0.5">
            <div>GitHub: プロフィール / イベント100件 / リポジトリ30件</div>
            <div>Zenn: 最新記事20件（タイトル・いいね数・投稿日）</div>
            <div className="text-text-muted/70">※ どちらか片方だけでもOK</div>
          </div>
        </div>
      </div>
    </div>
  );
}
