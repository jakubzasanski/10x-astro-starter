---
title: Raport architektoniczny — Moduł 4 (ścieżka 10xArchitect)
created: 2026-06-25
type: architect-report
sources: [L2 repo-map, L3 research, L4 plan, L5 domain ×3]
---

# Raport architektoniczny — 10xArchitect (Moduł 4)

> Two-pager oparty **wyłącznie** na sześciu artefaktach modułu (L2–L5). Twierdzenia
> strukturalne (liczby, „tylko tutaj") pochodzą z artefaktów, nie z pamięci o kodzie.
> Gdzie artefaktu brak — napisano wprost „BRAK".

## 1. Opisane projekty

**Wszystkie artefakty pochodzą z jednego repo: `10x-astro-starter`** (produkt: „10xCards";
worker prod „10x-cards"). To nie są różne projekty — to ten sam codebase oglądany z dwóch
poziomów: L2–L4 wchodzą w slice **auth / password-reset**, L5 wchodzi w **rdzeń produktu
(fiszki + powtórki)**. Auth w L5 jest świadomie sklasyfikowane jako subdomena *Generic*,
stąd pozorny rozjazd tematów.

| Repo | Stack | Skala (orientacyjnie) | Artefakty |
| --- | --- | --- | --- |
| `10x-astro-starter` / 10xCards | Astro 6→7 SSR + React 19 islands + Tailwind 4 + Supabase (auth + Postgres) + ts-fsrs, na Cloudflare Workers | „świeże, w ruchu" — **76% historii z czerwca 2026**; 1 główny maintainer (95 commitów) + 2 współautorów; brak osobnej warstwy modelu domenowego | L2, L3, L4, L5 (01/02/03) |

## 2. Mapa projektu (L2 — `context/map/repo-map.md`)

- **Architektura jest czysta**: graf importów `src/**` to acykliczny DAG (Tarjan SCC: 0 cykli, 0 krawędzi wstecznych) — bezpieczna do zmian *pod warunkiem* uszanowania centrów.
- **3 centra kontraktowe = cały blast radius**: `i18n/index.ts` (fan-in **25/24**), `lib/supabase.ts` `createClient` (fan-in **13**), `types.ts` DTO (fan-in **13**). Zmiana ich *kontraktu* promieniuje szeroko; cienkie wejścia (`pages/**`, `api/**`, `middleware.ts`) mają blast radius w górę = 0.
- **Jedna strefa wysokiego ryzyka: auth/runtime** — skrzyżowanie najgorętszego churnu, centrum struktury i bus-factoru (`createClient` napisał ktoś inny niż bieżący maintainer).
- **Unknowns / pułapki**: i18n edytowane „zawsze parą" en+pl; `reset-password`/`confirm-email` **celowo** poza guard'ami middleware; brak klasycznego test-runnera — bramki to `lint` + `build` (+ vitest/playwright).

## 3. Analiza ficzera (L3 — `password-reset-data-flow/research.md`)

**Co badałem i dlaczego:** przepływ resetu hasła (`forgot-password` → `reset-password`),
bo mapa (§4) wskazała auth/runtime jako jedyną strefę wysokiego ryzyka — najtwardszy
coupling (`supabase.ts` fan-in 13 → middleware runtime) i jedyny net-new flow z
udokumentowanym edge case'em.

**Feature overview:** input wchodzi przez formularze React → cienkie endpointy `api/auth/*`
(walidacja zod) → Supabase GoTrue. Stan zmienia się **poza tabelami aplikacji** — operuje
wyłącznie na `auth.users`; łącznikiem połówek jest krótkotrwała **sesja recovery**
mintowana przez `verifyOtp` (w SSR `.astro`) i kasowana przez `signOut`. Zwraca redirecty
(`?sent=1`, `/auth/signin?reset=1`).

**Technical debt (3 najważniejsze):**
- **D1 — guard wygasłej sesji (F1) ma ZERO pokrycia testowego** [test gap]. Naprawa
  `reset-password.astro:25-36` nie jest dotykana przez żaden test; revert do `showForm =
  Boolean(error)` przeszedłby suity na zielono. Najwyższy priorytet.
- **D2 — poczwórna prawda o długości hasła** [fragile coupling] — **potwierdzone ast-grepem
  (T7)**: `MIN_PASSWORD_LENGTH = 8` w **3 modułach TS** (`reset-password.ts`,
  `ResetPasswordForm.tsx`, `SignUpForm.tsx`) + `config.toml` = **4 miejsca**; dryf już
  wystąpił (2 zgnile komentarze „min 6"). Twierdzenie „3 miejsca" obalone → *gorzej* niż w trace.
- **D3 — kontrakt URL linku resetu jest string-only, rozrzucony na ≥4 miejsca** [hidden] —
  producenci (`recovery.html`, `forgot-password.ts`) ↔ konsument (`reset-password.astro`) ↔
  testy; żaden plik nie importuje pozostałych, więc niełapane statycznie.

> Metawniosek L3: każde „zero" z ast-grep walidowano grepem — dwa zera okazały się
> artefaktami narzędzia (`.astro` poza `--lang ts`, sufiks importu), nie kodu.

## 4. Plan refaktoryzacji (L4 — `refactor-opportunities/plan.md`)

**Co refaktoryzujemy:** kandydat **C1** (🥇) — zwinięcie zduplikowanego `MIN_PASSWORD_LENGTH`
do jednego `src/lib/constants.ts`, przypięcie nieimportowalnego mirrora (`config.toml`)
testem-strażnikiem dryfu, i zamiana go w realną bramkę przez wpięcie `npm test` do CI.

**Czego świadomie NIE robimy:** C2 (symbol kontraktu URL — wchodzi w strefę wrażliwą, wymaga
najpierw testu charakteryzującego D1); testy D1/D5; D6 (konfiguracja prod poza repo);
ruszania mechanizmu `token_hash`/`type=recovery` (decyzja nośna, nie dług); parametryzacji
4 stringów i18n „8".

**Fazy (1 linia + weryfikacja):**
1. Ekstrakcja stałej do `src/lib/constants.ts`, repointing 3 konsumentów, usunięcie zgniłych komentarzy — *auto* (`astro check` + `lint` + `build` + `npm test` + grepy).
2. Dodanie testu-strażnika dryfu `config.toml` (zielony lokalnie, CI nietknięte) — *auto* (`npm test`) **+ ręcznie** (czytelność komunikatu o dryfie).
3. Wpięcie `- run: npm test` do `ci.yml` (włączenie egzekucji) — *auto* (`grep` + przebieg Actions) **+ ręcznie** (potwierdzenie, że gate realnie blokuje merge).

## 5. Domena wg DDD (L5 — `context/domain/01–03`)

**Ubiquitous language (kluczowe pojęcia, z cytatami dokument↔kod):** *Flashcard* (root,
1 user), *Source ai|manual* (niezmienne pochodzenie), *Candidate Card* (przed akceptacją,
bez id), *Atomicity* (jeden fakt), *FSRS Schedule* (podzbiór kolumn czytany przez scheduler).
**Najważniejsze rozjazdy model-vs-kod:** *Atomowość* żyje **tylko w prompcie**
(`generation.ts:18-24`), bez egzekucji kodem; *Deck* **nie ma bytu** — to filtr po `user_id`;
sesja generacji trwa tylko w `localStorage` (błąd zapisu świadomie połykany).

**Niezmiennik #1 (L5-02): INV-3** — „karta wchodzi do talii **wyłącznie** przez jawną
promocję zweryfikowanego kandydata: wymuszone pochodzenie i własność, treść niepusta i
strukturalnie atomowa, zapis partii wszystko-albo-nic". Najbardziej rdzeniowy (operacjonalizuje
miernik 75%), najszerzej rozsmarowany (**5 warstw**: prompt, klient, 2 route, typy, SQL),
najsłabiej egzekwowany serwerowo. **Agregat: `Deck`** jako jedyne wejście karty do talii
(z VO `CardContent` jako jedynym miejscem facetów atomowości). Semantyczna atomowość celowo
zostaje przy człowieku w pętli (FR-009).

**Anti-Corruption Layer (L5-03): przeciek #1 = `ts-fsrs`** — kształt v5 `Card` przecieka przez
**5 warstw / 9 miejsc** (L1–L9): serwis, `types.ts` (`FsrsSchedule`), API, **wire-kontrakt**
(`RateResponse.schedule` — którego klient w ogóle nie czyta), **schemat DB** (9 kolumn) i typy
generowane. Jedyna zależność, którą PRD *jawnie* deklaruje jako wymienialną (`prd.md:123,155`),
a kod tej deklaracji nie dotrzymuje. ACL: VO `ReviewSchedule` + port `Scheduler` + jeden
adapter `TsFsrsScheduler`; kryterium sukcesu sprawdzalne grepem (`ts-fsrs` tylko w adapterze).

## 6. Decyzje, które należą do mnie

AI rozłożyło sygnały (churn, graf importów, fan-in, ast-grep) i wskazało strefy ryzyka oraz
rankingi kandydatów — ale **wybór jednej, bezpiecznej zmiany na teraz był mój**: spośród
ofensywnych refaktorów domenowych (agregat `Deck` dla INV-3, ACL na ts-fsrs) świadomie
wybrałem najmniej ryzykowny C1 (stała hasła + bramka CI), odkładając C2 i testy D1/D5, bo
wchodzą w strefę wrażliwą wymagającą najpierw charakteryzacji. Rozstrzygnąłem też **granicę
uczciwości**: semantyczna atomowość zostaje przy człowieku w pętli (FR-009), a kod egzekwuje
tylko facety strukturalnie sprawdzalne — to moja decyzja o zakresie, nie sugestia narzędzia.
Przyjąłem dyscyplinę weryfikacji („każde zero z ast-grep waliduj drugim narzędziem"), co
ujawniło, że dług D2 jest *gorszy* niż w pierwszym trace (4, nie 3 definicje). Zauważyłem
i poprawiłem nieaktualny zapis w `CLAUDE.md` („No test runner is configured" — runner istnieje).
