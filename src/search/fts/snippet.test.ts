import { describe, expect, it } from "vitest";
import { generateSnippet, sanitizeSnippet } from "./snippet";

describe("sanitizeSnippet", () => {
  it("escapa HTML pero preserva <mark> controlados", () => {
    const input = 'foo <script>alert("x")</script> <mark>bar</mark>';
    const out = sanitizeSnippet(input);
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("&quot;x&quot;");
    expect(out).toContain("<mark>bar</mark>");
    expect(out).not.toContain("<script>");
  });

  it("devuelve string vacío para null/undefined", () => {
    expect(sanitizeSnippet(null)).toBe("");
    expect(sanitizeSnippet(undefined)).toBe("");
    expect(sanitizeSnippet("")).toBe("");
  });
});

describe("generateSnippet", () => {
  it("envuelve cada término con <mark> case-insensitive", () => {
    const out = generateSnippet("Hola Mundo de CSM Search", ["mundo", "csm"]);
    expect(out.toLowerCase()).toContain("<mark>mundo</mark>");
    expect(out.toLowerCase()).toContain("<mark>csm</mark>");
  });

  it("centra la ventana sobre la primera ocurrencia", () => {
    const text = `${"prefix ".repeat(50)}HIT ${"suffix ".repeat(50)}`;
    const out = generateSnippet(text, ["hit"], { windowChars: 100 });
    expect(out).toContain("<mark>HIT</mark>");
    expect(out.startsWith("…")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan(150);
  });

  it("ignora términos cortos (<3 chars)", () => {
    const out = generateSnippet("yo no soy un tonto", ["yo", "no"]);
    expect(out).not.toContain("<mark>yo</mark>");
    expect(out).not.toContain("<mark>no</mark>");
  });

  it("fallback a primeros chars si no hay match", () => {
    const out = generateSnippet("contenido sin match", ["xyzfoo"]);
    expect(out).toBe("contenido sin match");
  });

  it("escapa caracteres regex en términos sin reventar", () => {
    const out = generateSnippet("Precio (100€) total", ["precio", "(100€)"]);
    expect(out.toLowerCase()).toContain("<mark>precio</mark>");
  });

  it("devuelve string vacío para texto null/empty", () => {
    expect(generateSnippet(null, ["foo"])).toBe("");
    expect(generateSnippet("", ["foo"])).toBe("");
  });
});
