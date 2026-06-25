# Repo Map — 10x-astro-starter

> Mapa decyzyjna, nie opis repo. Synteza trzech raportów roboczych
> ([territory](artifact-1-territory.md) · [structure](artifact-2-structure.md) ·
> [contributors](artifact-3-contributors.md)). Wygenerowano: 2026-06-25.

## TL;DR (jeśli czytasz tylko to)

Astro 6/7 SSR + React islands + Supabase auth, na Cloudflare Workers. Architektura
**czysta** (DAG, zero cykli, zero krawędzi wstecznych), więc bezpieczna do zmian —
pod warunkiem, że uszanujesz **3 centra kontraktowe** i **1 obszar wrażliwy**.

- **76% historii powstało w czerwcu 2026** — repo jest „świeże = w ruchu", nie dojrzałe.
- **Najgorętszy i najwrażliwszy obszar: auth/runtime.**
- **Cienkie wejścia** (strony, endpointy) edytujesz w izolacji; **centra** (i18n, supabase, types) ruszasz świadomie.

---

## 1. Gdzie naprawdę dzieje się praca (dowód: churn)

| Obszar | Sygnał | Wniosek |
|---|---|---|
| **auth** (`pages/auth`, `components/auth`, `api/auth`) | 27+27+10 dotknięć; najświeższy | Główne pole gry; patrz §4 |
| **i18n** (`en.ts`/`pl.ts`) | 15; **zawsze para** | Edycja jednego bez drugiego = ukryty dług |
| **styl/redesign** (`global.css`, layouty) | 13; klaster z i18n | Wizualne, nie wrażliwe na bezpieczeństwo |
| **build/config** (`astro.config.mjs`, `package.json`) | 11/22; sprzężone (8) | Częste migracje (Astro 6→7); CI wymaga `astro sync` |

**Szum (ignoruj jako sygnał):** `package-lock.json`, `.10x-cli-manifest.json`,
`supabase/.temp`, generowany `db/database.types.ts`, cały `context/changes|foundation`
(artefakty kursu), `.cursor/rules`.

---

## 2. Co od czego zależy (dowód: graf importów `src/**`)

Graf jest **acyklicznym DAG-iem** (Tarjan SCC: 0 cykli), warstwy płyną w jedną stronę:
`page → component/layout` · `api → service/lib → types → db`. Brak krawędzi wstecznych.

**3 centra kontraktowe = cały blast radius:**

| Kontrakt | Fan-in | Zmiana *kontraktu* psuje |
|---|---:|---|
| `src/i18n/index.ts` | **25** | niemal cały UI + middleware |
| `src/lib/supabase.ts` (`createClient`) | **13** | api/auth + dane + **middleware (runtime)** |
| `src/types.ts` (DTO) | **13** | api ↔ service ↔ component (łapie typecheck) |

**Cienkie wejścia (fan-in 0, blast radius w górę = 0):** wszystkie `pages/**` i
`pages/api/**` oraz `middleware.ts`. Endpointy są cienkimi kontrolerami —
logika siedzi w `lib/services`. Edytuj je lokalnie bez obaw.

---

## 3. Kto wie co (dowód: git blame/log, 12 mies.)

Wiedza **skupiona warstwowo**, nie rozproszona:

- **Jakub Zasański** — bieżące *zachowanie* auth (reset hasła, redirecty, guardy). Główny maintainer (95 commitów repo-wide).
- **psmyrdek / Przemek Smyrdek** — *fundament* (`supabase.ts`, `config-status.ts`, szkielet middleware/api), 2 najstarsze commity. ⚠️ **Bus-factor:** kontrakt `createClient` (centrum #2) napisał ktoś inny niż bieżący maintainer.
- **mkczarkowski** — tylko *warstwa wizualna* auth (ortogonalna do logiki).

---

## 4. Strefa wysokiego ryzyka: auth/runtime

Skrzyżowanie wszystkich trzech sygnałów (najgorętsze + centrum struktury + bus-factor):
`lib/supabase.ts` → `middleware.ts` → `api/auth` + ekrany auth.

**Przeczytaj PRZED dotknięciem (kolejność wg ważności):**
1. `context/archive/2026-06-23-post-login-redirect/change.md` — guardy middleware; **`reset-password` i `confirm-email` celowo wyłączone** z guest-guard (strony „w trakcie flow"). Najłatwiejsze do przypadkowego zepsucia.
2. `context/archive/2026-06-21-account-access-recovery/reviews/impl-review.md` — edge case **F1** (pułapka wygasłej sesji reset, okno 1h), F3 (długość hasła), F4 (kolejność `signOut`).
3. Kontrakt **7-dniowej sesji** = refresh-token lifetime (ustawienie Supabase w prod, poza `config.toml`).

**Stan middleware (obecny):** `PROTECTED_ROUTES` (match przez `startsWith`) →
redirect na `/auth/signin`; `GUEST_ONLY_ROUTES` (match dokładny `includes`) →
redirect na `/dashboard`. Różnica w dopasowaniu jest celowa.

---

## 5. Reguły decyzyjne (ściąga przed zmianą)

| Jeśli ruszasz… | To… |
|---|---|
| stronę / endpoint (`pages/**`) | edytuj w izolacji — zero blast radius w górę |
| `i18n` | **zawsze `en.ts` + `pl.ts` razem**; zmiana kształtu eksportu = 25 plików |
| `lib/supabase.ts` / `types.ts` | zmiana *kontraktu* = świadoma rewizja 13 plików; uruchom `astro check` |
| middleware / auth flow | najpierw §4 (decyzje + edge case'y); konsultuj prace Jakuba |
| fundament auth (`supabase.ts`, `config-status.ts`) | odtwórz intencję z commitów psmyrdka — wiedza poza bieżącym maintainerem |
| zależności / Astro | `astro.config.mjs` ↔ `package.json` razem; CI: `astro sync` przed lint/build |

**Bramki walidacji:** brak test runnera w starym sensie — `npm run lint` +
`npm run build` to jedyne gates CI; testy: `vitest` (unit/integration) + `playwright` (e2e).
