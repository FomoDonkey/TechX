"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function EmbedClient({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState("https://tu-dominio.com");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const base = origin;

  const iframeCode = `<iframe src="${base}/forms/${slug}?embed=1" width="100%" height="600" frameborder="0"></iframe>`;
  const apiSchema = `${base}/api/public/forms/${slug}/schema`;
  const apiSubmit = `${base}/api/public/forms/${slug}/submit`;
  const fetchExample = `// Submit programático con fetch
fetch("${apiSubmit}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    nombre: "Ana",
    email: "ana@ejemplo.com",
    mensaje: "Hola!",
    csm_t: Date.now() - 3000  // tiempo de carga (anti-spam)
  })
}).then(r => r.json()).then(console.log);`;

  function copy(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }

  return (
    <>
      <CodeBlock
        title="Iframe"
        code={iframeCode}
        onCopy={() => copy(iframeCode, "Iframe")}
        help="Pégalo en cualquier página HTML. Responsive — ajusta height al alto del form."
      />
      <CodeBlock
        title="API: GET schema"
        code={apiSchema}
        onCopy={() => copy(apiSchema, "URL")}
        help="Devuelve el FormSchema sanitizado para renderizar en cliente custom."
      />
      <CodeBlock
        title="API: POST submit"
        code={apiSubmit}
        onCopy={() => copy(apiSubmit, "URL")}
        help="Acepta JSON, form-encoded o multipart/form-data. CORS abierto (configurable en Ajustes)."
      />
      <CodeBlock
        title="Ejemplo fetch"
        code={fetchExample}
        onCopy={() => copy(fetchExample, "Snippet")}
        help="Recuerda incluir csm_t (epoch ms en que cargaste el form) y honeypot vacío."
      />
    </>
  );
}

function CodeBlock({
  title,
  code,
  onCopy,
  help,
}: {
  title: string;
  code: string;
  onCopy: () => void;
  help?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card/30 p-5 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="ghost" size="sm" onClick={onCopy}>
          Copiar
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2 text-[11px] font-mono whitespace-pre-wrap break-all">
        {code}
      </pre>
      {help ? <p className="text-[11px] text-muted-foreground">{help}</p> : null}
    </div>
  );
}
