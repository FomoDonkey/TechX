// scripts/md-to-pdf.mjs
// Convierte un archivo Markdown a PDF usando Edge/Chrome headless.
// Uso: node scripts/md-to-pdf.mjs <input.md> [output.pdf]
//
// Pipeline:
//   1. Lee el .md
//   2. Lo convierte a HTML con `marked`
//   3. Inyecta CSS de impresión (estilo academic doc)
//   4. Llama a Edge en modo headless para imprimirlo a PDF

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const inputArg = process.argv[2];
if (!inputArg) {
  console.error("Uso: node scripts/md-to-pdf.mjs <input.md> [output.pdf]");
  process.exit(1);
}
const inputPath = resolve(ROOT, inputArg);
if (!existsSync(inputPath)) {
  console.error("No existe:", inputPath);
  process.exit(1);
}
const outputPath = process.argv[3]
  ? resolve(ROOT, process.argv[3])
  : inputPath.replace(/\.md$/i, ".pdf");

// 1. Importa marked desde npm. Si no está, lo instalamos sin guardar.
let marked;
async function loadMarked() {
  // Path directo al ESM porque marked@13 no tiene `exports` field y
  // algunas versiones de Node fallan a resolverlo con `import "marked"`.
  const markedPath = resolve(ROOT, "node_modules/marked/lib/marked.esm.js");
  if (!existsSync(markedPath)) {
    console.log("Instalando marked temporalmente...");
    execSync("npm install --no-save --no-audit marked@13", {
      cwd: ROOT,
      stdio: "inherit",
    });
  }
  const mod = await import(`file:///${markedPath.replace(/\\/g, "/")}`);
  return mod.marked;
}
marked = await loadMarked();

const md = readFileSync(inputPath, "utf8");
const htmlBody = marked.parse(md);

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${basename(inputPath)}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  html, body {
    font-family: "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.55;
    font-size: 11pt;
  }
  body { padding: 0; margin: 0; }
  h1 {
    font-size: 24pt;
    color: #1a1a1a;
    border-bottom: 3px solid #DC0000;
    padding-bottom: 8pt;
    margin-top: 0;
    page-break-before: avoid;
  }
  h2 {
    font-size: 17pt;
    color: #1a1a1a;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4pt;
    margin-top: 24pt;
    page-break-after: avoid;
  }
  h3 {
    font-size: 13pt;
    color: #444;
    margin-top: 16pt;
    page-break-after: avoid;
  }
  h4 { font-size: 11.5pt; color: #555; margin-top: 12pt; }
  p { margin: 0.6em 0; }
  ul, ol { margin: 0.4em 0 0.8em 1.2em; padding: 0; }
  li { margin: 0.2em 0; }
  code {
    font-family: "Consolas", "Monaco", monospace;
    background: #f4f4f4;
    color: #b22222;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 9.5pt;
  }
  pre {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 12px 14px;
    border-radius: 6px;
    overflow-x: hidden;
    font-size: 9pt;
    line-height: 1.45;
    page-break-inside: avoid;
  }
  pre code {
    background: transparent;
    color: inherit;
    padding: 0;
    font-size: inherit;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #ddd;
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #f0f0f0;
    font-weight: 600;
  }
  tr:nth-child(even) td { background: #fafafa; }
  blockquote {
    border-left: 3px solid #DC0000;
    background: #fff5f5;
    margin: 0.8em 0;
    padding: 0.4em 1em;
    color: #555;
    font-style: italic;
  }
  blockquote p { margin: 0.3em 0; }
  hr {
    border: none;
    border-top: 1px dashed #ccc;
    margin: 1.5em 0;
  }
  a { color: #0066cc; text-decoration: none; }
  a:hover { text-decoration: underline; }
  /* Avoid breaking checklist items */
  ul li input[type="checkbox"] { margin-right: 0.4em; }
  /* Page break helpers */
  h1, h2, h3 { break-after: avoid; }
  table, pre, blockquote { break-inside: avoid; }
</style>
</head>
<body>
${htmlBody}
</body>
</html>
`;

const tmpHtml = join(ROOT, ".tmp-pdf-render.html");
writeFileSync(tmpHtml, html, "utf8");

// 2. Localiza Edge.
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
let edge = null;
for (const p of EDGE_PATHS) {
  if (existsSync(p)) {
    edge = p;
    break;
  }
}
if (!edge) {
  console.error("No se encontró Edge en los paths estándar.");
  process.exit(1);
}

// 3. Lanza Edge headless para imprimir a PDF.
const tmpUrl = `file:///${tmpHtml.replace(/\\/g, "/")}`;
const args = [
  "--headless",
  "--disable-gpu",
  "--no-margins",
  `--print-to-pdf="${outputPath}"`,
  "--print-to-pdf-no-header",
  `"${tmpUrl}"`,
];

console.log("Generando PDF...");
console.log("  Input:  " + inputPath);
console.log("  Output: " + outputPath);

try {
  execSync(`"${edge}" ${args.join(" ")}`, { stdio: "inherit", cwd: ROOT });
} catch (err) {
  console.error("Error al generar PDF:", err.message);
  unlinkSync(tmpHtml);
  process.exit(1);
}

// Cleanup
unlinkSync(tmpHtml);

if (existsSync(outputPath)) {
  const stat = (await import("node:fs")).statSync(outputPath);
  console.log(`OK · ${(stat.size / 1024).toFixed(1)} KB`);
} else {
  console.error("PDF no se creó.");
  process.exit(1);
}
