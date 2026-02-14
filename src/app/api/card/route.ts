import { NextRequest } from "next/server";

// -- Data fetching --

interface ProfileData {
  name: string | null;
  login: string;
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

interface ZennStats {
  count: number;
  likes: number;
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
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=30`,
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

  const langMap: Record<string, number> = {};
  repoList.forEach((r: { language?: string }) => {
    if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1;
  });
  const topLangs = Object.entries(langMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang]) => lang);

  // Contributions (GraphQL, requires token)
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

  return {
    profile: profile as ProfileData,
    commits,
    prs,
    stars,
    topLangs,
    contributions,
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

// -- SVG Generation --

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateSvg(opts: {
  ghUser: string;
  profile: ProfileData;
  commits: number;
  prs: number;
  stars: number;
  topLangs: string[];
  contributions: ContribData | null;
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
    topLangs,
    contributions,
    zenn,
    zennUser,
    dark,
  } = opts;

  const bg = dark ? "#0d1117" : "#ffffff";
  const border = dark ? "#30363d" : "#d0d7de";
  const textMain = dark ? "#c9d1d9" : "#1f2328";
  const textSub = dark ? "#8b949e" : "#656d76";
  const accent = dark ? "#58a6ff" : "#0969da";
  const headerBg = dark ? "#161b22" : "#f6f8fa";

  const contribColors = dark
    ? ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"]
    : ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

  const displayName = escapeXml(profile.name || profile.login);

  // Contribution graph (last 26 weeks = ~6 months for compact display)
  let contribSvg = "";
  if (contributions) {
    const weeks = contributions.weeks.slice(-26);
    const cellSize = 8;
    const gap = 2;
    const step = cellSize + gap;
    const graphX = 20;
    const graphY = 0;

    weeks.forEach((w, wi) => {
      w.days.forEach((d, di) => {
        contribSvg += `<rect x="${graphX + wi * step}" y="${graphY + di * step}" width="${cellSize}" height="${cellSize}" rx="1.5" fill="${contribColors[d.level]}"/>`;
      });
    });
  }

  // Stats rows
  const stats = [
    { label: "Commits (recent)", value: commits.toLocaleString() },
    { label: "Pull Requests", value: prs.toLocaleString() },
    { label: "Stars", value: stars.toLocaleString() },
    { label: "Public Repos", value: profile.public_repos.toLocaleString() },
    { label: "Followers", value: profile.followers.toLocaleString() },
  ];

  const hasZenn = zenn && zennUser;
  const hasContrib = contributions && contributions.total > 0;

  // Dynamic height
  const statsH = stats.length * 22;
  const langH = topLangs.length > 0 ? 36 : 0;
  const zennH = hasZenn ? 52 : 0;
  const contribGraphH = hasContrib ? 90 : 0;
  const totalH = 70 + statsH + langH + zennH + contribGraphH + 20;
  const width = 420;

  let y = 0;

  // Header
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}" fill="none">
  <style>
    .t { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
    .main { fill: ${textMain}; }
    .sub { fill: ${textSub}; }
    .accent { fill: ${accent}; }
  </style>
  <rect width="${width}" height="${totalH}" rx="6" fill="${bg}" stroke="${border}" stroke-width="1"/>

  <!-- Header -->
  <rect width="${width}" height="50" rx="6" fill="${headerBg}"/>
  <rect x="0" y="44" width="${width}" height="6" fill="${headerBg}"/>
  <line x1="0" y1="50" x2="${width}" y2="50" stroke="${border}" stroke-width="1"/>
  <text x="20" y="28" class="t main" font-size="15" font-weight="600">${displayName}</text>
  <text x="20" y="43" class="t sub" font-size="11">@${escapeXml(ghUser)}${zennUser ? ` / Zenn: ${escapeXml(zennUser)}` : ""}</text>
`;

  y = 62;

  // Contribution total
  if (hasContrib) {
    svg += `  <text x="20" y="${y}" class="t main" font-size="12" font-weight="600">${contributions!.total.toLocaleString()} contributions in the last year</text>`;
    y += 16;
    // Mini contribution graph
    svg += `  <g transform="translate(0, ${y})">
    ${contribSvg}
    <g transform="translate(${20 + 26 * 10}, ${7 * 10 - 6})">
      <text class="t sub" font-size="8" text-anchor="end" x="-4" y="0">Less</text>
      ${contribColors.map((c, i) => `<rect x="${i * 12}" y="-7" width="8" height="8" rx="1.5" fill="${c}"/>`).join("")}
      <text class="t sub" font-size="8" x="${5 * 12 + 2}" y="0">More</text>
    </g>
  </g>`;
    y += 76;
  }

  // Stats
  svg += `  <text x="20" y="${y}" class="t accent" font-size="11" font-weight="600">GitHub Stats</text>`;
  y += 6;
  stats.forEach((s) => {
    y += 20;
    svg += `
  <text x="20" y="${y}" class="t sub" font-size="12">${s.label}</text>
  <text x="${width - 20}" y="${y}" class="t main" font-size="12" font-weight="600" text-anchor="end">${s.value}</text>`;
  });

  // Languages
  if (topLangs.length > 0) {
    y += 28;
    svg += `  <text x="20" y="${y}" class="t accent" font-size="11" font-weight="600">Top Languages</text>`;
    y += 16;
    svg += `  <text x="20" y="${y}" class="t sub" font-size="11">${topLangs.map(escapeXml).join("  ·  ")}</text>`;
  }

  // Zenn
  if (hasZenn) {
    y += 28;
    svg += `  <text x="20" y="${y}" class="t accent" font-size="11" font-weight="600">Zenn</text>`;
    y += 18;
    svg += `
  <text x="20" y="${y}" class="t sub" font-size="12">Articles</text>
  <text x="150" y="${y}" class="t main" font-size="12" font-weight="600">${zenn!.count}</text>
  <text x="200" y="${y}" class="t sub" font-size="12">Likes</text>
  <text x="300" y="${y}" class="t main" font-size="12" font-weight="600">${zenn!.likes.toLocaleString()}</text>`;
  }

  svg += `\n</svg>`;
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
      topLangs: ghData.topLangs,
      contributions: ghData.contributions,
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
