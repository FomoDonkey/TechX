"use client";

import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Cookies banner con consent granular GDPR/ePrivacy compliant.
 *
 * **Persistencia:**
 * - Cookie `csm_consent` (stringified JSON) — leída server-side por gating de
 *   scripts third-party (analytics, ads).
 * - LocalStorage `csm_consent_v` con timestamp para revalidar tras cambio mayor
 *   de proveedores (ej. añadir Stripe analytics → bump version).
 *
 * **Consent options:**
 * - `necessary`: siempre on, no se puede desactivar (auth, csrf, lang, ws).
 * - `analytics`: nuestro RUM propio + Vercel Analytics (si activo).
 * - `marketing`: tracking de conversiones de campañas + remarketing pixels.
 */

export type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  /** Versión del schema. Bump → re-prompt al usuario. */
  v: number;
  /** Epoch ms cuando se decidió. */
  ts: number;
};

const CONSENT_VERSION = 1;
const COOKIE_NAME = "csm_consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as ConsentState;
    if (parsed.v !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeConsent(state: ConsentState) {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(state));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  // Notify listeners (analytics scripts pueden engancharse a este evento).
  window.dispatchEvent(new CustomEvent("csm:consent-change", { detail: state }));
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = readConsent();
    if (!existing) setOpen(true);
  }, []);

  if (!open) return null;

  function persist(state: Omit<ConsentState, "v" | "ts" | "necessary">) {
    writeConsent({
      necessary: true,
      analytics: state.analytics,
      marketing: state.marketing,
      v: CONSENT_VERSION,
      ts: Date.now(),
    });
    setOpen(false);
  }

  return (
    <section
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-3 bottom-3 z-50 max-w-3xl rounded-2xl border bg-card/95 p-5 shadow-2xl backdrop-blur md:inset-x-auto md:right-4 md:left-auto md:bottom-4"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Cookie className="size-5" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 id="cookie-consent-title" className="text-base font-semibold">
              Cookies y privacidad
            </h3>
            <p className="text-sm text-muted-foreground">
              Usamos cookies necesarias para que la app funcione. Tú decides sobre las opcionales.{" "}
              <Link href="/legal/cookies" className="underline underline-offset-2">
                Saber más
              </Link>
              .
            </p>
          </div>

          {showDetail ? (
            <ul className="space-y-2 text-sm">
              <li className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                <div>
                  <p className="font-medium">Necesarias</p>
                  <p className="text-xs text-muted-foreground">
                    Sesión, idioma, anti-CSRF. Sin estas la app no funciona.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Siempre on
                </span>
              </li>
              <li className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                <div>
                  <p className="font-medium">Analítica</p>
                  <p className="text-xs text-muted-foreground">
                    Métricas anónimas para mejorar el producto (latencia, errores).
                  </p>
                </div>
                <ToggleSwitch checked={analytics} onChange={setAnalytics} label="Analítica" />
              </li>
              <li className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                <div>
                  <p className="font-medium">Marketing</p>
                  <p className="text-xs text-muted-foreground">
                    Conversiones de campañas + remarketing. Off por defecto.
                  </p>
                </div>
                <ToggleSwitch checked={marketing} onChange={setMarketing} label="Marketing" />
              </li>
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => persist({ analytics: true, marketing: true })}>
              Aceptar todas
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => persist({ analytics: false, marketing: false })}
            >
              Sólo necesarias
            </Button>
            {showDetail ? (
              <Button size="sm" variant="ghost" onClick={() => persist({ analytics, marketing })}>
                Guardar selección
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setShowDetail(true)}>
                Personalizar
              </Button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => persist({ analytics: false, marketing: false })}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Cerrar (sólo necesarias)"
        >
          <X className="size-4" />
        </button>
      </div>
    </section>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/** Hook para que componentes opt-in lean el consent actual. */
export function useConsent(): ConsentState | null {
  const [state, setState] = useState<ConsentState | null>(null);
  useEffect(() => {
    setState(readConsent());
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<ConsentState>;
      setState(ce.detail);
    };
    window.addEventListener("csm:consent-change", onChange);
    return () => window.removeEventListener("csm:consent-change", onChange);
  }, []);
  return state;
}
