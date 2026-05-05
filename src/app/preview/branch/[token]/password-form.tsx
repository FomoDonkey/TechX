import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { submitPreviewPassword } from "./password-action";

/**
 * Server-rendered form. POSTea a una server action que valida + setea cookie
 * `csm_branch_preview_<token>` y redirige a /preview/branch/[token].
 * Antes (F9b-8): el password viajaba en query string → quedaba en historial,
 * Referer headers y access logs. Ahora viaja en POST body sólo.
 */
export function PreviewPasswordForm({ token, error }: { token: string; error: string | null }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6 py-10">
      <form
        action={submitPreviewPassword}
        className="w-full space-y-5 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="token" value={token} />
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Lock className="size-5" />
          </div>
          <div>
            <h1 className="font-semibold">Preview protegido</h1>
            <p className="text-xs text-muted-foreground">Introduce la contraseña para verlo.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Contraseña</Label>
          <Input id="pw" name="password" type="password" autoFocus required />
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
        <Button type="submit" className="w-full">
          Entrar
        </Button>
      </form>
    </main>
  );
}
