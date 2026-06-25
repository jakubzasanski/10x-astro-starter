# Artifact 3 — Contributors (kontekst kontrybutorów: obszar auth/runtime)

> Krok 3 mapy projektu. Pogłębienie **jednego** obszaru wybranego jako centralny
> i wrażliwy: **auth / runtime**.
> Wygenerowano: 2026-06-25. Okno: ostatnie 12 mies. (2025-06-25 → 2026-06-23).

## 0. Dlaczego ten obszar

Wskazany przez oba poprzednie artefakty jako skrzyżowanie najwyższego ryzyka:
- **Artefakt 1 (territory):** najgorętsze terytorium — `src/pages/auth` + `src/components/auth` (po 27 dotknięć plików), `api/auth` (10), `middleware.ts` (7); świeże i wrażliwe (auth + runtime).
- **Artefakt 2 (structure):** centrum struktury — `lib/supabase.ts` (`createClient`, fan-in 13) ⟶ `middleware.ts` (runtime gate) ⟶ `api/auth`. Zmiana kontraktu `supabase.ts` uderza w 13 plików, w tym middleware działający na każde żądanie.

**Zakres ścieżek obszaru:** `src/middleware.ts`, `src/lib/supabase.ts`,
`src/lib/config-status.ts`, `src/pages/auth/**`, `src/pages/api/auth/**`,
`src/components/auth/**`.

> **Uwaga o oknie czasowym:** repo jest skoncentrowane w 2026 (Artefakt 1), więc
> „ostatnie 12 miesięcy" pokrywa praktycznie całą historię obszaru. Najstarszy
> commit auth to 2026-03-12 — wszystko mieści się w oknie.

---

## 1. Kto pracował przy obszarze (ostatnie 12 mies.)

Commity dotykające ścieżek auth/runtime:

