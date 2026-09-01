import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type GeminiArticle = { title: string; excerpt: string; content: string; slug: string };

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!apiKey) return NextResponse.json({ error: "Gemini AI अजून configure केलेले नाही." }, { status: 503 });
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

  const model = process.env.GEMINI_MODEL || "gemini-3.7-flash";
  const prompt = `तुम्ही अनुभवी मराठी वृत्तसंपादक आहात. खालील raw notes वर आधारित तथ्यनिष्ठ बातमी तयार करा. Notes मध्ये नसलेली नावे, आकडे, quotes किंवा तथ्ये बनवू नका. स्पष्ट, व्यावसायिक मराठी वापरा. title संक्षिप्त ठेवा, excerpt 1-2 वाक्ये, content सविस्तर बातमी, आणि slug लहान lowercase Latin किंवा देवनागरी hyphen-separated ठेवा.\n\nRAW NOTES:\n${rawInfo}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            required: ["title", "excerpt", "content", "slug"],
            properties: { title: { type: "STRING" }, excerpt: { type: "STRING" }, content: { type: "STRING" }, slug: { type: "STRING" } },
          },
        },
      }),
      signal: AbortSignal.timeout(45000),
    });
    const payload = await response.json();
    if (!response.ok) return NextResponse.json({ error: payload?.error?.message || "Gemini request अयशस्वी झाली." }, { status: 502 });
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return NextResponse.json({ error: "Gemini कडून article मिळाला नाही." }, { status: 502 });
    const article = JSON.parse(text) as GeminiArticle;
    if (!article.title || !article.content) return NextResponse.json({ error: "Gemini response अपूर्ण आहे." }, { status: 502 });
    return NextResponse.json({ article });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json({ error: timedOut ? "Gemini request timeout झाली. पुन्हा प्रयत्न करा." : "Gemini response process करता आली नाही." }, { status: 502 });
  }
}

