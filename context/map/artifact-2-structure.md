# Artifact 2 — Structure (zależności, entry pointy, cykle, lokalne centra)

> Krok 2 mapy projektu. Jedno pytanie: **co realnie zależy od czego?**
> Cel grafu — pokazać *blast radius*, lokalne centra i cienkie wejścia, nie listę importów.
> Wygenerowano: 2026-06-25. Zakres: `src/**` (.ts/.tsx/.astro).

## 0. Jak zbudowano graf (i dlaczego bez nowego narzędzia)

Sprawdzone przed wyborem narzędzia:
- **Package manager:** npm (`package-lock.json`), brak workspaces, `type: module`.
- **Istniejące narzędzia do grafu:** **żadne** — brak madge / dependency-cruiser / knip / ts-prune w `package.json`.
- **Aliasy ścieżek:** `@/* → ./src/*` (jeden, z `tsconfig.json`).
- **Skrypty:** dev/build/preview/lint/format/test/test:integration/test:e2e — żaden nie dotyka grafu zależności.

**Decyzja:** nie instaluję narzędzia. Połowa modułów to pliki `.astro`, których
`madge`/`dependency-cruiser` natywnie **nie parsują** — dałyby graf z dziurą po
całej warstwie stron i layoutów. Zamiast tego zbudowałem graf własnym parserem
importów (statyczne `import … from`, dynamiczne `import()`, side-effect importy),
z rozwiązywaniem aliasu `@/` i rozszerzeń. Importy zewnętrzne (`react`, `astro`,
`astro:*`, `zod`, …) policzone osobno, nie wchodzą do grafu wewnętrznego.

---

## 1. Kontrakty między warstwami (gdzie warstwy się stykają)

Cross-layer edges (kto importuje kogo) układają się w **czystą warstwowość**:

```
page  ──> layout (11)          page ──> component (18)      page ──> i18n (9)
component ──> component (23)    component ──> i18n (13)      component ──> lib/types (8)
api   ──> lib (10)             api  ──> service (3)         api ──> types (6)
service ──> types (3)          service ──> service (3)      middleware ──> lib/i18n (2)
layout ──> component (3)        types ──> db (1)             lib ──> db (1)
```

**Brak krawędzi wstecznych** (np. `component → page`, `lib → component`,
`service → api`). Zależności płyną w jedną stronę: `page → component/layout`,
`api → service/lib → types → db`. To zdrowy układ — warstwy niższe nie wiedzą o wyższych.

**Trzy realne kontrakty międzywarstwowe** (moduły, na których stykają się warstwy):

| Kontrakt | Plik | Rola | Kto konsumuje |
|---|---|---|---|
| **Treści UI** | `src/i18n/index.ts` | `resolveLocale`, `LOCALE_COOKIE`, słowniki | pages + components + layouts + **middleware** |
| **Dostęp do danych/auth** | `src/lib/supabase.ts` | `createClient(headers, cookies)` — jedyny eksport | api/auth, api/cards|review, **middleware**, komponenty |
| **DTO / typy** | `src/types.ts` | encje + DTO | api ↔ service ↔ component (kontrakt danych między warstwami) |

> `types.ts → db/database.types.ts` to jedyne miejsce, gdzie kontrakt typów
> dotyka wygenerowanego schematu DB. Zmiana schematu Supabase propaguje się
> przez ten jeden punkt.

---

## 2. Cienkie wejścia vs głębsze centra

**Entry pointy (cienkie wejścia)** — wysoki fan-out, **fan-in = 0** (nikt ich nie importuje, są liśćmi wejściowymi systemu):

- **Strony / trasy** (`src/pages/**/*.astro`) — wejścia użytkownika. Np. `auth/reset-password.astro` (fan-out 6), `signin/signup/forgot` (po 5). Dużo importują, ale są końcówkami grafu → zmiana w nich ma **zerowy** blast radius w górę.
- **Endpointy API** (`src/pages/api/**`) — wejścia programistyczne. **Cienkie i jednorodne:** importują `astro` + `zod` + `@/lib/supabase` + `@/types` (+ ewentualnie jeden serwis). Przykład: `api/cards.ts` → supabase, types, services/generation; `api/auth/signin.ts` → tylko supabase. Cała logika delegowana w dół — to dobry znak (cienki kontroler nad grubym serwisem).
- **`src/middleware.ts`** — runtime entry na każde żądanie. Cienki: importuje tylko `supabase` (sesja) + `i18n` (locale). Mały fan-out, ale **maksymalna częstotliwość wykonania** → patrz §4.

**Lokalne centra (głębsze, wysoki fan-in)** — pęknięcie tutaj promieniuje szeroko:

