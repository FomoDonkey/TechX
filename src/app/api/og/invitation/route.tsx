import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

function clean(value: string | null, fallback: string, max = 60): string {
  if (!value) return fallback;
  // Quita controles + ángulos y limita longitud (evita render roto y abuso del endpoint).
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars is the goal
  const stripped = value.replace(/[\x00-\x1f\x7f<>]/g, "").trim();
  if (!stripped) return fallback;
  return stripped.length > max ? `${stripped.slice(0, max - 1)}…` : stripped;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ws = clean(searchParams.get("ws"), "tu workspace");
  const by = clean(searchParams.get("by"), "alguien", 40);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0c0a14 0%, #1a1228 60%, #0c0a14 100%)",
        color: "white",
        padding: 80,
        fontFamily: "ui-sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(120deg, #9b5cff, #ff5db1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          C
        </div>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, opacity: 0.7 }}>CSM</div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: "auto",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, opacity: 0.7 }}>Invitación</div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            marginTop: 12,
            lineHeight: 1.05,
          }}
        >
          <span style={{ color: "#c08bff", marginRight: 16 }}>{by}</span>
          <span>te invita a unirte a</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 80,
            fontWeight: 800,
            marginTop: 8,
            color: "#ff5db1",
            lineHeight: 1.05,
          }}
        >
          {ws}
        </div>
        <div style={{ display: "flex", fontSize: 24, opacity: 0.6, marginTop: 24 }}>
          Editor Notion-like · Page builder · IA nativa
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
