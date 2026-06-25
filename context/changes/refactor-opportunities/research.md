---
date: 2026-06-25T17:51:05+0200
researcher: Jakub Zasański
git_commit: 0d8f408818f83815a097ace3c5188ac8d653639c
branch: master
repository: 10x-astro-starter
topic: "Refactor opportunities — rank documented tech debt into structural candidates"
tags: [research, codebase, refactor, tech-debt, auth, i18n, ci, exploration, verified]
status: complete
last_updated: 2026-06-25
last_updated_by: Jakub Zasański
verification_commit: 0d8f408818f83815a097ace3c5188ac8d653639c
priors:
  - context/changes/password-reset-data-flow/research.md
  - context/map/repo-map.md
  - context/archive/2026-06-21-account-access-recovery/
  - context/archive/2026-06-23-post-login-redirect/change.md
---

# Research — Refactor opportunities

> **Cel:** odpowiedzieć na pytanie, które analiza `password-reset-data-flow` celowo zostawiła otwarte — **KTÓRE** z udokumentowanych problemów warto naprawić, **w jakim docelowym kształcie** i **w jakiej kolejności**. To etap **eksploracji**: zero refaktoru, zero decyzji. Wynik = ranking opcji z trade-offami, jako propozycja do osobnej sesji planowania.

## Research Question

Przeczytaj `context/changes/password-reset-data-flow/research.md` jako zebrane dowody (nie wyprowadzaj ich na nowo). Wypisz każdy odnotowany problem, sklasyfikuj go (KANDYDAT = naprawa zmienia **strukturę kodu**; reszta = wejście do oceny wykonalności/kosztu), zbadaj każdego kandydata w trzech wymiarach (obecny kształt / historia i intencjonalność / wykonalność migracji) i zamknij rankingiem 2–3 najmocniejszych z trade-offami. Twarde granice: dowody przed interpretacją, brak projektowania docelowej architektury poza nazwaniem kształtu, „unknown" zamiast domysłów.

**Metoda:** trzy równoległe sub-agenty read-only (obecny kształt / historia / wykonalność), priory przeczytane w głównym kontekście (`password-reset-data-flow/research.md`, `repo-map.md`, dwa archiwa, `lessons.md`). Każde twierdzenie zakotwiczone w `file:line`. Twierdzenia strukturalne tego raportu są przeznaczone do weryfikacji ast-grepem w osobnym przebiegu (prompt m4l4-3).

---

## ① Lista kandydatów (do audytu)

Z prior-raportu wyciągnięto problemy **D1–D6** + klaster „taniego długu". Klasyfikacja wg twardej reguły kontraktu (**KANDYDAT = naprawa zmienia strukturę kodu**):

| ID prior | Problem | Etykieta | Klasyfikacja | Uzasadnienie |
|---|---|---|---|---|
| **D2** | `MIN_PASSWORD_LENGTH` zdefiniowane w wielu miejscach (raport: 4) | fragile coupling | **KANDYDAT — C1** | Naprawa = ekstrakcja pojedynczego źródła → zmiana struktury |
| **D3** | Kontrakt URL linku resetu rozrzucony (raport: ≥4 miejsca) | fragile coupling / hidden | **KANDYDAT — C2** | Naprawa = wspólny symbol kontraktu/ścieżki → zmiana struktury |
| **D4** | Parytet i18n en/pl maskowany cichym fallbackiem | latent | **borderline — C3** | Strukturalna byłaby tylko zmiana kontraktu `t()`; realna naprawa to **guard typu/test** → patrz werdykt niżej |
| **D1** | Guard wygasłej sesji (F1) ma ZERO pokrycia | test gap | **NIE-kandydat** | Brakujący test nie zmienia struktury → **wejście do wykonalności** (charakteryzacja przed dotknięciem) |
| **D5** | Wykluczenie `reset-password` z `GUEST_ONLY_ROUTES` nieprzypięte | latent | **NIE-kandydat** | Brakujący test → wejście do wykonalności |
| **D6** | Dryf konfiguracji produkcyjnej (poza repo) | unknown | **NIE-kandydat** | Brak artefaktu w repo → nie ma czego refaktorować |
| — | Klaster „tani dług" (walidacja kliencka, typy/importy) | CI-caught | **NIE-kandydat** | Łapane przez lint/build albo lustrzane w zod (pokryte) |

