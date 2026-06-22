import type { Locale } from "@/i18n";

interface LanguageToggleProps {
  locale: Locale;
}

// EN/PL segmented pill. Writes the `locale` cookie and does a full page reload
// so SSR re-renders all chrome in the new locale (no client-side soft-swap —
// see the i18n note in the plan; a reload discards in-progress island state).
export function LanguageToggle({ locale }: LanguageToggleProps) {
  function setLang(next: Locale) {
    if (next === locale) return;
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    location.reload();
  }

  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button
        type="button"
        data-lang="en"
        className={locale === "en" ? "on" : undefined}
        aria-pressed={locale === "en"}
        onClick={() => {
          setLang("en");
        }}
      >
        EN
      </button>
      <button
        type="button"
        data-lang="pl"
        className={locale === "pl" ? "on" : undefined}
        aria-pressed={locale === "pl"}
        onClick={() => {
          setLang("pl");
        }}
      >
        PL
      </button>
    </div>
  );
}
