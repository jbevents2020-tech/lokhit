export type DigestArticle = { id: string; title: string; excerpt: string | null; content?: string; wordpress_url: string };

export function indiaDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)!.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const start = new Date(`${date}T00:00:00+05:30`);
  return { date, start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}

function plain(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim();
}

function short(value: string, limit: number) {
  const chars = Array.from(plain(value));
  return chars.length > limit ? `${chars.slice(0, limit).join("").trimEnd()}…` : chars.join("");
}

export function safeArticleLink(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}

export function digestMessages(articles: DigestArticle[], date: string, highlights = false) {
  const label = new Intl.DateTimeFormat("mr-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00+05:30`));
  const heading = `📰 *लोकहित | ${highlights ? "आजच्या ठळक बातम्या" : "आजचा बातमी आढावा"}*\n📅 ${label}`;
  const groups: string[][] = [];
  for (const [index, article] of articles.filter((item) => safeArticleLink(item.wordpress_url)).entries()) {
    const excerpt = short(article.excerpt?.trim() || article.content || "सविस्तर बातमी वाचण्यासाठी खालील लिंक उघडा.", 180);
    const block = `*${index + 1}. ${short(article.title, 140)}*\n${excerpt}\n🔗 ${article.wordpress_url}`;
    let group = groups[groups.length - 1];
    // Keep share URLs manageable on phones; do not cut an article or its URL in half.
    if (!group || group.length >= 7 || encodeURIComponent(`${heading}\n\n${[...group, block].join("\n\n")}`).length > 6500) {
      group = []; groups.push(group);
    }
    group.push(block);
  }
  return groups.map((blocks, index) => `${heading}${groups.length > 1 ? `\nभाग ${index + 1}/${groups.length}` : ""}\n\n${blocks.join("\n\n")}\n\nलोकहितच्या बातम्या आपल्या मित्रपरिवारासोबत शेअर करा. 🙏`);
}
