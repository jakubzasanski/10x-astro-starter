# Artifact 1 — Territory (historia zmian i aktywne obszary)

> Krok 1 mapy projektu. **Bez czytania kodu** — wyłącznie sygnał z historii gita:
> gdzie projekt był realnie dotykany i które obszary mogą być wrażliwe przed
> większą zmianą.
> Wygenerowano: 2026-06-25. Zakres: cała historia (124 commity, 2025-04-06 → 2026-06-23).

## 0. Kontekst tempa (jak czytać te liczby)

Repo jest młode, ale aktywność jest skrajnie skoncentrowana w czasie — to nie
jest równomierny rozwój przez rok, tylko jeden duży zryw:

| Miesiąc | Commity |
|---|---|
| 2025-04 | 3 (bootstrap startera) |
| 2025-09 | 1 |
| 2026-03 | 6 |
| 2026-04 | 4 |
| 2026-05 | 16 |
| **2026-06** | **94** |

**Wniosek:** ~76% całej historii powstało w ostatnim miesiącu. „Stale aktywne
przez miesiące" trzeba więc czytać jako „gorące w bieżącym zrywie 2026-05/06".
Świeżość pliku ≠ stabilność — najświeższe obszary są najbardziej w ruchu i przez
to najbardziej wrażliwe na regresje.

---

## 1. Katalogi/pliki stale aktywne (top churn)

Agregacja na poziomie katalogu (cała historia, po odfiltrowaniu szumu z §4):

