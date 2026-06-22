import { en } from "./en";
import { pl } from "./pl";

export type Locale = "en" | "pl";

export const LOCALES: readonly Locale[] = ["en", "pl"] as const;
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

const catalogs: Record<Locale, Record<string, string>> = { en, pl };

/** Look up a UI-chrome string; falls back to the English catalog, then the key. */
export function t(locale: Locale, key: string): string {
  const catalog = catalogs[locale];
  if (key in catalog) return catalog[key];
  if (key in en) return en[key];
  return key;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "pl";
}

/**
 * Resolve the active locale server-side: an explicit `locale` cookie wins,
 * else a Polish `Accept-Language` hint, else the default (en). No per-locale URLs.
 */
export function resolveLocale(cookieValue: string | null | undefined, acceptLanguage?: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  if (acceptLanguage && /\bpl\b/i.test(acceptLanguage)) return "pl";
  return DEFAULT_LOCALE;
}

/** Polish plural selection: 1 / 2–4 / 5+ forms. */
export function plPL(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? few : many;
}

/** Localized noun for a card count. `acc` selects the Polish accusative form. */
export function cardNoun(locale: Locale, n: number, acc = false): string {
  if (locale === "pl") return plPL(n, acc ? "fiszkę" : "fiszka", "fiszki", "fiszek");
  return n === 1 ? "card" : "cards";
}
