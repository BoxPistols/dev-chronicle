import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `https://zenn.dev/api/articles?username=${encodeURIComponent(username)}&order=latest&count=20`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Zennユーザー「${username}」の取得に失敗しました` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ articles: data.articles || [] });
  } catch {
    return NextResponse.json(
      { error: "Zenn APIへの接続に失敗しました" },
      { status: 502 }
    );
  }
}
