import { NextRequest, NextResponse } from "next/server";

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

    return NextResponse.json({
      profile,
      events: Array.isArray(events) ? events : [],
      repos: Array.isArray(repos) ? repos : [],
    });
  } catch {
    return NextResponse.json(
      { error: "GitHub APIへの接続に失敗しました" },
      { status: 502 }
    );
  }
}
