import { NextRequest } from "next/server";

// -- Types --

interface ProfileData {
  name: string | null;
  login: string;
  avatar_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
}

interface ContribDay {
  level: number;
}

interface ContribData {
  total: number;
  weeks: { days: ContribDay[] }[];
}

interface RepoInfo {
  name: string;
  language: string | null;
}

interface ZennArticleInfo {
  title: string;
  emoji: string;
  likes: number;
}

interface ZennData {
  count: number;
  totalLikes: number;
  articles: ZennArticleInfo[];
}

interface LangStat {
  name: string;
  count: number;
  percent: number;
}

// -- Language Colors (GitHub) --

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Vue: "#41b883",
  Shell: "#89e051",
  Lua: "#000080",
};

// -- Data Fetching --

async function fetchAvatarBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${url}&s=96`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

function cleanBio(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchGitHub(username: string) {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const [profileRes, eventsRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      next: { revalidate: 300 },
    }),
    fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/events?per_page=100`,
      { headers, next: { revalidate: 300 } }
    ),
    fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`,
      { headers, next: { revalidate: 300 } }
    ),
  ]);

  if (!profileRes.ok) return null;

  const [profile, events, repos] = await Promise.all([
    profileRes.json(),
    eventsRes.json(),
    reposRes.json(),
  ]);

  const evList = Array.isArray(events) ? events : [];
  const repoList = Array.isArray(repos) ? repos : [];

  const commits = evList
    .filter((e: { type: string }) => e.type === "PushEvent")
    .reduce(
      (s: number, e: { payload?: { commits?: unknown[] } }) =>
        s + (e.payload?.commits?.length || 0),
      0
    );

  const prs = evList.filter(
    (e: { type: string }) => e.type === "PullRequestEvent"
  ).length;

  const stars = repoList.reduce(
    (s: number, r: { stargazers_count?: number }) => s + (r.stargazers_count || 0),
    0
  );

  // Language stats
  const langMap: Record<string, number> = {};
  repoList.forEach((r: { language?: string }) => {
    if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1;
  });
  const totalLangRepos = Object.values(langMap).reduce((a, b) => a + b, 0);
  const langStats: LangStat[] = Object.entries(langMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
      percent: totalLangRepos > 0 ? Math.round((count / totalLangRepos) * 100) : 0,
    }));

  // Top repos by recently updated (non-fork)
  const topRepos: RepoInfo[] = repoList
    .filter((r: { fork?: boolean }) => !r.fork)
    .slice(0, 6)
    .map((r: { name: string; language?: string }) => ({
      name: r.name,
      language: r.language || null,
    }));

  // Contributions (GraphQL)
  let contributions: ContribData | null = null;
  if (token) {
    try {
      const gqlRes = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: `query($u:String!){user(login:$u){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionLevel}}}}}}`,
          variables: { u: username },
        }),
        next: { revalidate: 300 },
      });
      if (gqlRes.ok) {
        const gql = await gqlRes.json();
        const cal = gql?.data?.user?.contributionsCollection?.contributionCalendar;
        if (cal) {
          const lm: Record<string, number> = {
            NONE: 0,
            FIRST_QUARTILE: 1,
            SECOND_QUARTILE: 2,
            THIRD_QUARTILE: 3,
            FOURTH_QUARTILE: 4,
          };
          contributions = {
            total: cal.totalContributions,
            weeks: cal.weeks.map(
              (w: { contributionDays: { contributionLevel: string }[] }) => ({
                days: w.contributionDays.map((d: { contributionLevel: string }) => ({
                  level: lm[d.contributionLevel] ?? 0,
                })),
              })
            ),
          };
        }
      }
    } catch {
      // skip
    }
  }

  // Avatar
  let avatarBase64: string | null = null;
  if (profile.avatar_url) {
    avatarBase64 = await fetchAvatarBase64(profile.avatar_url);
  }

  const rawBio = profile.bio ? cleanBio(profile.bio) : null;

  return {
    profile: {
      name: profile.name,
      login: profile.login,
      avatar_url: profile.avatar_url,
      bio: rawBio || null,
      public_repos: profile.public_repos,
      followers: profile.followers,
    } as ProfileData,
    commits,
    prs,
    stars,
    langStats,
    topRepos,
    contributions,
    avatarBase64,
  };
}

async function fetchZenn(username: string): Promise<ZennData | null> {
  try {
    const res = await fetch(
      `https://zenn.dev/api/articles?username=${encodeURIComponent(username)}&order=latest&count=20`,
      { headers: { Accept: "application/json" }, next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rawArticles: {
      title?: string;
      emoji?: string;
      liked_count?: number;
    }[] = data.articles || [];

    const allArticles = rawArticles.map((a) => ({
      title: a.title || "",
      emoji: a.emoji || "",
      likes: a.liked_count || 0,
    }));

    const totalLikes = allArticles.reduce((s, a) => s + a.likes, 0);

    // Filter out 0-like articles, sort by likes desc, take top 6
    const topArticles = allArticles
      .filter((a) => a.likes > 0)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 6);

    return {
      count: allArticles.length,
      totalLikes,
      articles: topArticles,
    };
  } catch {
    return null;
  }
}

