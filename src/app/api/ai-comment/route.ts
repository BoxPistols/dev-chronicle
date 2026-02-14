import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT =
  "あなたは週刊技術新聞のAI編集者です。以下のデータを元に開発者の活動を振り返る所感（4〜6文、日本語、新聞コラム調の温かみある文体）を書いてください。注意事項: コンテンツ/ブログ系リポジトリ(zenn-contentなど)はブログ記事のアーカイブなのでプロダクト開発とは区別すること。プロフィールに記載のURLリンク先(Dribbble, Medium等)の活動内容は推測で書かないこと。実際のコード開発活動に焦点を当ててください。";

async function callOpenAI(
  apiKey: string,
  model: string,
  summary: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: summary },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function _callAnthropic(
  apiKey: string,
  model: string,
  summary: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${SYSTEM_PROMPT}\n\n${summary}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await res.json();
  return data.content?.map((b: { text?: string }) => b.text || "").join("") || "";
}

async function _callGemini(
  apiKey: string,
  model: string,
  summary: string
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${SYSTEM_PROMPT}\n\n${summary}` }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await res.json();
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || "")
      .join("") || ""
  );
}

// -- Rate limiting (in-memory, 3 requests/day per IP) --

const DAILY_LIMIT = 3;
const rateLimitStore = new Map<string, number>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${ip}:${today}`;

  // purge stale entries from previous days
  for (const k of rateLimitStore.keys()) {
    if (!k.endsWith(today)) rateLimitStore.delete(k);
  }

  const count = rateLimitStore.get(key) || 0;
  if (count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  rateLimitStore.set(key, count + 1);
  return { allowed: true, remaining: DAILY_LIMIT - count - 1 };
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

// -- POST handler (fixed to OpenAI gpt-4.1-nano) --

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, remaining } = checkRateLimit(ip);

    if (!allowed) {
      return NextResponse.json(
        { error: "AI所感の生成は1日3回までです。明日またお試しください。" },
        {
          status: 429,
          headers: { "X-RateLimit-Remaining": "0" },
        }
      );
    }

    const { summary } = await req.json();
    if (!summary) {
      return NextResponse.json({ error: "summary is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const text = await callOpenAI(apiKey, "gpt-4.1-nano", summary);

    return NextResponse.json(
      { comment: text },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI所感の生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
