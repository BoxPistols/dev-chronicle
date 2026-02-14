"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { GitHubData, ZennData } from "@/types";
import Newspaper from "@/components/Newspaper";

function EmbedContent() {
  const searchParams = useSearchParams();
  const ghUser = searchParams.get("gh") || "";
  const zennUser = searchParams.get("zenn") || "";
  const dark = searchParams.get("dark") === "1";

  const [gh, setGh] = useState<GitHubData | null>(null);
  const [zenn, setZenn] = useState<ZennData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!ghUser && !zennUser) {
      setLoading(false);
      setErrors(["パラメータ gh または zenn を指定してください"]);
      return;
    }

    async function fetchData() {
      setLoading(true);
      const errs: string[] = [];

      const fetches: Promise<void>[] = [];

      if (ghUser) {
        fetches.push(
          fetch(`/api/github?username=${encodeURIComponent(ghUser)}`)
            .then(async (res) => {
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "取得失敗");
              setGh(data);
            })
            .catch((e) => {
              errs.push(`GitHub: ${e instanceof Error ? e.message : "取得失敗"}`);
            })
        );
      }

      if (zennUser) {
        fetches.push(
          fetch(`/api/zenn?username=${encodeURIComponent(zennUser)}`)
            .then(async (res) => {
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "取得失敗");
              if (data.articles?.length === 0) {
                errs.push("Zenn: 記事が見つかりませんでした");
              } else {
                setZenn(data);
              }
            })
            .catch((e) => {
              errs.push(`Zenn: ${e instanceof Error ? e.message : "取得失敗"}`);
            })
        );
      }

      await Promise.all(fetches);
      setErrors(errs);
      setLoading(false);
    }

    fetchData();
  }, [ghUser, zennUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <svg
            className="w-8 h-8 animate-spin mx-auto text-text-muted"
            viewBox="0 0 24 24"
            fill="none"
          >
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
          <p className="mt-3 text-sm text-text-muted">
            レポートを生成中...
          </p>
        </div>
      </div>
    );
  }

  if (errors.length > 0 && !gh && !zenn) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-lg font-bold text-primary mb-4">
            Dev Chronicle - Embed
          </h1>
          {errors.map((e, i) => (
            <p key={i} className="text-error text-sm mb-2">{e}</p>
          ))}
          <p className="text-text-muted text-xs mt-4">
            使い方: /embed?gh=GitHubユーザー名&amp;zenn=Zennユーザー名
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen dark-transition ${dark ? "dark bg-surface-dark text-text-dark" : "bg-white text-text"}`}
    >
      <div className="p-4 md:p-8">
        {errors.map((e, i) => (
          <p key={i} className="text-error text-sm mb-2 max-w-[1200px] mx-auto">
            {e}
          </p>
        ))}
        <div
          className="bg-surface dark:bg-surface-dark-alt text-text dark:text-text-dark max-w-[1200px] mx-auto p-6 md:p-10 shadow-lg rounded-xl dark-transition"
        >
          <Newspaper
            gh={gh}
            zenn={zenn}
            usernames={{ ghUser, zennUser }}
            aiComment={null}
          />
        </div>
      </div>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-sm text-text-muted">読み込み中...</p>
        </div>
      }
    >
      <EmbedContent />
    </Suspense>
  );
}
