import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type NewsArticle = { title: string; excerpt: string; content: string; slug: string; seoKeywords: string[] };

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

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const researchPrompt = `Google Search वापरून खालील raw news notes मधील घटना, व्यक्ती, ठिकाण, तारीख, quotes आणि पार्श्वभूमी तपासा. किमान दोन स्वतंत्र व विश्वसनीय वृत्तस्रोत शोधा. फक्त पडताळलेली माहिती, मतभेद आणि उपलब्ध संदर्भ यांचा संक्षिप्त research brief तयार करा. कोणतीही माहिती बनवू नका.\n\nRAW NOTES:\n${rawInfo}`;
  const articlePrompt = (research: string) => `तुम्ही अनुभवी मराठी डिजिटल वृत्तसंपादक आणि SEO editor आहात. खालील raw notes आणि Google Search research brief वर आधारित बातमी पूर्णपणे नव्याने लिहा. अफवा, अपुष्ट दावे किंवा पडताळता न आलेली माहिती तथ्य म्हणून लिहू नका; मतभेद असल्यास सावध व स्पष्ट भाषा वापरा.

आउटपुट:
- नैसर्गिक आणि व्यावसायिक मराठीत किमान 700 आणि कमाल 1,000 शब्दांची सविस्तर बातमी. 700 शब्दांपूर्वी लेख संपवू नका.
- सुरुवातीच्या परिच्छेदात सर्वात महत्त्वाची माहिती; पुढे संदर्भ, पार्श्वभूमी आणि परिणाम.
- कोणतीही बनावट नावे, आकडे किंवा quotes नकोत. स्रोतांचा मजकूर जसाच्या तसा मोठ्या प्रमाणावर copy करू नका.
- title 65 अक्षरांच्या आसपास, excerpt 140-160 अक्षरे, लहान SEO slug आणि 6 ते 10 अचूक Marathi/English SEO keywords.
- content मध्ये Markdown headings, citations किंवा source list टाकू नका.

RAW NOTES:
${rawInfo}

GOOGLE SEARCH RESEARCH BRIEF:
${research}`;

  try {
    const researchResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: researchPrompt }] }], tools: [{ google_search: {} }] }),
      signal: AbortSignal.timeout(45000),
    });
    const researchPayload = await researchResponse.json();
    if (!researchResponse.ok) return NextResponse.json({ error: researchPayload?.error?.message || "Internet research अयशस्वी झाली." }, { status: 502 });
    const research = researchPayload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n").trim();
    if (!research) return NextResponse.json({ error: "विश्वसनीय internet संदर्भ मिळाले नाहीत. अधिक स्पष्ट raw माहिती द्या." }, { status: 422 });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: articlePrompt(research) }] }],
        generationConfig: { maxOutputTokens: 8192, responseMimeType: "application/json", responseSchema: {
          type: "OBJECT", required: ["title", "excerpt", "content", "slug", "seoKeywords"],
          properties: { title: { type: "STRING" }, excerpt: { type: "STRING" }, content: { type: "STRING" }, slug: { type: "STRING" }, seoKeywords: { type: "ARRAY", minItems: 6, maxItems: 10, items: { type: "STRING" } } },
        } },
      }),
      signal: AbortSignal.timeout(45000),
    });
    const payload = await response.json();
    if (!response.ok) return NextResponse.json({ error: payload?.error?.message || "Gemini request अयशस्वी झाली." }, { status: 502 });
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return NextResponse.json({ error: "Gemini कडून article मिळाला नाही." }, { status: 502 });
    const article = JSON.parse(text) as NewsArticle;
    if (!article.title || !article.content) return NextResponse.json({ error: "Gemini response अपूर्ण आहे." }, { status: 502 });
    const groundingChunks = researchPayload?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = groundingChunks.flatMap((chunk: { web?: { title?: string; uri?: string } }) => chunk.web?.uri ? [{ title: chunk.web.title || chunk.web.uri, url: chunk.web.uri }] : []);
    return NextResponse.json({ article, sources: sources.slice(0, 6) });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json({ error: timedOut ? "Gemini request timeout झाली. पुन्हा प्रयत्न करा." : "Gemini response process करता आली नाही." }, { status: 502 });
  }
}

