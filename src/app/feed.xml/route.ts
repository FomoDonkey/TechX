import { env } from "@/env";
import { buildFeedPayload, escapeCdata, escapeXml } from "@/lib/feed";

// F11a: feed depende del Host (multi-tenant).
export const dynamic = "force-dynamic";

const EMPTY_FEED = (base: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>CSM</title>
  <link>${base}</link>
  <description>Sin publicaciones todavía</description>
  <language>es</language>
  <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>
</channel>
</rss>`;

export async function GET() {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const payload = await buildFeedPayload(base, "rss");
  if (!payload) {
    return new Response(EMPTY_FEED(base), {
      status: 200,
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    });
  }

  const items = payload.items
    .map((item) => {
      const pub = item.publishedAt.toUTCString();
      const author = item.authorName
        ? `<dc:creator><![CDATA[${escapeCdata(item.authorName)}]]></dc:creator>`
        : "";
      return `    <item>
      <title><![CDATA[${escapeCdata(item.title)}]]></title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${pub}</pubDate>
      ${author}
      <description><![CDATA[${escapeCdata(item.excerpt)}]]></description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title><![CDATA[${escapeCdata(payload.title)}]]></title>
    <link>${escapeXml(payload.baseUrl)}</link>
    <description><![CDATA[${escapeCdata(payload.description)}]]></description>
    <language>${escapeXml(payload.language)}</language>
    <lastBuildDate>${payload.updated.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(payload.feedUrl)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
