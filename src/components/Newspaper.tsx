"use client";

import { useState, useEffect, useRef } from "react";
import type { NewspaperProps, GitHubEvent, ContributionCalendar } from "@/types";
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

// -- SVG Icons --

function IconCommit() {
  return (
    <svg className="w-4 h-4 inline-block mr-1 align-[-2px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="1.05" y1="12" x2="7" y2="12" />
      <line x1="17.01" y1="12" x2="22.96" y2="12" />
    </svg>
  );
}

function IconPR() {
  return (
    <svg className="w-4 h-4 inline-block mr-1 align-[-2px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <line x1="6" y1="9" x2="6" y2="21" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg className="w-3.5 h-3.5 inline-block mr-0.5 align-[-2px]" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

// -- UI Parts --

function Tag({
  c = "#555",
  children,
}: {
  c?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-block text-white text-[0.7em] px-2 py-0.5 rounded-sm mr-1.5 align-middle font-medium tracking-wide"
      style={{ background: c }}
    >
      {children}
    </span>
  );
}

function SideHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-serif text-[0.92em] border-b-2 border-primary dark:border-border-dark pb-1 mt-5 mb-2.5 font-bold tracking-wide">
      {children}
    </h3>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border-light dark:border-border-dark text-[0.86em]">
      <span className="text-text-muted dark:text-text-dark-muted">{label}</span>
      <strong className="text-text dark:text-text-dark">{value}</strong>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-xl font-bold border-b-2 border-primary dark:border-border-dark pb-1.5 mb-4 mt-10 tracking-wide">
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-serif text-base font-bold mt-6 mb-2.5 border-b border-border-light dark:border-border-dark pb-1 flex items-center gap-1.5">
      {children}
    </h3>
  );
}

// -- Contribution Graph --

