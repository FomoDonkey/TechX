import "server-only";
import type { ThemeOgTemplate } from "@/themes/types";
import { ImageResponse } from "next/og";

export interface OgRenderInput {
  template: ThemeOgTemplate;
  title: string;
  eyebrow?: string;
  authorName?: string | null;
  date?: string | null;
  workspaceName: string;
}

// Strippea: control chars + DEL + < > (XSS-vector cuando satori lo ve raw)
// + chars de override bidireccional (LRO/RLO/PDF/LRI/RLI/FSI/PDI U+202A–U+202E
// + U+2066–U+2069) que pueden invertir el render de un título en OG.
// biome-ignore lint/suspicious/noControlCharactersInRegex: strip control chars is the goal
const UNSAFE_OG_CHARS = /[\x00-\x1f\x7f<>‪-‮⁦-⁩]/g;

function clean(value: string | null | undefined, fallback: string, max = 80): string {
  if (!value) return fallback;
  const stripped = value.replace(UNSAFE_OG_CHARS, "").trim();
  if (!stripped) return fallback;
  return stripped.length > max ? `${stripped.slice(0, max - 1)}…` : stripped;
}

export function renderOg(input: OgRenderInput): ImageResponse {
  const tpl = input.template;
  const title = clean(input.title, "Sin título", 120);
  const eyebrow = input.eyebrow ? clean(input.eyebrow, "", 60) : "";
  const authorName = input.authorName ? clean(input.authorName, "", 40) : "";
  const date = input.date ? clean(input.date, "", 20) : "";
  const wsName = clean(input.workspaceName, "CSM", 40);

  const bg =
    tpl.background.kind === "solid"
      ? (tpl.background.from ?? "#0c0a14")
      : `linear-gradient(${tpl.background.angle ?? 135}deg, ${tpl.background.from ?? "#0c0a14"} 0%, ${tpl.background.to ?? "#1a1228"} 100%)`;

  const layoutStyle: React.CSSProperties =
    tpl.layout === "centered"
      ? {
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center" as const,
        }
      : tpl.layout === "split"
        ? { alignItems: "flex-start", justifyContent: "flex-start" }
        : { alignItems: "flex-start", justifyContent: "flex-end" };

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: bg,
        color: "#ffffff",
        padding: 80,
        fontFamily: "ui-sans-serif",
        ...layoutStyle,
      }}
    >
      {tpl.showLogo ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            position: "absolute",
            top: 60,
            left: 80,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: tpl.accent,
              color: "#0c0a14",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            {wsName.slice(0, 1).toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 600,
              opacity: 0.85,
              letterSpacing: 1,
            }}
          >
            {wsName}
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: tpl.layout === "centered" ? 1000 : 1040,
          alignItems: tpl.layout === "centered" ? "center" : "flex-start",
        }}
      >
        {eyebrow ? (
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: tpl.accent,
              opacity: 0.95,
              marginBottom: 24,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            fontSize: title.length > 50 ? 64 : 84,
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
        {(tpl.showAuthor && authorName) || (tpl.showDate && date) ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 24,
              opacity: 0.85,
              marginTop: 36,
            }}
          >
            {tpl.showAuthor && authorName ? (
              <span style={{ display: "flex" }}>{authorName}</span>
            ) : null}
            {tpl.showAuthor && authorName && tpl.showDate && date ? (
              <span style={{ display: "flex", opacity: 0.5 }}>·</span>
            ) : null}
            {tpl.showDate && date ? <span style={{ display: "flex" }}>{date}</span> : null}
          </div>
        ) : null}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