// -- SVG Helpers --

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trunc(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "\u2026";
}

// -- SVG Icons (12x12) --

const ICON = {
  contrib: `<path d="M6 1a5 5 0 0 0-3.5 8.57v.01A5 5 0 0 0 6 11a5 5 0 0 0 3.5-1.42A5 5 0 0 0 6 1zm0 7.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>`,
  pr: `<path d="M3 2.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm9 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM1.5 4v4M10.5 4v4M1.5 4c0-1 .5-2 2-2h3M10.5 4c0-1-.5-2-2-2h-3"/>`,
  star: `<path d="M6 .5l1.76 3.57 3.94.57-2.85 2.78.67 3.93L6 9.5l-3.52 1.85.67-3.93L.3 4.64l3.94-.57z"/>`,
  repo: `<path d="M1 1.75C1 .784 1.784 0 2.75 0h6.5C10.216 0 11 .784 11 1.75v8.5A1.75 1.75 0 019.25 12H2.75A1.75 1.75 0 011 10.25zm1.75-.25a.25.25 0 00-.25.25v8.5c0 .138.112.25.25.25h6.5a.25.25 0 00.25-.25v-8.5a.25.25 0 00-.25-.25zM3.5 3h5v1.5h-5z"/>`,
  followers: `<path d="M5.5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4-1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM1 10.5c0-2 1.5-3.5 4.5-3.5s4.5 1.5 4.5 3.5v.5H1zm8-1c1.5.3 2.5 1 2.5 2v.5h-2"/>`,
  heart: `<path d="M6 10.5C3.5 8.5 1 6.5 1 4.5 1 2.5 2.5 1 4 1c1 0 1.7.5 2 1 .3-.5 1-1 2-1 1.5 0 3 1.5 3 3.5 0 2-2.5 4-5 6z"/>`,
};

// -- SVG Generation --