const LEVEL_COLORS_LIGHT = [
  "#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39",
];
const LEVEL_COLORS_DARK = [
  "#161b22", "#0e4429", "#006d32", "#26a641", "#39d353",
];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function ContributionGraph({
  data,
}: {
  data: ContributionCalendar;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      setIsDark(!!containerRef.current.closest(".dark"));
    }
  });

  const colors = isDark ? LEVEL_COLORS_DARK : LEVEL_COLORS_LIGHT;
  const cellSize = 10;
  const cellGap = 2;
  const step = cellSize + cellGap;
  const weeks = data.weeks;
  const svgW = weeks.length * step + 30;
  const svgH = 7 * step + 22;

  // 月ラベルの位置を計算
  const monthPositions: { label: string; x: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((w, wi) => {
    if (w.days.length === 0) return;
    const d = new Date(w.days[0].date);
    const m = d.getMonth();
    if (m !== lastMonth) {
      monthPositions.push({ label: MONTH_LABELS[m], x: wi * step + 30 });
      lastMonth = m;
    }
  });

  return (
    <div ref={containerRef} className="mt-3 mb-2">
      <div className="text-[0.82em] font-semibold text-text-muted dark:text-text-dark-muted mb-1.5">
        {data.total.toLocaleString()} contributions in the last year
      </div>
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} className="block">
          {/* 月ラベル */}
          {monthPositions.map((mp, i) => (
            <text
              key={i}
              x={mp.x}
              y={10}
              className="fill-text-muted dark:fill-text-dark-muted"
              fontSize="9"
            >
              {mp.label}
            </text>
          ))}
          {/* セル */}
          {weeks.map((w, wi) =>
            w.days.map((d, di) => (
              <rect
                key={`${wi}-${di}`}
                x={wi * step + 30}
                y={di * step + 16}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={colors[d.level]}
              >
                <title>
                  {d.date}: {d.count} contributions
                </title>
              </rect>
            ))
          )}
        </svg>
      </div>
      <div className="flex items-center gap-1 justify-end mt-1 text-[0.72em] text-text-muted dark:text-text-dark-muted">
        <span>Less</span>
        {colors.map((c, i) => (
          <span
            key={i}
            className="inline-block w-[10px] h-[10px] rounded-sm"
            style={{ background: c }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// -- Avatar with fallback --

function Avatar({
  name,
  url,
}: {
  name: string;
  url?: string;
}) {
  const [err, setErr] = useState(false);
  const initials = (name || "?").slice(0, 2).toUpperCase();

  if (err || !url) {
    return (
      <div className="w-[72px] h-[72px] rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[1.4em] font-bold text-text-muted dark:text-text-dark-muted border-2 border-border-light dark:border-border-dark mx-auto">
        {initials}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      onError={() => setErr(true)}
      className="w-[72px] h-[72px] rounded-full border-2 border-border-light dark:border-border-dark block mx-auto"
    />
  );
}

// -- Main Component --

export default function Newspaper({
  gh,
  zenn,
  usernames,
  aiComment,
}: NewspaperProps) {
  const { ghUser, zennUser } = usernames;
  const profile = gh?.profile;
  const events = gh?.events || [];
  const repos = gh?.repos || [];
  const articles = zenn?.articles || [];

  const pushEvents = sortByRelevance<GitHubEvent>(events.filter((e) => e.type === "PushEvent"));
  const prEvents = sortByRelevance<GitHubEvent>(events.filter((e) => e.type === "PullRequestEvent"));
  const issueEvents = events.filter(
    (e) => e.type === "IssuesEvent" || e.type === "IssueCommentEvent"
  );
  const totalCommits = pushEvents.reduce(
    (s, e) => s + (e.payload?.commits?.length || 0),
    0
  );
  const activeRepos = [...new Set(events.map((e) => e.repo?.name))];
  const totalStars = repos.reduce(
    (s, r) => s + (r.stargazers_count || 0),
    0
  );

  const langMap: Record<string, number> = {};
  repos.forEach((r) => {
    if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1;
  });
  const topLangs = Object.entries(langMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalLikes = articles.reduce(
    (s, a) => s + (a.liked_count || 0),
    0
  );
  const hasGH = !!profile;
  const hasZenn = articles.length > 0;
  const now = formatDate(new Date().toISOString());

  return (
    <div className="max-w-[1100px] mx-auto leading-relaxed">
      {/* Header */}
      <header className="border-b-[3px] border-double border-primary dark:border-border-dark pb-5 mb-8">
        <h1 className="font-serif text-[2.2em] text-center tracking-[0.14em] font-bold text-primary dark:text-text-dark">
          週刊デベロッパー・クロニクル
        </h1>
        <p className="text-center text-text-muted dark:text-text-dark-muted text-[0.88em] mt-1.5">
          ── GitHub &amp; Zenn アクティビティから自動生成 ──
        </p>
        <div className="flex justify-between text-[0.8em] text-text-muted dark:text-text-dark-muted mt-3 px-1">
          <span>{now} 発行</span>
          <span>
            {[ghUser && `@${ghUser}`, zennUser && `Zenn: ${zennUser}`]
              .filter(Boolean)
              .join(" / ")}{" "}
            特別号
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 mb-8">
        {/* Left Column */}
        <div>
          {/* GitHub Lead */}
          {hasGH && profile && (
            <>
              <Tag c="#24292e">GitHub</Tag>
              <h2 className="font-serif text-[1.5em] font-bold mt-1.5 mb-3 leading-tight text-primary dark:text-text-dark">
                {totalCommits > 0
                  ? `${profile.name || ghUser}、直近で${totalCommits}件のコミットを記録`
                  : `${profile.name || ghUser}のGitHub活動レポート`}
              </h2>
              <p className="text-justify text-[0.93em] leading-7 text-text dark:text-text-dark">
                GitHub上の開発者{" "}
                <strong>{profile.name || ghUser}</strong>{" "}
                の直近のアクティビティを分析した。
                {totalCommits > 0 &&
                  ` 計${totalCommits}件のコミットが確認され、`}
                {activeRepos.length > 0 &&
                  `${activeRepos.length}件のリポジトリで活動が見られた。`}
                {` 公開リポジトリ数は${profile.public_repos || 0}件、獲得スター数は合計${totalStars}個。`}
                {profile.bio && (() => {
                  const bio = cleanBio(profile.bio);
                  return bio ? ` プロフィール:「${bio}」` : null;
                })()}
              </p>

              {/* 主要コミット */}
              {pushEvents.length > 0 && (() => {
                const grouped = groupPushEventsByRepo(pushEvents);
                return (
                  <>
                    <SubTitle><IconCommit />主要コミット</SubTitle>
                    {[...grouped.entries()].slice(0, 5).map(([repo, { fullName, commits, latestDate, pushCount }]) => (
                      <div
                        key={repo}
                        className="mb-3 pb-3 border-b border-border-light dark:border-border-dark text-[0.9em] animate-[fadeInUp_0.3s_ease]"
                      >
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <a
                            href={`https://github.com/${fullName}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-primary dark:text-text-dark hover:text-accent dark:hover:text-blue-400 transition-colors cursor-pointer"
                          >
                            {repo}
                          </a>
                          <span className="text-text-muted dark:text-text-dark-muted text-[0.82em]">
                            {commits.length > 0
                              ? `${commits.length}件のコミット`
                              : `${pushCount}件のプッシュ`}
                          </span>
                          <span className="text-text-muted dark:text-text-dark-muted text-[0.82em]">
                            ({shortDate(latestDate)})
                          </span>
                          {isContentRepo(repo) && (
                            <span className="text-[0.72em] px-1.5 py-px rounded bg-neutral-100 dark:bg-neutral-700 text-text-muted dark:text-text-dark-muted">
                              コンテンツ
                            </span>
                          )}
                        </div>
                        {commits.length > 0 ? (
                          <div className="mt-1.5">
                            {commits
                              .filter((c: { message: string }) => c.message)
                              .slice(0, 3)
                              .map((c: { message: string }, j: number) => (
                                <div
                                  key={j}
                                  className="pl-3 border-l-2 border-accent/30 dark:border-accent/40 my-1.5 text-text-muted dark:text-text-dark-muted text-[0.88em] leading-6"
                                >
                                  {c.message.split("\n")[0]}
                                </div>
                              ))}
                            {commits.filter((c: { message: string }) => c.message).length > 3 && (
                              <span className="text-[0.78em] text-text-muted dark:text-text-dark-muted pl-3">
                                …他{commits.filter((c: { message: string }) => c.message).length - 3}件
                              </span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </>
                );
              })()}

              {/* プルリクエスト動向 */}
              {prEvents.length > 0 && (
                <>
                  <SubTitle><IconPR />プルリクエスト動向</SubTitle>
                  {prEvents.slice(0, 5).map((e: typeof prEvents[number], i: number) => {
                    const pr = e.payload?.pull_request;
                    const title = pr?.title
                      || (pr?.number ? `#${pr.number}` : e.repo?.name?.split("/")[1] || "PR");
                    const prUrl = pr?.html_url || `https://github.com/${e.repo?.name}`;
                    const repoShort = e.repo?.name?.split("/")[1];
                    return (
                      <div key={i} className="mb-2 pb-2 border-b border-border-light dark:border-border-dark text-[0.9em] flex items-baseline gap-1.5 flex-wrap">
                        <Tag c={prColor(e.payload?.action)}>
                          {e.payload?.action}
                        </Tag>
                        <a
                          href={prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-primary dark:text-text-dark hover:text-accent dark:hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          {title}
                        </a>
                        <a
                          href={`https://github.com/${e.repo?.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-muted dark:text-text-dark-muted text-[0.82em] hover:text-accent dark:hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          {repoShort}
                        </a>
                        <span className="text-text-muted dark:text-text-dark-muted text-[0.78em]">
                          {shortDate(e.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {/* Zenn Lead */}
          {hasZenn && (
            <div className={hasGH ? "mt-8" : ""}>
              <Tag c="#3ea8ff">Zenn</Tag>
              <h2 className="font-serif text-[1.5em] font-bold mt-1.5 mb-3 leading-tight text-primary dark:text-text-dark">
                Zennで{articles.length}本の記事を公開中、合計
                {totalLikes}いいね獲得
              </h2>
              <p className="text-justify text-[0.93em] leading-7 text-text dark:text-text-dark">
                技術情報共有プラットフォームZennにおける{zennUser}
                の執筆活動を調査した。直近の記事
                {Math.min(articles.length, 20)}
                本を分析したところ、合計{totalLikes}
                件のいいねを獲得しており、コミュニティからの支持が確認された。
              </p>

              <SubTitle>最新の記事</SubTitle>
              {articles.filter((a) => a.liked_count > 0).slice(0, 8).map((a, i) => (
                <div
                  key={i}
                  className="mb-3 pb-2.5 border-b border-border-light dark:border-border-dark"
                >
                  <div className="flex justify-between items-baseline gap-3">
                    <a
                      href={`https://zenn.dev${a.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[0.93em] hover:text-accent dark:hover:text-blue-400 transition-colors flex-1 cursor-pointer"
                    >
                      {a.title}
                    </a>
                    <span className="text-accent font-bold text-[0.85em] whitespace-nowrap flex items-center">
                      <svg className="w-3.5 h-3.5 mr-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                      {a.liked_count || 0}
                    </span>
                  </div>
                  <div className="text-[0.8em] text-text-muted dark:text-text-dark-muted mt-0.5">
                    {a.article_type === "tech" ? "技術記事" : "アイデア"}
                    {a.published_at && ` · ${formatDate(a.published_at)}`}
                    {a.topics && a.topics.length > 0 && (
                      <span className="ml-2">
                        {a.topics.slice(0, 3).map(t => (
                          <span key={t} className="inline-block bg-neutral-100 dark:bg-neutral-700 text-[0.9em] px-1.5 py-px rounded mr-1">
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Sidebar */}
        <aside className="bg-surface-alt dark:bg-surface-dark-alt p-5 border border-border-light dark:border-border-dark rounded-lg text-[0.86em] h-fit">
          {hasGH && profile && (
            <div className="text-center mb-4">
              <a href={`https://github.com/${ghUser}`} target="_blank" rel="noopener noreferrer">
                <Avatar
                  name={profile.name || ghUser}
                  url={profile.avatar_url}
                />
              </a>
              <a
                href={`https://github.com/${ghUser}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block font-bold mt-2 text-primary dark:text-text-dark hover:text-accent dark:hover:text-blue-400 transition-colors"
              >
                {profile.name || ghUser}
              </a>
              {profile.location && (
                <div className="text-text-muted dark:text-text-dark-muted text-[0.85em] mt-0.5">
                  {profile.location}
                </div>
              )}
              <div className="flex justify-center gap-3 mt-2 text-[0.8em]">
                <a
                  href={`https://github.com/${ghUser}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted dark:text-text-dark-muted hover:text-accent dark:hover:text-blue-400 transition-colors"
                >
                  GitHub
                </a>
                {zennUser && (
                  <a
                    href={`https://zenn.dev/${zennUser}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-muted dark:text-text-dark-muted hover:text-accent dark:hover:text-blue-400 transition-colors"
                  >
                    Zenn
                  </a>
                )}
              </div>
            </div>
          )}
          {/* GitHub/Zenn links when no GH profile */}
          {!hasGH && zennUser && (
            <div className="text-center mb-4">
              <a
                href={`https://zenn.dev/${zennUser}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-primary dark:text-text-dark hover:text-accent dark:hover:text-blue-400 transition-colors"
              >
                {zennUser} (Zenn)
              </a>
            </div>
          )}

          {hasGH && profile && (
            <>
              <SideHeader>GitHub統計</SideHeader>
              <StatRow label="コミット数" value={totalCommits} />
              <StatRow
                label="アクティブリポ"
                value={`${activeRepos.length}件`}
              />
              <StatRow label="PR活動" value={`${prEvents.length}件`} />
              <StatRow
                label="Issue活動"
                value={`${issueEvents.length}件`}
              />
              <StatRow
                label="公開リポ総数"
                value={`${profile.public_repos || 0}件`}
              />
              <StatRow
                label="フォロワー"
                value={`${profile.followers || 0}人`}
              />
              <StatRow label="合計スター" value={`${totalStars}`} />
            </>
          )}

          {topLangs.length > 0 && (
            <>
              <SideHeader>使用言語</SideHeader>
              {topLangs.map(([lang, count], i) => (
                <StatRow
                  key={lang}
                  label={`${i + 1}. ${lang}`}
                  value={`${count}リポ`}
                />
              ))}
            </>
          )}

          {hasZenn && (
            <>
              <SideHeader>Zenn統計</SideHeader>
              <StatRow label="記事数" value={`${articles.length}本`} />
              <StatRow label="合計いいね" value={`${totalLikes}`} />
              <StatRow
                label="最新投稿"
                value={
                  articles[0]
                    ? `${daysAgo(articles[0].published_at)}日前`
                    : "-"
                }
              />
            </>
          )}
        </aside>
      </div>

      {/* Contribution Graph */}
      {gh?.contributions && (
        <section>
          <SectionTitle>コントリビューション</SectionTitle>
          <ContributionGraph data={gh.contributions} />
        </section>
      )}

      {/* Featured Repos */}
      {repos.length > 0 && (
        <section>
          <SectionTitle>注目リポジトリ</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {repos.slice(0, 12).map((r, i) => (
              <a
                key={i}
                href={r.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-border-light dark:border-border-dark rounded-lg p-4 bg-surface-alt dark:bg-surface-dark-alt hover:border-accent/40 dark:hover:border-accent/40 transition-colors cursor-pointer"
              >
                <div className="font-bold text-[0.9em] text-primary dark:text-text-dark">
                  {r.name}
                </div>
                {r.description && (
                  <div className="text-[0.78em] text-text-muted dark:text-text-dark-muted my-1.5 leading-5">
                    {r.description.slice(0, 80)}
                    {r.description.length > 80 ? "…" : ""}
                  </div>
                )}
                <div className="text-[0.78em] text-text-muted dark:text-text-dark-muted flex items-center gap-3 mt-1">
                  {r.language && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-accent/60 inline-block" />
                      {r.language}
                    </span>
                  )}
                  <span className="flex items-center"><IconStar />{r.stargazers_count}</span>
                  <span>{r.forks_count} forks</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* AI Comment */}
      {aiComment && (
        <section>
          <SectionTitle>AI編集者の所感</SectionTitle>
          <div className="bg-surface-alt dark:bg-surface-dark-alt border-l-4 border-primary dark:border-border-dark p-5 font-serif leading-8 whitespace-pre-wrap text-text dark:text-text-dark rounded-r-lg">
            {aiComment}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="text-center text-text-muted dark:text-text-dark-muted text-[0.78em] mt-10 border-t border-border-light dark:border-border-dark pt-4 pb-2">
        ── GitHub公開API &amp; Zenn APIから自動生成 ──
      </footer>
    </div>
  );
}
