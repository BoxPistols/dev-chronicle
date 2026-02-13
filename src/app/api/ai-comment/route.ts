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

async function callAnthropic(
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
  return (
    data.content
      ?.map((b: { text?: string }) => b.text || "")
      .join("") || ""
  );
}

async function callGemini(
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

export async function POST(req: NextRequest) {
  try {
    const { summary, provider = "openai", model } = await req.json();
    if (!summary) {
      return NextResponse.json(
        { error: "summary is required" },
        { status: 400 }
      );
    }

    let text = "";

    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "OPENAI_API_KEY が設定されていません" },
          { status: 500 }
        );
      }
      text = await callOpenAI(apiKey, model || "gpt-4.1-nano", summary);
    } else if (provider === "anthropic") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "ANTHROPIC_API_KEY が設定されていません" },
          { status: 500 }
        );
      }
      text = await callAnthropic(
        apiKey,
        model || "claude-sonnet-4-20250514",
        summary
      );
    } else if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY が設定されていません" },
          { status: 500 }
        );
      }
      text = await callGemini(apiKey, model || "gemini-2.0-flash", summary);
    } else {
      return NextResponse.json(
        { error: `未対応のプロバイダ: ${provider}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ comment: text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI所感の生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