→ **Dwóch twardych kandydatów strukturalnych: C1, C2.** Jeden borderline (C3) okazuje się niestrukturalny. Pełen werdykt per kandydat poniżej.

---

## ② Ustalenie przekrojowe (zmienia ranking): CI = tylko lint + build

Prior-raport zostawił to jako **Open Question #1** („Czy e2e biegnie w CI?"). **Rozstrzygnięte dowodem.**

- `.github/workflows/ci.yml:18-21` — kroki to `npm ci` → `npx astro sync` → `npm run lint` → `npm run build`. **Brak kroku `vitest`, brak `playwright`.** *(evidence)*
- `package.json:13-16` — skrypty `test` (vitest unit), `test:integration`, `test:e2e` istnieją i są uruchamialne lokalnie; configi obecne (`vitest.config.ts`, `playwright.config.ts`). *(evidence)*
- **Konsekwencja:** wszystkie istniejące testy (handler unit, RLS integration, e2e) biegną **wyłącznie lokalnie**. Bramka merge'a wywali się tylko na błędach typów/lintu/nierozwiązanych importów — **nigdy na regresji zachowania biznesowego.** *(inference, mocna)*
- Projekt `unit` w vitest jest **Docker-free** (`vitest.config.ts`) — w przeciwieństwie do `integration`/`e2e`, które wymagają lokalnego Supabase + Dockera.

**Dlaczego to istotne dla rankingu:** każdy guard/charakteryzacja, który dołożymy (C1, C3, D1, D5), jest *lokalną uprzejmością*, a nie bramką, dopóki do `ci.yml` nie wejdzie krok `npm test`. To czyni **„wepnij `npm test` (projekt `unit`) do CI"** najtańszym mnożnikiem dźwigni dla całego klastra — jednolinijkowa zmiana bez kosztu infry. Nie jest to refaktor (więc nie jest kandydatem), ale jest rekomendowanym **tanim, szybkim zyskiem** towarzyszącym.

---

## ③ Per kandydat — obecny kształt, intencjonalność, wykonalność

### C1 — Pojedyncze źródło prawdy dla długości hasła (z D2)

**Obecny kształt (evidence).** Literał `8` żyje w **8 miejscach (raport: 7)**, nie 4:
- 3× stała TS: `SignUpForm.tsx:9`, `ResetPasswordForm.tsx:9`, `reset-password.ts:7` (`const MIN_PASSWORD_LENGTH = 8`). *(evidence)*
- 1× TOML (faktyczny egzekutor przez GoTrue): `config.toml:190` `minimum_password_length = 8`. *(evidence)*
- 4× łańcuch i18n hardkodujący liczbę, **niespięty ze stałą**: `en.ts:99,105`, `pl.ts:98,104` („Min. 8 characters" / „…co najmniej 8 znaków" itd.). *(evidence)*
- Użycia: `SignUpForm.tsx:35,59`; `ResetPasswordForm.tsx:28,52`; `reset-password.ts:13` (`z.string().min()`), `:28` (interpolacja w komunikacie). *(evidence)*
- **Zgniłe komentarze:** `reset-password.ts:9` mówi „= 6"; `reset-password.test.ts:8` mówi „password min 6" — kontrakt to 8. *(evidence)*
- **Luka pokrewna:** `signup.ts` **nie ma** serwerowego sprawdzenia długości — deleguje do `supabase.auth.signUp` (`signup.ts:13`); jedyny floor signupu to klient + TOML/GoTrue. *(evidence)* — to nie część refaktoru SSOT, ale warto odnotować przy planowaniu.
- **Brak modułu wspólnych stałych:** `src/lib/` ma tylko `config-status.ts`, `supabase.ts`, `utils.ts`, `services/`; `src/types.ts` to DTO/encje (per CLAUDE.md). *(evidence)*