function generateSvg(opts: {
  ghUser: string;
  profile: ProfileData;
  commits: number;
  prs: number;
  stars: number;
  langStats: LangStat[];
  topRepos: RepoInfo[];
  contributions: ContribData | null;
  avatarBase64: string | null;
  zenn: ZennData | null;
  zennUser: string;
  dark: boolean;
}) {
  const {
    ghUser,
    profile,
    commits,
    prs,
    stars,
    langStats,
    topRepos,
    contributions,
    avatarBase64,
    zenn,
    zennUser,
    dark,
  } = opts;

  const W = 600;
  const PAD = 24;
  const INNER = W - PAD * 2;

  // Colors
  const bg = dark ? "#0d1117" : "#ffffff";
  const bg2 = dark ? "#161b22" : "#f6f8fa";
  const border = dark ? "#30363d" : "#d0d7de";
  const textMain = dark ? "#e6edf3" : "#1f2328";
  const textSub = dark ? "#8b949e" : "#656d76";
  const accent = dark ? "#58a6ff" : "#0969da";
  const accentSoft = dark ? "rgba(56,139,253,0.15)" : "rgba(9,105,218,0.08)";
  const heartColor = dark ? "#f778ba" : "#cf222e";
  const contribColors = dark
    ? ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"]
    : ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

  const displayName = esc(profile.name || profile.login);
  const bio = profile.bio && profile.bio.length > 0 ? esc(trunc(profile.bio, 70)) : "";

  const hasContrib = contributions && contributions.total > 0;
  const hasZenn = zenn && zennUser;
  const hasZennArticles = hasZenn && zenn!.articles.length > 0;
  const hasRepos = topRepos.length > 0;
  const hasLangs = langStats.length > 0;

  // ---- Calculate total height ----
  const headerH = bio ? 100 : 80;
  const summaryH = 64;
  const contribH = hasContrib ? 110 : 0;
  const langRowH = 28;
  const langSectionH = hasLangs ? 30 + langStats.length * langRowH + 8 : 0;
  const repoRowH = 26;
  const repoSectionH = hasRepos ? 30 + topRepos.length * repoRowH + 8 : 0;
  const langsAndReposH = Math.max(langSectionH, repoSectionH);
  const zennSummaryH = hasZenn ? 46 : 0;
  const zennArticleRowH = 28;
  const zennArticlesH = hasZennArticles ? zenn!.articles.length * zennArticleRowH + 8 : 0;
  const footerH = 12;
  const totalH =
    headerH +
    summaryH +
    contribH +
    langsAndReposH +
    zennSummaryH +
    zennArticlesH +
    footerH;

  let y = 0;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}" fill="none">