| Obszar | Commity | Charakter |
|---|---:|---|
| `src/pages/auth` + `src/components/auth` | 27 + 27 | **Auth UI** — najgorętszy obszar produktu |
| `src/pages/api/auth` | 10 | **Auth endpoints** (signin/signup/signout/forgot/reset) |
| `src/i18n` (`en.ts`/`pl.ts`) | 15 | Słowniki dwujęzyczne, zmieniają się przy każdym UI |
| `src/styles/global.css` | 13 | Design tokens / globalny styl (redesign „Sage") |
| `src/components` (root + `ui` + feature) | 18 + 8 | Komponenty React/Astro, w tym shadcn/ui |
| `src/lib/services` | 11 | Logika biznesowa (`generation`, `scheduling`) |
| `test/handlers` + `test/support` | 11 + 9 | Testy API (vitest) |
| `tests/e2e` | 9 | Testy Playwright |
| `src/layouts` | 9 | `Layout.astro` / `AppLayout.astro` |

Pojedyncze pliki-rekordziści (kod, bez szumu):

| Plik | Commity | Dlaczego gorący |
|---|---:|---|
| `astro.config.mjs` | 11 | env schema, adapter Cloudflare, Astro 6→7 |
| `src/pages/dashboard.astro` | 9 | Strona po zalogowaniu, redesign + redirecty |
| `src/components/Welcome.astro` | 9 | Landing |
| `src/pages/auth/signin.astro` | 8 | Wejście do auth |
| `src/layouts/Layout.astro` | 8 | Szkielet strony |
| `src/middleware.ts` | 7 | **Runtime gate** — sesja + ochrona tras |
| `src/i18n/en.ts` / `pl.ts` | 7 / 7 | Treści UI |
| `src/types.ts` | 6 | Współdzielone typy/DTO |
| `src/pages/api/cards.ts` | 4 | Publiczne API kart |

---

## 2. Pliki/katalogi zmieniające się RAZEM (sprzężenia z co-change)

Pary najczęściej commitowane wspólnie (≥4 wspólnych commitów, po odfiltrowaniu szumu):

**Klaster A — Auth (silnie sprzężony, „rusza się jako całość"):**
- `auth/signin` ↔ `auth/signup` ↔ `auth/confirm-email` (po 6) — trzy ekrany auth zawsze edytowane razem
- `Welcome.astro` ↔ wszystkie ekrany auth (5) i ↔ `dashboard.astro` (6)
- `auth/FormField.tsx` ↔ `auth/ServerError.tsx` (4) — wspólne prymitywy formularzy
- `middleware.ts` ↔ `dashboard.astro` (4) — **gate runtime sprzężony ze stroną docelową** (redirecty po logowaniu)

**Klaster B — i18n + styl + redesign (rusza razem przy każdej zmianie UI):**
- `i18n/en.ts` ↔ `i18n/pl.ts` (7) — **dwa języki ZAWSZE razem** (ryzyko: edycja jednego bez drugiego = dziura w tłumaczeniu)
- `Layout.astro` ↔ `global.css` (6); `i18n/*` ↔ `global.css` (po 6)
- `ui-redesign/plan.md` ↔ `global.css` / `i18n/*` — redesign „Sage" napędzał klaster B

**Klaster C — Build/config:**
- `astro.config.mjs` ↔ `package.json` (8) — zmiana zależności = zmiana env schema/adaptera
- `package.json` ↔ `.gitignore` / `README.md` (4)

> **Sygnał dla przyszłej zmiany:** dotknięcie jednego pliku w klastrze A lub B
> niemal na pewno wymaga zmiany pozostałych. Edycja `en.ts` bez `pl.ts` to
> najczęstszy ukryty dług w tym repo.

---

## 3. Gdzie aktywność przecina się z obszarami wrażliwymi

| Obszar wrażliwy | Pliki w ruchu | Ocena ryzyka |
|---|---|---|
| **Runtime / gate** | `src/middleware.ts` (7), sprzężony z `dashboard.astro` | 🔴 Wysokie — działa na każdym żądaniu, decyduje o dostępie; niedawno dotykany przez „post-login-redirect" |
| **Auth** | `src/pages/api/auth/*` (10), `src/pages/auth/*` (27), `src/components/auth/*` (27), `src/lib/supabase.ts` | 🔴 Wysokie — największy i najświeższy obszar; pełen cykl signin/signup/forgot/reset zbudowany w 2026-06 |
| **Dane / DB** | `supabase/migrations/*` (3 migracje, FSRS), `src/db/database.types.ts`, `test/integration/rls-*.test.ts` | 🟠 Średnie-wysokie — RLS + 3 migracje (w tym „reconcile to FSRS v5"); wrażliwe na poprawność polityk |
| **Publiczne API** | `src/pages/api/cards*`, `api/generate`, `api/review/*` | 🟠 Średnie — endpointy CRUD/AI/review, świeżo dodane, mają testy handlerów |
| **Integracje** | `src/lib/services/generation.ts` (LLM), Supabase, Cloudflare (`wrangler.jsonc`, adapter) | 🟠 Średnie — generacja AI + zewnętrzne usługi; `generation.privacy.test.ts` sygnalizuje wrażliwość na dane |
| **Build / toolchain** | `astro.config.mjs` (11), `package.json` (22), `eslint.config.js` (5), `wrangler.jsonc`, `vitest.config.ts`, `playwright.config.ts`, `stryker.conf.json` | 🟠 Średnie — częsta migracja (Astro 6→7), env schema; CI zależy od `astro sync` |

**Skrzyżowania najwyższego ryzyka (świeże + wrażliwe + sprzężone):**
1. `middleware.ts` × `dashboard.astro` × `api/auth/*` — sesja, ochrona tras, redirecty (zmieniane w czerwcu).
2. `supabase/migrations` × RLS × `api/cards|review` — warstwa danych + polityki dostępu, świeży model FSRS.
3. `generation.ts` × `api/generate` × privacy test — integracja AI z danymi użytkownika.

---

## 4. Szum do odfiltrowania (świadomie pominięte)

Te pozycje mają wysoki churn, ale **nie niosą sygnału o wrażliwości kodu** —
ignorujemy je w mapie:

- **Lockfile:** `package-lock.json` (18 commitów) — pochodna `package.json`.
- **Generowane / narzędziowe:** `.claude/.10x-cli-manifest.json` (8), `skills-lock.json`, `supabase/.temp/*`, `supabase/.branches/*`, `src/db/database.types.ts` (generowane z DB — traktować jako artefakt, nie źródło).
- **Dokumentacja procesu (10xDevs):** cały `context/changes/*` i `context/foundation/*` (plan.md/change.md mają wysoki churn, ale to artefakty kursu, nie kod runtime), `.cursor/rules` (16), `CLAUDE.md` (12), `AGENTS.md`, `README.md`.
- **Lokalizacje jako szum tylko częściowo:** `i18n/en.ts`/`pl.ts` mają wysoki churn z natury (masowe dopisywanie kluczy). Traktuję je jako **sygnał sprzężenia** (klaster B), ale nie jako „gorący kod logiczny".
- **Assety/snapshoty:** `*.png/.svg/.ico` — pominięte w analizie co-change.
- **Masowe formatowanie:** brak wyróżniających się commitów czysto-formatujących; pre-commit (husky + lint-staged) rozprasza je po zwykłych commitach — nie zaburza obrazu.

---

## 5. Wniosek operacyjny dla kolejnych kroków

Przed większą zmianą najbardziej „żywe i wrażliwe" terytorium to:

1. **Auth (UI + API + middleware)** — największa powierzchnia, najświeższa, silnie sprzężona wewnętrznie i z runtime.
2. **Warstwa danych (Supabase migrations + RLS + endpointy cards/review)** — świeży model FSRS, poprawność polityk dostępu.
3. **i18n/styl** — nie wrażliwe na bezpieczeństwo, ale łatwe do uszkodzenia częściowego (en bez pl).

To są naturalni kandydaci na „wybrany obszar" do pogłębienia w Artefakcie 3
(kontekst kontrybutorów). Sugerowany domyślny wybór: **auth/runtime**.