| Plik | Fan-in | Typ centrum |
|---|---:|---|
| `src/i18n/index.ts` | **25** | Centrum globalne — dotyka niemal całego UI |
| `src/lib/supabase.ts` | **13** | Centrum danych/auth — łączy api + middleware + UI |
| `src/types.ts` | **13** | Centrum kontraktu danych |
| `src/layouts/Layout.astro` | 7 | Centrum prezentacji (guest pages) |
| `src/components/brand/SageLeaf.astro` | 6 | Centrum brandingu (liść UI, ale szeroko reużywany) |
| `src/layouts/AppLayout.astro` | 5 | Centrum prezentacji (zalogowane) |
| `src/components/auth/BackHome.astro` | 5 | Prymityw auth |
| `src/lib/services/generation.ts` | 4 | Centrum logiki AI |
| `src/lib/utils.ts` (`cn`) | 4 | Util współdzielony |
| `auth/FormField` / `SubmitButton` / `ServerError` | po 4 | Prymitywy formularzy auth (klaster z Artefaktu 1) |

**Najwięksi konsumenci (fan-out)** poza stronami: formularze auth (`SignUpForm`/`SignInForm`/`ResetPasswordForm`, po 5) i `ReviewSession.tsx` (3) — to „grube" komponenty interaktywne spinające i18n + lib + ui.

---

## 3. Cykle i podejrzane zależności

**Cykle: BRAK.** Analiza SCC (Tarjan) → graf jest **acyklicznym DAG-iem**, zero
self-loopów. Warstwy płyną w jedną stronę (§1), więc nie ma `A→B→A`.

Podejrzane zależności — **brak czerwonych flag**:
- Żaden moduł niższej warstwy nie sięga w górę.
- API są cienkie i nie importują się nawzajem (każdy endpoint izolowany).
- `service → service` (3) to wewnętrzne złożenie logiki (`generation`/`scheduling` + typy), nie cykl.

Jedyna obserwacja do zapamiętania (nie problem): **`i18n/index.ts` jest pojedynczym
punktem o ekstremalnym fan-in (25)**. To nie błąd architektury (tak działa
centralny słownik), ale każda zmiana jego *kształtu eksportu* (sygnatura
`resolveLocale`, format słownika) jest zmianą o najszerszym zasięgu w repo.

---

## 4. Blast radius — kto pęknie przy zmianie którego modułu

Posortowane wg realnego zasięgu i wrażliwości (fan-in × charakter warstwy):

| Zmieniasz… | Bezpośrednio pęka | Zasięg / komentarz |
|---|---:|---|
| **`i18n/index.ts`** (kontrakt) | 25 plików | 🔴 Najszerszy. Zmiana sygnatury/kształtu słownika rusza cały UI + middleware. Dodanie klucza = bezpieczne; zmiana API eksportu = nie. |
| **`lib/supabase.ts`** (`createClient`) | 13 plików, w tym **middleware** | 🔴 Zmiana sygnatury `createClient` uderza w runtime gate + każdy endpoint auth/danych. Wrażliwość: auth + dane. |
| **`types.ts`** (DTO) | 13 plików (api↔service↔component) | 🟠 Złamanie kontraktu DTO propaguje przez wszystkie warstwy danych; łapane przez typecheck (`astro check`/lint). |
| **`db/database.types.ts`** (schemat) | przez `types.ts` → 13 | 🟠 Wejście migracji Supabase do kodu; zmiana schematu propaguje przez 1 punkt. |
| **`Layout.astro` / `AppLayout.astro`** | 7 / 5 stron | 🟠 Zmiana szkieletu → wszystkie strony danej grupy (guest/app). Prezentacja, nie bezpieczeństwo. |
| **`generation.ts` / `scheduling.ts`** | 4 / 2 (api/generate, api/cards, api/review) | 🟠 Logika AI + FSRS; zmiana kontraktu serwisu uderza w endpointy, ale nie w UI. |
| **prymitywy auth** (`FormField`/`SubmitButton`/`ServerError`/`BackHome`) | 4–5 formularzy | 🟡 Lokalny klaster auth (zgodny z co-change z Artefaktu 1). |
| **strona / endpoint** (dowolny `pages/**`) | 0 | 🟢 Liść grafu — zmiana nie promieniuje w górę. Bezpieczne do edycji w izolacji. |

**Zależności zewnętrzne** (kontekst blast-radius przy bumpie wersji): `react` (15),
`astro` (12), `lucide-react` (11), `zod` (8) — to faktyczne „grube" zależności;
upgrade któregokolwiek dotyka wielu plików (spójne z churnem `astro.config.mjs`/`package.json` z Artefaktu 1).

---

## 5. Wniosek operacyjny

- Architektura jest **czysta i warstwowa** (DAG, brak cykli, brak krawędzi wstecznych) — dobra baza pod większą zmianę.
- **Trzy centra niosą cały blast radius:** `i18n/index.ts`, `lib/supabase.ts`, `types.ts`. Każda zmiana ich *kontraktu* (nie zawartości) wymaga świadomej rewizji 13–25 plików.
- **Cienkie wejścia** (strony, endpointy, middleware) są bezpieczne do edycji lokalnej — logika siedzi w `lib/services`, nie w kontrolerach.
- Najwrażliwsze skrzyżowanie struktura × historia: **`lib/supabase.ts` (centrum danych/auth) ⟶ `middleware.ts` (runtime) ⟶ api/auth** — pokrywa się z gorącym terytorium z Artefaktu 1. To naturalny obszar do pogłębienia w Artefakcie 3.
