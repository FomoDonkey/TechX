import { generateSite } from "@/lib/site-generator";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  const { prompt } = (await req.json().catch(() => ({}))) as { prompt?: string };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      try {
        const site = generateSite(prompt ?? "");

        send("start", { prompt });

        // Stream brand fields one at a time for visual drama
        await sleep(180);
        send("brand:name", {
          name: site.brand.name,
          emoji: site.brand.emoji,
          slug: site.brand.slug,
        });

        await sleep(220);
        send("brand:tagline", { tagline: site.brand.tagline });

        await sleep(220);
        send("brand:palette", { palette: site.brand.palette });

        await sleep(180);
        send("brand:font", { font: site.brand.font });

        await sleep(120);
        send("brand:done", { brand: site.brand });

        await sleep(220);
        for (const cat of site.categories) {
          send("category", cat);
          await sleep(80);
        }

        await sleep(160);
        for (const post of site.posts) {
          send("post", post);
          await sleep(180);
        }

        await sleep(120);
        send("done", { site });
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "unknown" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