| Kontrybutor | Commity w obszarze | Repo-wide | Udział |
|---|---:|---:|---|
| **Jakub Zasański** | 12 | 95 | główny i bieżący maintainer |
| **„mkczarkowski"** | 4 | 16 | warstwa wizualna / redesign |
| **psmyrdek** (= „Przemek Smyrdek") | 2 | 10 (+2) | autor fundamentu auth |

> **Aliasy tożsamości:** `psmyrdek` i `Przemek Smyrdek` to ta sama osoba (dwie
> konfiguracje git). `„mkczarkowski"` ma w nazwie krzywe cudzysłowy — artefakt
> konfiguracji, nie literówka. `Claude` (1 commit repo-wide) nie dotyka obszaru.

**Liczby vs Artefakt 1:** tu liczę *distinct commity* dotykające ścieżki (np.
`src/pages/auth` = 9 commitów), a Artefakt 1 sumował per-plikowe dotknięcia w
katalogu (= 27). Obie metryki poprawne, mierzą co innego.

---

## 2. Tematy powtarzające się u konkretnych osób

Wiedza dzieli się **warstwowo wg ery i odpowiedzialności** — każda osoba ma inny „pas":

### psmyrdek — fundament (substrate), najstarszy, najrzadziej ruszany
- `2026-03-12` *built-in supabase & auth, rule utils*
- `2026-05-07` *gracefully handle missing Supabase config*
- **Pliki:** `lib/supabase.ts` (×2), `middleware.ts` (×2), `api/auth/{signin,signup,signout}.ts` (×2), `lib/config-status.ts`.
- **Temat:** położył **substrat runtime/auth** — klient Supabase SSR, szkielet middleware, rdzeń endpointów auth, graceful-degradation przy braku konfiguracji. To prawdopodobnie warstwa startera. **Rzadko dotykana = stabilna, ale wiedza skupiona w 1 osobie o niskiej obecności.**

### Jakub Zasański — bieżące zachowanie auth (current behavior owner)
- `2026-06-21..22` *account-access-recovery* — password-reset request + completion (p1/p2) + fixy impl-review F1–F4.
- `2026-06-23` *post-login-redirect* — land na `/dashboard`, guest-only guard w middleware.
- `2026-06-22..23` *ui-redesign* — auth/landing/dashboard, app shell, shared primitives.
- **Pliki:** `middleware.ts` (×5 — najwięcej), `auth/reset-password.astro` (×4), `auth/signin.astro` (×4), `ResetPasswordForm.tsx` (×3), `api/auth/reset-password.ts` (×2), `forgot-password.*`.
- **Temat:** **logika przepływów i bramki runtime** — reset hasła (jedyny net-new flow), redirecty po logowaniu, guardy tras, edge case'y sesji. Właściciel aktualnego *zachowania*.

### „mkczarkowski" — warstwa wizualna auth
- `2026-05-08..09` *redesign* (feature cards, cosmic background, `bg-cosmic`), *refinement* (ESLint/Prettier, deps, rename AlertCircle).
- **Pliki:** `auth/{signup,signin,confirm-email}.astro` (×3), prymitywy `FormField.tsx`/`ServerError.tsx` (×2), `SubmitButton`/`PasswordToggle`.
- **Temat:** **wygląd ekranów auth i prymitywy formularzy** — dotykał plików auth, ale w służbie redesignu/toolingu, **nie logiki uwierzytelniania**.

---

## 3. Co przeczytać przed zmianą (decyzje, PR-y, edge case'y)

Repo nie ma PR-ów na GitHubie jako źródła prawdy — ekwiwalentem są foldery
`context/archive/<change>/` (`change.md` = intencja, `plan.md` = decyzje,
`reviews/impl-review.md` = znalezione edge case'y). Kolejność wg ważności:

1. **`context/archive/2026-06-23-post-login-redirect/change.md`** — **decyzja o guardach middleware.** Definiuje `GUEST_ONLY_ROUTES` (inwersja `PROTECTED_ROUTES`) i **świadome wyłączenia**: `reset-password` i `confirm-email` są celowo pominięte w guest-guard, bo to strony „w trakcie flow" osiągane z sesją recovery/po-rejestracyjną. ⚠️ *Najłatwiejsza rzecz do przypadkowego zepsucia przy ruszaniu middleware.*

2. **`context/archive/2026-06-21-account-access-recovery/reviews/impl-review.md`** — **realne edge case'y reset hasła** (werdykt NEEDS ATTENTION → RESOLVED):
   - **F1 — pułapka wygasłej sesji:** po wygaśnięciu okna recovery (1h) z otwartym formularzem strona renderowała formularz w nieskończoność zamiast panelu „poproś o nowy link". Fix: sprawdzenie `supabase.auth.getUser()` w gałęzi błędu. *Czytaj przed dotknięciem `reset-password.astro`.*
   - **F3 —** `minimum_password_length = 6` poniżej rekomendowanego 8+ (świadoma decyzja konfiguracyjna).
   - **F4 —** test handlera nie pilnuje kolejności `signOut` po `updateUser`.

3. **`context/archive/2026-06-21-account-access-recovery/change.md` + `plan.md`** — **kontrakt sesji:** wymóg **7-dniowej sesji** (FR-005) jest rządzony przez **refresh-token lifetime** — ustawienie projektu Supabase w prod, tylko częściowo wyrażalne w lokalnym `config.toml`. Reset jedzie po istniejącej ścieżce mailowej Supabase (Mailpit `:54324` lokalnie) — **brak osobnej infry mailowej**.

4. **`src/middleware.ts` (stan obecny)** — krótka, ale gęsta w decyzje. Aktualny kształt:
   - `PROTECTED_ROUTES = ["/dashboard","/generate","/review","/cards"]` → redirect do `/auth/signin` gdy brak usera.
   - `GUEST_ONLY_ROUTES = ["/","/auth/signin","/auth/signup","/auth/forgot-password"]` → redirect do `/dashboard` gdy user zalogowany.
   - Dopasowanie: protected przez `startsWith`, guest przez `includes` (dokładne) — **różnica celowa** (chronimy prefiksy tras, ale guest-guard tylko dokładne ścieżki, żeby nie złapać `reset-password`/`confirm-email`).

5. **`context/archive/2026-06-23-astro-7-upgrade/`** — obszar przeszedł upgrade Astro 6→7 świeżo (czerwiec); jeśli ruszasz `astro:env`/adapter/middleware API, sprawdź co zmienił ten upgrade.

---

## 4. Czy wiedza jest rozproszona, czy skupiona

**Skupiona, ale warstwowo — z jednym ryzykiem bus-factora na fundamencie.**

```
                  fundament (substrat)        bieżące zachowanie        warstwa wizualna
                  ───────────────────         ──────────────────        ────────────────
  supabase.ts  ▸  psmyrdek                                              
  config-status▸  psmyrdek                                              
  middleware   ▸  psmyrdek (szkielet)    →    Jakub (guardy, redirecty)
  api/auth/*   ▸  psmyrdek (rdzeń)       →    Jakub (reset-password)
  auth pages   ▸                              Jakub (flow + redesign)   mkczarkowski (wygląd)
  auth comps   ▸                              Jakub                     mkczarkowski (prymitywy)
```

**Wnioski:**
- **Bieżące zachowanie auth jest skupione w 1 osobie (Jakub)** — wysoka spójność, łatwy kontakt, ale pojedynczy właściciel logiki reset/redirect/guard.
- **Fundament (supabase client + config-status + szkielet middleware/api) napisał ktoś inny (psmyrdek), tylko 2 commity, najstarsze.** To pliki rzadko ruszane → stabilne, ale **wiedza o *dlaczego* tak działają jest poza bieżącym maintainerem.** ⚠️ Największe ryzyko „tribal knowledge": kontrakt `createClient` (centrum z Artefaktu 2, fan-in 13) i graceful-config — przed ich zmianą warto odtworzyć intencję z commitów/plików, nie zakładać.
- **Warstwa wizualna (mkczarkowski) jest ortogonalna** do logiki — dotyka tych samych plików `.astro`, ale zmiany wyglądu można prowadzić niezależnie od auth-logiki (zgodne z klastrem B z Artefaktu 1: i18n/styl rusza się osobno).

**Rekomendacja przed większą zmianą w auth:**
- Zmiana *zachowania* (flow, guard, redirect) → konsultuj/czytaj prace **Jakuba** (pkt 1–3 powyżej).
- Zmiana *substratu* (`supabase.ts`, `config-status.ts`, szkielet middleware) → odtwórz intencję z commitów **psmyrdka** (pkt 4–5) i pamiętaj o blast-radius 13 plików z Artefaktu 2.
