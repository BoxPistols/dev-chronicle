import { NextRequest, NextResponse } from "next/server";

async function fetchContributions(username: string, token: string) {
  const query = `
    query($username: String!) {
      user(login: $username) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables: { username } }),
    next: { revalidate: 300 },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const cal =
    data?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) return null;

  const levelMap: Record<string, number> = {
    NONE: 0,
    FIRST_QUARTILE: 1,
    SECOND_QUARTILE: 2,
    THIRD_QUARTILE: 3,
    FOURTH_QUARTILE: 4,
  };

  return {
    total: cal.totalContributions as number,
    weeks: (
      cal.weeks as {
        contributionDays: {
          date: string;
          contributionCount: number;
          contributionLevel: string;
        }[];
      }[]
    ).map((w) => ({
      days: w.contributionDays.map((d) => ({
        date: d.date,
        count: d.contributionCount,
        level: levelMap[d.contributionLevel] ?? 0,
      })),
    })),
  };
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const fetches: Promise<Response>[] = [
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
    ];

    const [profileRes, eventsRes, reposRes] = await Promise.all(fetches);

    if (!profileRes.ok) {
      return NextResponse.json(
        { error: `GitHubユーザー「${username}」が見つかりません` },
        { status: profileRes.status }
      );
    }

    const [profile, events, repos] = await Promise.all([
      profileRes.json(),
      eventsRes.json(),
      reposRes.json(),
    ]);

    // コントリビューションデータ（トークンがある場合のみ）
    let contributions = null;
    if (token) {
      try {
        contributions = await fetchContributions(username, token);
      } catch {
        // GraphQL失敗時はスキップ
      }
    }

    return NextResponse.json({
      profile,
      events: Array.isArray(events) ? events : [],
      repos: Array.isArray(repos) ? repos : [],
      ...(contributions ? { contributions } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "GitHub APIへの接続に失敗しました" },
      { status: 502 }
    );
  }
}