**Intencjonalność: deliberate-ale-miękka.** Duplikacja była **świadoma**, ale jako kopia precedensu, nie jako odrzucenie SSOT: `account-access-recovery/plan.md:167-169` — „Keep the constant in sync (**reuse/duplicate the value as SignUpForm does**)". Stała narodziła się w `SignUpForm.tsx` (commit `c0b0a87`, wartość 6), skopiowana do reset-flow w `9e40045`. Podniesienie 6→8 (commit `dc056b0`, fix F3 z impl-review) to **dokładnie ten ręczny fan-out, który SSOT by wyeliminował** (`impl-review.md:47-56`). Wniosek: 3 kopie TS = refaktorowalne do jednego symbolu; `config.toml` = realnie osobny runtime (nie da się zaimportować w TS). *(evidence)*

**Wykonalność (inkrementalna, odwracalna).**
- Abstrakcja: **nowa**, malutka — `src/lib/constants.ts` (obok `supabase.ts`/`utils.ts`). Importerzy: 3 pliki TS. *(inference)*
- Blast radius: **mały/zamknięty** — komponenty React to liście (fan-in 0), API to cienki kontroler (fan-in 0). Czysta podmiana wartości, bez zmian sygnatur. *(inference, zgodne z repo-map §2)*
- Istniejące osłony: `reset-password.test.ts:45-54` pinuje *zachowanie* (odrzucenie „abc"), nie *liczbę* — przeszłoby też dla 5. Brak `signup.test.ts`. → **żaden test nie łapie dryfu wartości dziś** (a i tak nie biegłby w CI). *(evidence)*
- Guard TOML↔TS: tylko test czytający `config.toml` jako tekst i porównujący `minimum_password_length === MIN_PASSWORD_LENGTH`. Wykonalny, ale lokalny dopóki nie ma `npm test` w CI. *(inference)*
- Stringi i18n i TOML **zostają lustrami** (nie da się ich zaimportować) — pełna naprawa wymaga albo parametryzacji komunikatów i18n, albo guarda. To granica refaktoru SSOT.
- **Pierwszy krok-prerekwizyt:** utworzyć `src/lib/constants.ts` z `MIN_PASSWORD_LENGTH = 8` i zastąpić 3 lokalne `const` importami. Mechaniczne, build-checked.

### C2 — Wspólny kontrakt URL linku resetu (z D3)

**Obecny kształt (evidence).** Ścieżka `/auth/reset-password` + para `token_hash` + `type=recovery` to **literały stringowe w każdym miejscu; zero wspólnego symbolu**:
- Producent (template): `recovery.html:4` — `{{ .SiteURL }}/auth/reset-password?token_hash={{ .TokenHash }}&type=recovery` (składnia Go-template GoTrue). *(evidence)*
- Producent (TS): `forgot-password.ts:24` — `redirectTo = new URL("/auth/reset-password", origin)`; **nie dokleja** `token_hash`/`type` (robi to GoTrue per template). *(evidence)*
- Konsument: `reset-password.astro:11-12,19,22` — czyta `searchParams` `token_hash`+`type`, bramkuje `type === "recovery"`, podaje do `verifyOtp`. *(evidence)*
- Testy: `mailpit.ts:25` (regex linku) + `password-reset.spec.ts:65-67,103` (asercje + hardkodowany `?token_hash=invalid-junk&type=recovery`). *(evidence)*

**Intencjonalność: wybór token_hash = mocno deliberate (nośny); brak wspólnego symbolu = accidental.** Mechanizm `token_hash`+`type=recovery` (zamiast PKCE `?code=`) to jedna z najlepiej udokumentowanych decyzji repo: `account-access-recovery/plan.md:68-77,145-153` + komentarz `config.toml:252-258` — stockowy `{{ .ConfirmationURL }}` idzie przez PKCE `/auth/v1/verify`, którego **serwer nie domknie cross-device**; SSR cookie-client nie robi PKCE. **Tego nie ruszamy.** Natomiast *rozrzucenie literału* nigdy nie było decyzją — accreted przez producenta/konsumenta/testy (commity `6ea11d1`, `9e40045`). *(evidence)* Archiwum `post-login-redirect/change.md` potwierdza, że recovery-flow jest wszędzie traktowany jako celowo specjalny (reset/​confirm wyłączone z guest-guard).

**Wykonalność.**
- Abstrakcja: **nowa** — `src/lib/auth-routes.ts` (ścieżka + nazwy parametrów). Spina jednak **tylko 2 z 3 stron TS** (`forgot-password.ts`, `reset-password.astro`); **`recovery.html` zostaje ręcznym lustrem** (Go-template poza grafem importów — jak TOML w C1). *(evidence/inference)*
- Blast radius: minimalny (oba pliki to cienkie wejścia, fan-in 0) — **ale strefa wrażliwa**: repo-map §4 stawia auth/runtime jako jedyną strefę wysokiego ryzyka, a `reset-password.astro` zawiera nietknięty testem branch D1 (`:25-36`). *(evidence)*
- Istniejące osłony (lokalne): `forgot-password.test.ts:56-58` (`redirectTo` ~ `/auth/reset-password$`); e2e `password-reset.spec.ts:65-67` **jako jedyne** przekracza granicę do `.html` (czyta realny mail przez Mailpit). Kontrakt template↔TS jest więc przypięty — ale tylko gdy ktoś odpali `test:e2e` z lokalnym Supabase + Dockerem. *(evidence)*
- **Pierwszy krok-prerekwizyt:** wprowadzić `src/lib/auth-routes.ts`; przepiąć `forgot-password.ts:24` i `reset-password.astro:11-22`; zostawić komentarz w `recovery.html` wskazujący moduł jako kanon.

### C3 — Parytet i18n en/pl (z D4) — **werdykt: niestrukturalny**

**Obecny kształt (evidence).** `i18n/index.ts:13-18` — `t()` ma dwa ciche fallbacki: brak klucza w `pl` → string **angielski**; brak w obu → **surowy klucz**. Bez throw/logu/ostrzeżenia. 25 plików importuje `@/i18n` (centrum kontraktowe #1, fan-in 25 per repo-map §2). Parytet **DZIŚ trzyma**: `auth.*` 45=45 (diff symetryczny pusty), total **132=132 (raport: 72)**. *(evidence; `comm` na kluczach `auth.*` — diff klucz-po-kluczu, nie tylko liczność)* Brak typowego powiązania kształtu `en` i `pl` (oba `Record<string,string>`) — kompilator nie egzekwuje parytetu. *(evidence)*

**Intencjonalność: deliberate (graceful degradation).** `git log --follow src/i18n/index.ts` → jeden commit `2c1cb75`; fallback obecny od pierwszej linii z docstringiem „falls back to the English catalog, then the key". To świadomy projekt, nie dryf. *(evidence)* Repo-map §2 niezależnie wskazuje to jako miejsce najczęstszego ukrytego długu („en bez pl") — ale to skutek *ciszy*, nie wadliwa intencja.

**Werdykt wykonalności — STOP na strukturze.** Realna naprawa to **guard, nie refaktor**: (a) typ `pl: Record<keyof typeof en, string>` → brak klucza wywala build; i/lub (b) vitest porównujący `Object.keys(en)` z `Object.keys(pl)` w obie strony. Zmiana `t()` na throw byłaby zmianą *zachowania* (utrata graceful degradation w prod), nie refaktorem. **Per kontrakt: zatrzymuję analizę strukturalną C3 — to test/guard, naturalnie spięty z przekrojowym ruchem „`npm test` do CI".** *(evidence + inference, zgodnie obu agentów)*

---

## ④ Refactor opportunities (ranked)

> Propozycja do **osobnej sesji planowania**. Decyzja, co realizujemy, zapada tam — nie tu.

### 🥇 #1 — C1: pojedyncze źródło prawdy dla `MIN_PASSWORD_LENGTH` ⭐ rekomendacja na „jedną bezpieczną zmianę"

- **Obecny → docelowy kształt:** 7 rozproszonych literałów `8` (3 stałe TS + TOML + 4 stringi i18n) → **jedna eksportowana stała w `src/lib/constants.ts`**, importowana przez 3 strony TS; TOML i stringi i18n zostają świadomymi lustrami (spinanymi guardem jako follow-up).
- **Dlaczego #1 (koszt długu vs koszt zmiany):** najwyższy stosunek redukcji-długu do ryzyka. Dług realny i **już częściowo zmaterializowany** (zgniły komentarz „6"; F3 pokazało ręczny fan-out 6→8). Koszt zmiany **niski**: czysta podmiana wartości, build-checked, fan-in 0, **nie wchodzi w wrażliwą strefę SSR auth/runtime** ani w nietknięty branch D1. Odwracalna trywialnie (jeden commit revert).
- **Blast radius:** 3 pliki TS (liście + cienki kontroler). Zero zmian sygnatur, zero migracji, zero dotknięcia runtime sesji.
- **Szkic ścieżki inkrementalnej:** (faza 1) `src/lib/constants.ts` + przepięcie 3 importów; (faza 2, osobny commit) parametryzacja komunikatów i18n lub guard TOML↔TS jako tripwire; (opcjonalnie) dopisać serwerowy floor w `signup.ts`.
- **Pierwszy krok-prerekwizyt:** utworzyć `src/lib/constants.ts` z `MIN_PASSWORD_LENGTH = 8`. (Charakteryzacja niepotrzebna — kod jest pokryty zachowaniowo przez handler-testy, a zmiana jest build-checked.)

### 🥈 #2 — C2: wspólny symbol kontraktu URL resetu

- **Obecny → docelowy kształt:** literał ścieżki+parametrów w 5 miejscach → `src/lib/auth-routes.ts` (ścieżka + nazwy `token_hash`/`type`/`recovery`), konsumowany przez `forgot-password.ts` i `reset-password.astro`; `recovery.html` zostaje ręcznym lustrem z komentarzem-wskaźnikiem.
- **Dlaczego #2 (trade-off):** dług realny (4–5-stronne sprzężenie stringowe), ale **payoff skromniejszy i ryzyko wyższe** niż C1: najryzykowniejszy producent (`recovery.html`) i tak **nie da się spiąć** (Go-template), więc refaktor de-duplikuje tylko 2 strony TS; w zamian wchodzi w **strefę wrażliwą** (repo-map §4) i ociera się o nietknięty testem branch D1 w `reset-password.astro`. Niższy stosunek redukcji-długu do ryzyka. Mechanizm `token_hash` (nośna decyzja) **pozostaje nietknięty** — refaktor dotyczy wyłącznie wspólnego symbolu.
- **Blast radius:** 2 cienkie wejścia (fan-in 0) — ale w gorącej strefie; e2e (lokalny) jest jedynym strażnikiem kontraktu template↔TS.
- **Szkic ścieżki:** (prerekwizyt) charakteryzacja branchu D1 w `reset-password.astro:25-36`, bo refaktor dotyka tego pliku; (faza 1) `src/lib/auth-routes.ts` + przepięcie `forgot-password.ts`; (faza 2) przepięcie `reset-password.astro` + komentarz-kanon w `recovery.html`.
- **Pierwszy krok-prerekwizyt:** **najpierw test charakteryzujący** branch wygasłej sesji (D1), dopiero potem `auth-routes.ts`.

### Tani, szybki zysk (towarzyszący, NIE refaktor) — wepnij `npm test` do CI

- Jednolinijkowy krok `- run: npm test` (projekt `unit`, Docker-free) w `ci.yml`. Zamienia istniejące handler-testy **oraz** każdy przyszły guard (C1 TOML, C3 parytet, D1/D5 charakteryzacja) z lokalnej uprzejmości w realną bramkę merge'a. Najwyższa dźwignia w całym klastrze; sensowny do wzięcia razem z #1.

---

## ⑤ Kandydaci rozważeni i odrzuceni

| Kandydat | Dlaczego odrzucony jako refaktor |
|---|---|
| **C3 — parytet i18n (D4)** | Niestrukturalny: realna naprawa to guard typu/test (`pl: Record<keyof typeof en, …>` lub vitest key-diff), nie zmiana struktury. Fallback `t()` jest celowy (graceful degradation) — nie ruszać. Naturalnie spięty z „`npm test` do CI". |
| **D1 — guard F1, zero pokrycia** | Brakujący test ≠ zmiana struktury. **Wejście do wykonalności:** charakteryzacja wymagana, zanim jakikolwiek refaktor dotknie `reset-password.astro` (gating dla C2). |
| **D5 — wykluczenie z GUEST_ONLY nieprzypięte** | Brakujący test. Wejście do wykonalności (regresja „posprzątania" listy middleware byłaby cicha). |
| **D6 — dryf konfiguracji prod** | Poza repo (dashboard Supabase) — brak artefaktu do refaktoru. Ryzyko operacyjne, nie strukturalne. |
| Klaster „tani dług" | Walidacja kliencka ma serwerowe lustro w zod (pokryte); niezgodności typów łapie lint/build. Nie liczone jako dług strukturalny. |
| **Refaktor mechanizmu `token_hash`** | Nośna decyzja architektoniczna (SSR nie robi PKCE) — nie dług. Wyłączone z zakresu. |

---

## Code References

- `.github/workflows/ci.yml:18-21` — bramki CI = `astro sync` + `lint` + `build`; brak vitest/playwright.
- `package.json:13-16`, `vitest.config.ts` — skrypty testowe istnieją; projekt `unit` Docker-free; nie biegną w CI.
- `src/lib/` (brak `constants.ts`) — brak modułu wspólnych stałych dla C1/C2.
- C1: `SignUpForm.tsx:9,35,59`, `ResetPasswordForm.tsx:9,28,52`, `reset-password.ts:7,13,28`, `config.toml:190`, `en.ts:99,105`, `pl.ts:98,104`; zgniłe komentarze `reset-password.ts:9`, `reset-password.test.ts:8`; brak floora `signup.ts:13`.
- C2: `recovery.html:4`, `forgot-password.ts:24`, `reset-password.astro:11-12,19,22`, `mailpit.ts:25`, `password-reset.spec.ts:65-67,103`.
- C3: `i18n/index.ts:13-18`; parytet `auth.*` 45=45, total 72=72; jeden commit `2c1cb75`.
- D1 (gating): `reset-password.astro:25-36` — branch nietknięty testem (e2e idzie branchem `:19`, nie `:25`).

## Architecture Insights

- **Najtwardszy fakt wykonalności jest przekrojowy, nie per-kandydat:** CI nie egzekwuje zachowania (lint+build only), więc każdy guard to lokalna uprzejmość, dopóki `npm test` nie wejdzie do `ci.yml`. To przesuwa najwyższą dźwignię z pojedynczego refaktoru na jednolinijkowy ruch CI.
- **Dwa „nieimportowalne lustra" ograniczają oba refaktory:** `config.toml` (C1) i `recovery.html` (C2) są poza grafem TS — wspólny symbol spina tylko strony TS; reszta zostaje lustrem domykanym guardem/komentarzem.
- **C1 izoluje się od strefy ryzyka, C2 nie:** C1 żyje w liściach (fan-in 0) poza auth/runtime; C2 wchodzi w gorącą strefę §4 i ociera się o nietknięty branch D1 — stąd kolejność.

## Historical Context (from prior changes)

- `context/changes/password-reset-data-flow/research.md` — źródłowy zapis długu (D1–D6) + tabela ast-grep (T1–T11), którą ten ranking rozszerza.
- `context/archive/2026-06-21-account-access-recovery/plan.md:167-169` + `reviews/impl-review.md:47-56` — decyzja „duplikuj stałą jak SignUpForm" (C1) i fan-out 6→8 (F3); decyzja token_hash vs PKCE (C2).
- `context/archive/2026-06-23-post-login-redirect/change.md` — celowe wyłączenie reset/confirm z guest-guard (kontekst D5/C2).
- `context/map/repo-map.md` §2/§4 — centra kontraktowe (i18n 25, supabase 13) i jedyna strefa wysokiego ryzyka auth/runtime.

## Open Questions

1. **C3/guardy:** czy w tej zmianie wpinamy `npm test` do CI razem z #1 (taki ruch zmienia ekonomię wszystkich guardów), czy zostawiamy jako osobny follow-up? → decyzja planowania.
2. **C1 zakres:** czy obejmuje parametryzację stringów i18n + serwerowy floor w `signup.ts`, czy tylko 3 stałe TS? → decyzja planowania.
3. **C2 vs D1:** czy w ogóle wchodzimy w C2 teraz, skoro wymaga uprzedniej charakteryzacji D1 i wchodzi w strefę wrażliwą? → decyzja planowania.

---

## ⑥ Weryfikacja twierdzeń (ast-grep)

> Narzędzie: `@ast-grep/cli` 0.44.0 (`npx --package @ast-grep/cli ast-grep run`). Reguła lekcji: **liczę ast-grepem dla precyzji, każde zero potwierdzam klasycznym grepem**, by odróżnić realny brak od złego wzorca/wywołania. Ograniczenie: ast-grep nie parsuje `.astro`/`.html`/`.toml` — te weryfikowane grepem. Sekcji „Refactor opportunities (ranked)" ani werdyktów intencjonalności NIE zmieniano; korekty liczb naniesiono w miejscu w formacie „X (raport: Y)".

| # | Twierdzenie (z raportu) | Werdykt | Dowód (plik:linia) | Metoda |
|---|---|---|---|---|
| V1 | `const MIN_PASSWORD_LENGTH` — 3 definicje TS | **potwierdzone** | `SignUpForm.tsx:9`, `ResetPasswordForm.tsx:9`, `reset-password.ts:7` | ast-grep `const MIN_PASSWORD_LENGTH = $V` (pozytyw na `SignUpForm.tsx:9`, exit 0) + grep |
| V2 | Literał `8` w „7 miejscach" | **doprecyzowane → 8** | 3 stałe TS + `config.toml:190` + i18n `en.ts:99,105`,`pl.ts:98,104` = **8** | grep (i18n/TOML poza TS); raport miał off-by-one |
| V3 | Zgniłe komentarze „min 6" | **potwierdzone** | `reset-password.ts:9`, `reset-password.test.ts:8` | grep |
| V4 | Brak wspólnego symbolu `MIN_PASSWORD_LENGTH` w `src/lib/` | **potwierdzone (realne zero)** | `src/lib/` = `config-status.ts`,`supabase.ts`,`utils.ts`,`services/` | ast-grep `export const MIN_PASSWORD_LENGTH = $V` → 0, **grep potwierdza brak** |
| V5 | `signup.ts` bez serwerowego floora długości | **potwierdzone (realne zero)** | `signup.ts:13` deleguje do `supabase.auth.signUp`; brak `.min(...)` | ast-grep `$$.min($N)` → 0, **grep potwierdza brak** |
| V6 | Kontrakt URL resetu „na 5 miejscach" | **doprecyzowane** | pełny kształt `token_hash&type=recovery` w **4**: `recovery.html:4`,`reset-password.astro`,`password-reset.spec.ts`,`mailpit.ts`; **5.** = `forgot-password.ts:24` niesie tylko *połowę-ścieżkę* (`new URL("/auth/reset-password", origin)`, bez parametrów) | grep (HTML/.astro poza ast-grep) |
| V7 | Brak wspólnego symbolu ścieżki `/auth/reset-password` | **potwierdzone (realne zero)** | brak `export const … = "/auth/reset-password"`; literały rozproszone | ast-grep per-plik `src/lib/*.ts` → 0, **grep potwierdza tylko literały** |
| V8 | Parytet i18n `auth.*` 45=45 | **potwierdzone** | `comm -3` na kluczach `auth.*`: diff symetryczny **pusty** | grep+`comm` |
| V9 | Parytet total „72=72" | **obalone → 132=132** | linie-klucze: en **132** = pl **132** (parytet trzyma; liczba inna niż szacunek sub-agenta 72) | grep `^\s*"key":` |
| V10 | CI = tylko lint+build (Open Q #1 prior-raportu) | **potwierdzone** | `.github/workflows/ci.yml:18-21` — `astro sync`+`lint`+`build`; brak vitest/playwright | odczyt pliku |

**Metawniosek z weryfikacji:** (a) ast-grep pod `npx` daje **fałszywe zera przy skanie katalogu i w pętlach** (pojedyncze wywołanie na plik działa — pozytyw na `SignUpForm.tsx:9`, exit 0) — wykryte i unieważnione grepem; to dokładnie pułapka, którą prior-raport zanotował. (b) Trzy realne zera (V4, V5, V7) potwierdzone grepem jako faktyczny brak, nie zły wzorzec. (c) Dwie korekty liczbowe (V2: 7→8; V9: 72→132) **nie ruszają rankingu** — pozycje C1/C2 stoją na `auth.* 45=45`, sprzężeniu wielomiejscowym i fan-in 0, które wszystkie się utrzymały. Żadna korekta nie podważa kolejności (brak adnotacji „do decyzji na etapie planowania").

---

> **Status:** raport eksploracji gotowy i zweryfikowany. Decyzja, co realizujemy, zapada w osobnej sesji planowania (`/10x-plan refactor-opportunities`) — nie tutaj.
