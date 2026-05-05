"use client";

/**
 * Voice-to-content. Botón en el editor que abre un panel modal:
 *  1. Activa Web Speech API (lang="es-ES" por defecto).
 *  2. Transcribe en vivo.
 *  3. Al parar, envía la transcripción a /api/admin/ai/structure (server action wrapped).
 *  4. Inserta el resultado como bloques Tiptap (heading + paragraph) al final del documento.
 */

import { structureVoiceAction } from "@/ai/actions";
import { Button } from "@/components/ui/button";
import type { Editor } from "@tiptap/react";
import { Loader2, Mic, MicOff, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Props = { editor: Editor | null };

type SpeechRecognitionEventLite = Event & {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string; confidence: number };
  }>;
};

type SpeechRecognitionErrorLite = Event & { error?: string; message?: string };

type SpeechRecognitionLite = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionLite, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionLite, ev: SpeechRecognitionEventLite) => void) | null;
  onerror: ((this: SpeechRecognitionLite, ev: SpeechRecognitionErrorLite) => void) | null;
  onend: ((this: SpeechRecognitionLite, ev: Event) => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionLite };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLite };
  }
}

export function VoiceDictation({ editor }: Props) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [busy, setBusy] = useState(false);
  const recRef = useRef<SpeechRecognitionLite | null>(null);
  // `supported` se calcula tras el mount para evitar hydration mismatch:
  // SSR no tiene `window` (false) y el client SÍ (true) — si lo evaluamos en
  // render directamente, el server emite nada y el client emite el botón
  // → mismatch. Iniciamos en `false` (igual SSR) y detectamos en useEffect.
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    );
  }, []);

  const stopRecording = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!supported) {
      toast.error("Tu navegador no soporta reconocimiento de voz");
      return;
    }
    const Cls = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Cls) return;
    const r = new Cls();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "es-ES";
    r.onstart = () => setRecording(true);
    r.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res) continue;
        const txt = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += `${txt} `;
        else interimText += txt;
      }
      if (finalText) setTranscript((t) => `${`${t}${finalText}`.replace(/\s+/g, " ").trim()} `);
      setInterim(interimText);
    };
    r.onerror = (e) => {
      const code = e.error ?? "unknown";
      if (code !== "aborted" && code !== "no-speech") {
        toast.error(`Error de voz: ${code}`);
      }
      setRecording(false);
    };
    r.onend = () => {
      setRecording(false);
      setInterim("");
    };
    recRef.current = r;
    r.start();
  }, [supported]);

  const reset = () => {
    setTranscript("");
    setInterim("");
  };

  const insertStructured = async () => {
    if (!editor) return;
    const text = transcript.trim();
    if (!text) {
      toast.error("Sin transcripción todavía");
      return;
    }
    setBusy(true);
    try {
      const res = await structureVoiceAction({ transcript: text });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const nodes: unknown[] = [];
      for (const sec of res.doc.sections) {
        nodes.push({
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: sec.heading }],
        });
        for (const p of sec.paragraphs) {
          nodes.push({
            type: "paragraph",
            content: [{ type: "text", text: p }],
          });
        }
      }
      editor
        .chain()
        .focus("end")
        .insertContent(nodes as Parameters<Editor["commands"]["insertContent"]>[0])
        .run();
      toast.success(`${res.doc.sections.length} secciones insertadas`);
      setOpen(false);
      reset();
    } finally {
      setBusy(false);
    }
  };

  const insertRaw = () => {
    if (!editor) return;
    const text = transcript.trim();
    if (!text) return;
    editor.chain().focus("end").insertContent(`\n\n${text}`).run();
    toast.success("Insertado como texto");
    setOpen(false);
    reset();
  };

  useEffect(() => {
    if (!open) {
      stopRecording();
      setTranscript("");
      setInterim("");
    }
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, [open, stopRecording]);

  if (!supported) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-muted-foreground hover:text-foreground"
        title="Dictar (Voice-to-Content)"
      >
        <Mic className="size-3" /> Dictar
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          aria-modal="true"
          // biome-ignore lint/a11y/useSemanticElements: <dialog> nativo no soporta el backdrop+layout custom que necesitamos
          role="dialog"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            aria-label="Cerrar"
          />
          <div className="relative w-full max-w-xl rounded-2xl border border-border/70 bg-card/95 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
              <Mic className="size-4 text-primary" />
              <span className="text-sm font-medium">Voice-to-Content</span>
              <span className="ml-1 text-xs text-muted-foreground">· es-ES</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="px-4 py-4">
              <div className="mb-3 max-h-60 min-h-32 overflow-y-auto rounded-lg border border-border/50 bg-muted/30 p-3 text-sm leading-relaxed">
                {transcript ? <span>{transcript}</span> : null}
                {interim ? (
                  <span className="text-muted-foreground italic">{interim}</span>
                ) : transcript ? null : (
                  <span className="text-muted-foreground">
                    Pulsa el micro y empieza a hablar. Cuando termines, la IA estructurará el
                    contenido en secciones.
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!recording ? (
                  <Button size="sm" variant="gradient" onClick={startRecording}>
                    <Mic className="size-3.5" /> Empezar
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={stopRecording}>
                    <MicOff className="size-3.5" /> Parar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={reset}
                  disabled={!transcript || recording}
                >
                  Borrar
                </Button>
                <span className="ml-auto inline-flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={insertRaw}
                    disabled={!transcript || busy}
                  >
                    Insertar tal cual
                  </Button>
                  <Button
                    size="sm"
                    variant="gradient"
                    onClick={insertStructured}
                    disabled={!transcript || busy}
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    Estructurar con IA
                  </Button>
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
