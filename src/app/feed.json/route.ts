import { env } from "@/env";
import { buildFeedPayload } from "@/lib/feed";

// F11a: feed depende del Host (multi-tenant).
export const dynamic = "force-dynamic";

export async function GET() {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const payload = await buildFeedPayload(base, "json");
  if (!payload) {
    return Response.json(
      {
        version: "https://jsonfeed.org/version/1.1",
        title: "CSM",
        home_page_url: `${base}/`,
        feed_url: `${base}/feed.json`,
        items: [],
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  }

  const items = payload.items.map((item) => ({
    id: item.id,
    url: item.url,
    title: item.title,
    summary: item.excerpt,
    date_published: item.publishedAt.toISOString(),
    date_modified: item.updatedAt.toISOString(),
    authors: item.authorName ? [{ name: item.authorName }] : undefined,
  }));

  const body = {
    version: "https://jsonfeed.org/version/1.1",
    title: payload.title,
    home_page_url: `${payload.baseUrl}/`,
    feed_url: payload.feedUrl,
    description: payload.description,
    language: payload.language,
    items,
  };

  return Response.json(body, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