<style>
  .t{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
  .main{fill:${textMain}}.sub{fill:${textSub}}.acc{fill:${accent}}
</style>
<rect width="${W}" height="${totalH}" rx="10" fill="${bg}" stroke="${border}" stroke-width="1"/>
`;

  // ========== HEADER ==========
  svg += `<rect width="${W}" height="${headerH}" rx="10" fill="${bg2}"/>`;
  svg += `<rect x="0" y="${headerH - 10}" width="${W}" height="10" fill="${bg2}"/>`;
  svg += `<line x1="0" y1="${headerH}" x2="${W}" y2="${headerH}" stroke="${border}" stroke-width="1"/>`;

  // Avatar
  const avatarSize = 56;
  const avatarX = PAD;
  const avatarY = Math.round((headerH - avatarSize) / 2);
  if (avatarBase64) {
    svg += `<defs><clipPath id="ac"><circle cx="${avatarX + avatarSize / 2}" cy="${avatarY + avatarSize / 2}" r="${avatarSize / 2}"/></clipPath></defs>`;
    svg += `<image href="${avatarBase64}" x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" clip-path="url(#ac)"/>`;
    svg += `<circle cx="${avatarX + avatarSize / 2}" cy="${avatarY + avatarSize / 2}" r="${avatarSize / 2}" stroke="${border}" stroke-width="1.5" fill="none"/>`;
  } else {
    svg += `<circle cx="${avatarX + avatarSize / 2}" cy="${avatarY + avatarSize / 2}" r="${avatarSize / 2}" fill="${accentSoft}" stroke="${border}" stroke-width="1"/>`;
    svg += `<text x="${avatarX + avatarSize / 2}" y="${avatarY + avatarSize / 2 + 7}" class="t acc" font-size="22" font-weight="700" text-anchor="middle">${esc(profile.login.charAt(0).toUpperCase())}</text>`;
  }

  const tx = avatarX + avatarSize + 16;
  let ty = bio ? avatarY + 20 : avatarY + 24;
  svg += `<text x="${tx}" y="${ty}" class="t main" font-size="18" font-weight="700">${displayName}</text>`;
  ty += 18;
  svg += `<text x="${tx}" y="${ty}" class="t sub" font-size="12">@${esc(ghUser)}${zennUser ? ` / Zenn: ${esc(zennUser)}` : ""}</text>`;
  if (bio) {
    ty += 18;
    svg += `<text x="${tx}" y="${ty}" class="t sub" font-size="11.5">${bio}</text>`;
  }

  y = headerH;

  // ========== SUMMARY STATS ==========
  y += 10;
  const contribTotal = contributions?.total ?? 0;
  const items = [
    {
      icon: ICON.contrib,
      label: "Contribs",
      value: contribTotal > 0 ? contribTotal.toLocaleString() : commits.toLocaleString(),
    },
    { icon: ICON.pr, label: "PRs", value: prs.toLocaleString() },
    { icon: ICON.star, label: "Stars", value: stars.toLocaleString() },
    {
      icon: ICON.repo,
      label: "Repos",
      value: profile.public_repos.toLocaleString(),
    },
    {
      icon: ICON.followers,
      label: "Followers",
      value: profile.followers.toLocaleString(),
    },
  ];

  const colW = INNER / items.length;
  items.forEach((item, i) => {
    const cx = PAD + colW * i + colW / 2;
    svg += `<g transform="translate(${cx - 7}, ${y}) scale(1.15)"><g fill="${accent}" stroke="${accent}" stroke-width="0.3">${item.icon}</g></g>`;
    svg += `<text x="${cx}" y="${y + 28}" class="t main" font-size="15" font-weight="700" text-anchor="middle">${item.value}</text>`;
    svg += `<text x="${cx}" y="${y + 42}" class="t sub" font-size="10" text-anchor="middle">${item.label}</text>`;
  });

  y += summaryH;
  svg += `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${border}" stroke-width="0.5" stroke-dasharray="4,3"/>`;

  // ========== CONTRIBUTION GRAPH ==========
  if (hasContrib) {
    y += 14;
    svg += `<text x="${PAD}" y="${y + 12}" class="t main" font-size="13" font-weight="600">${contributions!.total.toLocaleString()} contributions in the last year</text>`;
    y += 24;

    const weeks = contributions!.weeks.slice(-52);
    const numCols = weeks.length;
    const gap = 2;
    const cellSize = Math.min(9, Math.floor((INNER - (numCols - 1) * gap) / numCols));
    const step = cellSize + gap;
    const graphW = numCols * step - gap;
    const graphX = PAD + Math.floor((INNER - graphW) / 2);

    weeks.forEach((w, wi) => {
      w.days.forEach((d, di) => {
        svg += `<rect x="${graphX + wi * step}" y="${y + di * step}" width="${cellSize}" height="${cellSize}" rx="2" fill="${contribColors[d.level]}"/>`;
      });
    });

    const legendY = y + 7 * step + 8;
    svg += `<text x="${W - PAD}" y="${legendY}" class="t sub" font-size="9" text-anchor="end">More</text>`;
    const lx = W - PAD - 30;
    contribColors
      .slice()
      .reverse()
      .forEach((c, i) => {
        svg += `<rect x="${lx - i * 14}" y="${legendY - 9}" width="10" height="10" rx="2" fill="${c}"/>`;
      });
    svg += `<text x="${lx - 5 * 14 - 4}" y="${legendY}" class="t sub" font-size="9" text-anchor="end">Less</text>`;

    y = legendY + 12;
    svg += `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${border}" stroke-width="0.5" stroke-dasharray="4,3"/>`;
  }

  // ========== LANGUAGES + REPOS (two columns) ==========
  const secTop = y + 14;
  const halfW = Math.floor(INNER / 2) - 12;

  // Left: Languages
  if (hasLangs) {
    let ly = secTop;
    svg += `<text x="${PAD}" y="${ly + 12}" class="t acc" font-size="13" font-weight="600">Languages</text>`;
    ly += 28;

    const barW = halfW - 80;
    langStats.forEach((lang) => {
      const color = LANG_COLORS[lang.name] || (dark ? "#8b949e" : "#6e7781");
      svg += `<rect x="${PAD}" y="${ly}" width="${barW}" height="10" rx="5" fill="${dark ? "#21262d" : "#eef1f5"}"/>`;
      const fillW = Math.max(6, (lang.percent / 100) * barW);
      svg += `<rect x="${PAD}" y="${ly}" width="${fillW}" height="10" rx="5" fill="${color}"/>`;
      svg += `<text x="${PAD + barW + 10}" y="${ly + 9}" class="t main" font-size="12">${esc(lang.name)}</text>`;
      svg += `<text x="${PAD + halfW}" y="${ly + 9}" class="t sub" font-size="11" text-anchor="end">${lang.percent}%</text>`;
      ly += langRowH;
    });
  }

  // Right: Repos
  if (hasRepos) {
    let ry = secTop;
    const rx = PAD + halfW + 24;
    svg += `<text x="${rx}" y="${ry + 12}" class="t acc" font-size="13" font-weight="600">Repositories</text>`;
    ry += 28;

    topRepos.forEach((repo) => {
      const lc = repo.language ? LANG_COLORS[repo.language] || textSub : "transparent";
      svg += `<circle cx="${rx + 5}" cy="${ry + 5}" r="4" fill="${lc}"/>`;
      svg += `<text x="${rx + 14}" y="${ry + 9}" class="t main" font-size="12">${esc(trunc(repo.name, 28))}</text>`;
      ry += repoRowH;
    });
  }

  y = secTop + langsAndReposH;

  // ========== ZENN ==========
  if (hasZenn) {
    svg += `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${border}" stroke-width="0.5" stroke-dasharray="4,3"/>`;
    y += 14;

    // Header row: Zenn badge + summary
    const badgeW = 50;
    svg += `<rect x="${PAD}" y="${y}" width="${badgeW}" height="22" rx="5" fill="${accentSoft}"/>`;
    svg += `<text x="${PAD + badgeW / 2}" y="${y + 15}" class="t acc" font-size="12" font-weight="700" text-anchor="middle">Zenn</text>`;
    svg += `<text x="${PAD + badgeW + 14}" y="${y + 15}" class="t sub" font-size="12">${zenn!.count} articles</text>`;
    svg += `<text x="${PAD + badgeW + 100}" y="${y + 15}" class="t sub" font-size="12">/</text>`;
    svg += `<g transform="translate(${PAD + badgeW + 114}, ${y + 5}) scale(1)"><g fill="${heartColor}" stroke="none">${ICON.heart}</g></g>`;
    svg += `<text x="${PAD + badgeW + 130}" y="${y + 15}" class="t main" font-size="12" font-weight="600">${zenn!.totalLikes.toLocaleString()}</text>`;
    y += zennSummaryH;

    // Article list
    if (hasZennArticles) {
      zenn!.articles.forEach((article) => {
        // Emoji
        svg += `<text x="${PAD + 4}" y="${y + 8}" font-size="14">${article.emoji}</text>`;
        // Title
        svg += `<text x="${PAD + 26}" y="${y + 8}" class="t main" font-size="12">${esc(trunc(article.title, 48))}</text>`;
        // Heart + likes
        svg += `<g transform="translate(${W - PAD - 38}, ${y - 2}) scale(0.9)"><g fill="${heartColor}" stroke="none">${ICON.heart}</g></g>`;
        svg += `<text x="${W - PAD}" y="${y + 8}" class="t sub" font-size="11" text-anchor="end">${article.likes}</text>`;
        y += zennArticleRowH;
      });
    }
  }

  svg += `</svg>`;
  return svg;
}

