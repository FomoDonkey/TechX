import { env } from "@/env";
import { buildFeedPayload, escapeXml } from "@/lib/feed";

// F11a: feed depende del Host (multi-tenant).
export const dynamic = "force-dynamic";

const EMPTY_FEED = (base: string) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>CSM</title>
  <id>${base}/</id>
  <updated>${new Date().toISOString()}</updated>
  <link rel="self" href="${base}/feed.atom"/>
  <link href="${base}/"/>
</feed>`;

export async function GET() {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const payload = await buildFeedPayload(base, "atom");
  if (!payload) {
    return new Response(EMPTY_FEED(base), {
      status: 200,
      headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
    });
  }

  const entries = payload.items
    .map((item) => {
      const author = item.authorName
        ? `<author><name>${escapeXml(item.authorName)}</name></author>`
        : "";
      return `  <entry>
    <id>${escapeXml(item.id)}</id>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(item.url)}"/>
    <updated>${item.updatedAt.toISOString()}</updated>
    <published>${item.publishedAt.toISOString()}</published>
    ${author}
    <summary type="text">${escapeXml(item.excerpt)}</summary>
  </entry>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(payload.language)}">
  <title>${escapeXml(payload.title)}</title>
  <subtitle>${escapeXml(payload.description)}</subtitle>
  <id>${escapeXml(payload.baseUrl)}/</id>
  <updated>${payload.updated.toISOString()}</updated>
  <link rel="self" href="${escapeXml(payload.feedUrl)}"/>
  <link href="${escapeXml(payload.baseUrl)}/"/>
${entries}
</feed>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
