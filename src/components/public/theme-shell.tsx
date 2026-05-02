import "server-only";
import { resolveActiveTheme } from "@/themes/active";
import { themeCss, themeFontsLink } from "@/themes/css";
import type { ThemeSpec } from "@/themes/types";
import type { ReactNode } from "react";

interface ThemeShellProps {
  workspaceId: string | null | undefined;
  children: ReactNode;
  /** Optional override (preview mode). If provided, skips DB resolve. */
  override?: ThemeSpec;
}

/**
 * Wraps public pages with the active workspace theme:
 *   - injects scoped CSS variables (light + dark)
 *   - links remote fonts (bunny.net) for the selected theme
 *   - sets data-csm-theme on a wrapper div so utility classes resolve
 *
 * Safe to render with workspaceId=null (degrades to default builtin).
 */
export async function ThemeShell({ workspaceId, children, override }: ThemeShellProps) {
  const spec = override ?? (workspaceId ? (await resolveActiveTheme(workspaceId)).spec : null);
  if (!spec) {
    // No workspace: render naked
    return <>{children}</>;
  }
  const css = themeCss(spec);
  const fontsHref = themeFontsLink(spec);
  return (
    <>
      {fontsHref ? <link rel="stylesheet" href={fontsHref} crossOrigin="anonymous" /> : null}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme CSS is server-generated from a closed token set */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        data-csm-theme={spec.slug}
        className="csm-theme-root"
        style={{
          fontFamily: "var(--th-font-sans)",
          background: "var(--th-bg)",
          color: "var(--th-fg)",
          minHeight: "100vh",
        }}
      >
        {children}
      </div>
    </>
  );
}