// -- Route Handler --

export async function GET(req: NextRequest) {
  const ghUser = req.nextUrl.searchParams.get("gh") || "";
  const zennUser = req.nextUrl.searchParams.get("zenn") || "";
  const dark = req.nextUrl.searchParams.get("dark") === "1";

  if (!ghUser) {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="40"><text x="10" y="25" font-size="14" fill="#cf222e">Error: gh parameter is required</text></svg>`,
      {
        status: 400,
        headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
      }
    );
  }

  try {
    const ghData = await fetchGitHub(ghUser);
    if (!ghData) {
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="40"><text x="10" y="25" font-size="14" fill="#cf222e">User not found: ${esc(ghUser)}</text></svg>`,
        {
          status: 404,
          headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
        }
      );
    }

    const zennData = zennUser ? await fetchZenn(zennUser) : null;

    const svg = generateSvg({
      ghUser,
      profile: ghData.profile,
      commits: ghData.commits,
      prs: ghData.prs,
      stars: ghData.stars,
      langStats: ghData.langStats,
      topRepos: ghData.topRepos,
      contributions: ghData.contributions,
      avatarBase64: ghData.avatarBase64,
      zenn: zennData,
      zennUser,
      dark,
    });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="40"><text x="10" y="25" font-size="14" fill="#cf222e">Internal error</text></svg>`,
      {
        status: 500,
        headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
      }
    );
  }
}
