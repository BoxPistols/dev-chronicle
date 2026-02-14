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
  stars: number;
  language: string | null;
  description: string | null;
}

interface ZennStats {
  count: number;
  likes: number;
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
    const res = await fetch(`${url}&s=80`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
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
    (s: number, r: { stargazers_count?: number }) =>
      s + (r.stargazers_count || 0),
    0
  );

  // Language stats with counts
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

  // Top repos by stars (non-fork)
  const topRepos: RepoInfo[] = repoList
    .filter((r: { fork?: boolean }) => !r.fork)
    .sort(
      (a: { stargazers_count?: number }, b: { stargazers_count?: number }) =>
        (b.stargazers_count || 0) - (a.stargazers_count || 0)
    )
    .slice(0, 5)
    .map(
      (r: {
        name: string;
        stargazers_count?: number;
        language?: string;
        description?: string;
      }) => ({
        name: r.name,
        stars: r.stargazers_count || 0,
        language: r.language || null,
        description: r.description || null,
      })
    );

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
        const cal =
          gql?.data?.user?.contributionsCollection?.contributionCalendar;
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
              (w: {
                contributionDays: { contributionLevel: string }[];
              }) => ({
                days: w.contributionDays.map(
                  (d: { contributionLevel: string }) => ({
                    level: lm[d.contributionLevel] ?? 0,
                  })
                ),
              })
            ),
          };
        }
      }
    } catch {
      // skip
    }
  }

  // Fetch avatar as base64
  let avatarBase64: string | null = null;
  if (profile.avatar_url) {
    avatarBase64 = await fetchAvatarBase64(profile.avatar_url);
  }

  return {
    profile: {
      name: profile.name,
      login: profile.login,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
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

async function fetchZenn(username: string): Promise<ZennStats | null> {
  try {
    const res = await fetch(
      `https://zenn.dev/api/articles?username=${encodeURIComponent(username)}&order=latest&count=20`,
      { headers: { Accept: "application/json" }, next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const articles = data.articles || [];
    return {
      count: articles.length,
      likes: articles.reduce(
        (s: number, a: { liked_count?: number }) =>
          s + (a.liked_count || 0),
        0
      ),
    };
  } catch {
    return null;
  }
}

// -- SVG Helpers --

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "...";
}

// -- SVG Icons (12x12 viewBox paths) --

const ICON = {
  commit: `<path d="M6 1a5 5 0 0 0-3.5 8.57v.01A5 5 0 0 0 6 11a5 5 0 0 0 3.5-1.42A5 5 0 0 0 6 1zm0 7.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>`,
  pr: `<path d="M3 2.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm9 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM1.5 4v4M10.5 4v4M1.5 4c0-1 .5-2 2-2h3M10.5 4c0-1-.5-2-2-2h-3"/>`,
  star: `<path d="M6 .5l1.76 3.57 3.94.57-2.85 2.78.67 3.93L6 9.5l-3.52 1.85.67-3.93L.3 4.64l3.94-.57z"/>`,
  repo: `<path d="M1 1.75C1 .784 1.784 0 2.75 0h6.5C10.216 0 11 .784 11 1.75v8.5A1.75 1.75 0 019.25 12H2.75A1.75 1.75 0 011 10.25zm1.75-.25a.25.25 0 00-.25.25v8.5c0 .138.112.25.25.25h6.5a.25.25 0 00.25-.25v-8.5a.25.25 0 00-.25-.25zM3.5 3h5v1.5h-5z"/>`,
  followers: `<path d="M5.5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4-1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM1 10.5c0-2 1.5-3.5 4.5-3.5s4.5 1.5 4.5 3.5v.5H1zm8-1c1.5.3 2.5 1 2.5 2v.5h-2"/>`,
  zenn: `<path d="M1.5 1L6 11l4.5-10M1.5 6h9"/>`,
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
  zenn: ZennStats | null;
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

  const W = 500;
  const PAD = 20;
  const INNER = W - PAD * 2;

  // Colors
  const bg = dark ? "#0d1117" : "#ffffff";
  const bg2 = dark ? "#161b22" : "#f6f8fa";
  const border = dark ? "#30363d" : "#d0d7de";
  const textMain = dark ? "#e6edf3" : "#1f2328";
  const textSub = dark ? "#8b949e" : "#656d76";
  const accent = dark ? "#58a6ff" : "#0969da";
  const accentSoft = dark ? "rgba(56,139,253,0.15)" : "rgba(9,105,218,0.08)";
  const contribColors = dark
    ? ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"]
    : ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

  const displayName = escapeXml(profile.name || profile.login);
  const bio = profile.bio ? escapeXml(truncate(profile.bio.replace(/\n/g, " "), 80)) : "";

  const hasContrib = contributions && contributions.total > 0;
  const hasZenn = zenn && zennUser;
  const hasRepos = topRepos.length > 0;

  // -- Calculate total height --
  const headerH = bio ? 90 : 72;
  const summaryH = 54;
  const contribH = hasContrib ? 104 : 0;
  const langH = langStats.length > 0 ? 24 + langStats.length * 24 + 12 : 0;
  const repoH = hasRepos ? 24 + topRepos.length * 22 + 12 : 0;
  const langsAndReposH = Math.max(langH, repoH);
  const zennH = hasZenn ? 54 : 0;
  const footerH = 8;
  const totalH = headerH + summaryH + contribH + langsAndReposH + zennH + footerH;

  let y = 0;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}" fill="none">
<style>
  .t{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
  .main{fill:${textMain}}.sub{fill:${textSub}}.acc{fill:${accent}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .fade{animation:fadeIn .6s ease-in-out}
</style>
<rect width="${W}" height="${totalH}" rx="8" fill="${bg}" stroke="${border}" stroke-width="1"/>
`;

  // ====================== HEADER ======================
  svg += `<rect width="${W}" height="${headerH}" rx="8" fill="${bg2}"/>
<rect x="0" y="${headerH - 8}" width="${W}" height="8" fill="${bg2}"/>
<line x1="0" y1="${headerH}" x2="${W}" y2="${headerH}" stroke="${border}" stroke-width="1"/>
`;

  // Avatar
  const avatarSize = 48;
  const avatarX = PAD;
  const avatarY = bio ? 16 : 12;
  if (avatarBase64) {
    svg += `<defs><clipPath id="avatar-clip"><circle cx="${avatarX + avatarSize / 2}" cy="${avatarY + avatarSize / 2}" r="${avatarSize / 2}"/></clipPath></defs>
<image href="${avatarBase64}" x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" clip-path="url(#avatar-clip)" class="fade"/>
<circle cx="${avatarX + avatarSize / 2}" cy="${avatarY + avatarSize / 2}" r="${avatarSize / 2}" stroke="${border}" stroke-width="1.5" fill="none"/>
`;
  } else {
    // Placeholder circle with initial
    svg += `<circle cx="${avatarX + avatarSize / 2}" cy="${avatarY + avatarSize / 2}" r="${avatarSize / 2}" fill="${accentSoft}" stroke="${border}" stroke-width="1"/>
<text x="${avatarX + avatarSize / 2}" y="${avatarY + avatarSize / 2 + 6}" class="t acc" font-size="18" font-weight="700" text-anchor="middle">${escapeXml(profile.login.charAt(0).toUpperCase())}</text>
`;
  }

  // Name & subtitle
  const textX = avatarX + avatarSize + 12;
  svg += `<text x="${textX}" y="${avatarY + 18}" class="t main" font-size="16" font-weight="700">${displayName}</text>
<text x="${textX}" y="${avatarY + 34}" class="t sub" font-size="11">@${escapeXml(ghUser)}${zennUser ? ` / Zenn: ${escapeXml(zennUser)}` : ""}</text>
`;
  if (bio) {
    svg += `<text x="${textX}" y="${avatarY + 50}" class="t sub" font-size="10.5">${bio}</text>
`;
  }

  y = headerH;

  // ====================== SUMMARY STATS BAR ======================
  y += 8;
  const contribTotal = contributions?.total ?? 0;
  const summaryItems = [
    { icon: ICON.commit, label: "Contribs", value: contribTotal > 0 ? contribTotal.toLocaleString() : commits.toLocaleString() },
    { icon: ICON.pr, label: "PRs", value: prs.toLocaleString() },
    { icon: ICON.star, label: "Stars", value: stars.toLocaleString() },
    { icon: ICON.repo, label: "Repos", value: profile.public_repos.toLocaleString() },
    { icon: ICON.followers, label: "Followers", value: profile.followers.toLocaleString() },
  ];

  const colW = INNER / summaryItems.length;
  summaryItems.forEach((item, i) => {
    const cx = PAD + colW * i + colW / 2;
    // Icon
    svg += `<g transform="translate(${cx - 6}, ${y}) scale(1)"><g fill="${accent}" stroke="${accent}" stroke-width="0.3">${item.icon}</g></g>
`;
    // Value
    svg += `<text x="${cx}" y="${y + 24}" class="t main" font-size="13" font-weight="700" text-anchor="middle">${item.value}</text>
`;
    // Label
    svg += `<text x="${cx}" y="${y + 36}" class="t sub" font-size="9" text-anchor="middle">${item.label}</text>
`;
  });

  y += summaryH;

  // Divider
  svg += `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${border}" stroke-width="0.5" stroke-dasharray="3,3"/>
`;

  // ====================== CONTRIBUTION GRAPH ======================
  if (hasContrib) {
    y += 12;
    svg += `<text x="${PAD}" y="${y + 10}" class="t main" font-size="11" font-weight="600">${contributions!.total.toLocaleString()} contributions in the last year</text>
`;
    y += 20;

    // Draw heatmap -- fit within INNER width
    const weeks = contributions!.weeks.slice(-52);
    const maxCols = weeks.length;
    const gap = 2;
    const cellSize = Math.min(8, Math.floor((INNER - (maxCols - 1) * gap) / maxCols));
    const step = cellSize + gap;
    const graphW = maxCols * step - gap;
    const graphX = PAD + Math.floor((INNER - graphW) / 2);

    weeks.forEach((w, wi) => {
      w.days.forEach((d, di) => {
        svg += `<rect x="${graphX + wi * step}" y="${y + di * step}" width="${cellSize}" height="${cellSize}" rx="1.5" fill="${contribColors[d.level]}"/>`;
      });
    });
    svg += "\n";

    // Legend
    const legendY = y + 7 * step + 6;
    svg += `<text x="${W - PAD}" y="${legendY}" class="t sub" font-size="8" text-anchor="end">More</text>
`;
    const legendEndX = W - PAD - 26;
    contribColors.slice().reverse().forEach((c, i) => {
      svg += `<rect x="${legendEndX - i * 12}" y="${legendY - 8}" width="9" height="9" rx="1.5" fill="${c}"/>`;
    });
    svg += `\n<text x="${legendEndX - 5 * 12 - 2}" y="${legendY}" class="t sub" font-size="8" text-anchor="end">Less</text>
`;
    y = legendY + 10;

    // Divider
    svg += `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${border}" stroke-width="0.5" stroke-dasharray="3,3"/>
`;
  }

  // ====================== LANGUAGES + TOP REPOS (two columns) ======================
  const sectionY = y + 12;
  const halfW = INNER / 2 - 8;

  // Left column: Languages
  if (langStats.length > 0) {
    let ly = sectionY;
    svg += `<text x="${PAD}" y="${ly + 10}" class="t acc" font-size="11" font-weight="600">Languages</text>
`;
    ly += 22;

    const barW = halfW - 50;
    langStats.forEach((lang) => {
      const color = LANG_COLORS[lang.name] || (dark ? "#8b949e" : "#6e7781");
      // Bar background
      svg += `<rect x="${PAD}" y="${ly - 1}" width="${barW}" height="8" rx="4" fill="${dark ? "#21262d" : "#eef1f5"}"/>`;
      // Bar fill
      const fillW = Math.max(4, (lang.percent / 100) * barW);
      svg += `<rect x="${PAD}" y="${ly - 1}" width="${fillW}" height="8" rx="4" fill="${color}"/>`;
      // Name + percent
      svg += `<text x="${PAD + barW + 6}" y="${ly + 7}" class="t sub" font-size="10">${escapeXml(lang.name)}</text>`;
      svg += `<text x="${PAD + halfW}" y="${ly + 7}" class="t main" font-size="9.5" font-weight="600" text-anchor="end">${lang.percent}%</text>
`;
      ly += 24;
    });
  }

  // Right column: Top Repos
  if (hasRepos) {
    let ry = sectionY;
    const rightX = PAD + halfW + 16;
    svg += `<text x="${rightX}" y="${ry + 10}" class="t acc" font-size="11" font-weight="600">Top Repositories</text>
`;
    ry += 22;

    topRepos.forEach((repo) => {
      const langColor = repo.language
        ? LANG_COLORS[repo.language] || textSub
        : "transparent";
      // Language dot
      svg += `<circle cx="${rightX + 4}" cy="${ry + 3}" r="3.5" fill="${langColor}"/>`;
      // Repo name
      svg += `<text x="${rightX + 12}" y="${ry + 7}" class="t main" font-size="10.5" font-weight="500">${escapeXml(truncate(repo.name, 22))}</text>`;
      // Star icon + count
      if (repo.stars > 0) {
        svg += `<g transform="translate(${W - PAD - 30}, ${ry - 3}) scale(0.85)"><g fill="${dark ? "#e3b341" : "#d4a72c"}" stroke="none">${ICON.star}</g></g>`;
        svg += `<text x="${W - PAD}" y="${ry + 7}" class="t sub" font-size="10" text-anchor="end">${repo.stars}</text>`;
      }
      svg += "\n";
      ry += 22;
    });
  }

  y = sectionY + langsAndReposH;

  // ====================== ZENN ======================
  if (hasZenn) {
    svg += `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${border}" stroke-width="0.5" stroke-dasharray="3,3"/>
`;
    y += 12;

    // Zenn badge
    const badgeW = 42;
    svg += `<rect x="${PAD}" y="${y}" width="${badgeW}" height="18" rx="4" fill="${accentSoft}"/>
<text x="${PAD + badgeW / 2}" y="${y + 13}" class="t acc" font-size="10" font-weight="700" text-anchor="middle">Zenn</text>
`;

    // Stats
    svg += `<text x="${PAD + badgeW + 14}" y="${y + 13}" class="t sub" font-size="11">Articles</text>
<text x="${PAD + badgeW + 68}" y="${y + 13}" class="t main" font-size="12" font-weight="700">${zenn!.count}</text>
<text x="${PAD + badgeW + 100}" y="${y + 13}" class="t sub" font-size="11">Likes</text>
<text x="${PAD + badgeW + 138}" y="${y + 13}" class="t main" font-size="12" font-weight="700">${zenn!.likes.toLocaleString()}</text>
`;
    y += 34;
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
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="40"><text x="10" y="25" font-size="14" fill="#cf222e">Error: gh parameter is required</text></svg>`,
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
        `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="40"><text x="10" y="25" font-size="14" fill="#cf222e">User not found: ${escapeXml(ghUser)}</text></svg>`,
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
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="40"><text x="10" y="25" font-size="14" fill="#cf222e">Internal error</text></svg>`,
      {
        status: 500,
        headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
      }
    );
  }
}
