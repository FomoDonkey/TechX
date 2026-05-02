const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "blog",
  "dashboard",
  "docs",
  "help",
  "login",
  "logout",
  "onboarding",
  "registro",
  "olvide",
  "invitacion",
  "settings",
  "support",
  "www",
]);

const ACCENTS: Record<string, string> = {
  á: "a",
  à: "a",
  ä: "a",
  â: "a",
  ã: "a",
  é: "e",
  è: "e",
  ë: "e",
  ê: "e",
  í: "i",
  ì: "i",
  ï: "i",
  î: "i",
  ó: "o",
  ò: "o",
  ö: "o",
  ô: "o",
  õ: "o",
  ú: "u",
  ù: "u",
  ü: "u",
  û: "u",
  ñ: "n",
  ç: "c",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[áàäâãéèëêíìïîóòöôõúùüûñç]/g, (c) => ACCENTS[c] ?? c)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug);
}

export function withSuffix(slug: string, n: number): string {
  return `${slug}-${n}`;
}

export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 2 || slug.length > 48) return false;
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  if (slug.startsWith("-") || slug.endsWith("-")) return false;
  if (isReservedSlug(slug)) return false;
  return true;
}
