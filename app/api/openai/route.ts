import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type NewsArticle = { title: string; excerpt: string; content: string; slug: string };

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!apiKey) return NextResponse.json({ error: "OpenAI अजून configure केलेले नाही." }, { status: 503 });
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Supabase configuration उपलब्ध नाही." }, { status: 503 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Authentication आवश्यक आहे." }, { status: 401 });
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Session invalid आहे. पुन्हा login करा." }, { status: 401 });

  const body = await request.json().catch(() => null) as { rawInfo?: unknown } | null;
  const rawInfo = typeof body?.rawInfo === "string" ? body.rawInfo.trim() : "";
  if (rawInfo.length < 20) return NextResponse.json({ error: "किमान 20 अक्षरांची raw माहिती द्या." }, { status: 400 });
  if (rawInfo.length > 12000) return NextResponse.json({ error: "Raw माहिती 12,000 अक्षरांपेक्षा कमी ठेवा." }, { status: 400 });

  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "none" },
        max_output_tokens: 3500,
        input: [
          { role: "developer", content: [{ type: "input_text", text: "तुम्ही अनुभवी मराठी वृत्तसंपादक आहात. दिलेल्या notes मध्ये नसलेली नावे, आकडे, quotes किंवा तथ्ये बनवू नका. स्पष्ट, व्यावसायिक मराठी वापरा. Title संक्षिप्त, excerpt 1-2 वाक्ये, content सविस्तर आणि slug लहान hyphen-separated ठेवा." }] },
          { role: "user", content: [{ type: "input_text", text: `या raw notes वर आधारित बातमी तयार करा:\n\n${rawInfo}` }] },
        ],
        text: { format: { type: "json_schema", name: "lokhit_news_article", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["title", "excerpt", "content", "slug"],
          properties: { title: { type: "string" }, excerpt: { type: "string" }, content: { type: "string" }, slug: { type: "string" } },
        } } },
      }),
      signal: AbortSignal.timeout(45000),
    });
    const payload = await response.json();
    if (!response.ok) return NextResponse.json({ error: payload?.error?.message || "OpenAI request अयशस्वी झाली." }, { status: 502 });
    const text = payload?.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? []).find((part: { type?: string }) => part.type === "output_text")?.text;
    if (!text) return NextResponse.json({ error: "OpenAI कडून article मिळाला नाही." }, { status: 502 });
    const article = JSON.parse(text) as NewsArticle;
    if (!article.title || !article.content) return NextResponse.json({ error: "OpenAI response अपूर्ण आहे." }, { status: 502 });
    return NextResponse.json({ article });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json({ error: timedOut ? "OpenAI request timeout झाली. पुन्हा प्रयत्न करा." : "OpenAI response process करता आली नाही." }, { status: 502 });
  }
}

