---
title: Domain Distillation — 10xCards
created: 2026-06-25
type: domain-distillation
---

# Domain Distillation — 10xCards

> Produkt tej analizy to **mapa domeny**, nie kod. Nazwy bytów, agregatów i reguł
> zostały **odkryte** z dokumentów wizji oraz z kodu — każde pojęcie ma cytat źródłowy.
> Cytaty `plik:linia` odnoszą się do stanu repo z dnia 2026-06-25.

---

## KROK 0 — Kontekst projektu

**Czym jest produkt.** 10xCards zamienia wklejony tekst źródłowy w atomowe fiszki
question/answer i prowadzi użytkownika przez sesję powtórek z odstępami (spaced
repetition). Główna teza biznesowa: koszt ręcznego tworzenia fiszek jest tak wysoki,
że profesjonaliści rezygnują z spaced repetition — AI-generacja zbija ten koszt do zera
(`context/foundation/prd.md:22-24`).

**Dokumenty źródłowe (znalezione).**

| Dokument | Ścieżka | Rola w analizie |
| --- | --- | --- |
| PRD | `context/foundation/prd.md` | wizja, success criteria, 16 FR, non-goals, access control |
| Roadmap | `context/foundation/roadmap.md` | slices F-01, S-01..S-04, S-06; statusy (S-06 `blocked`) |
| Shape notes | `context/foundation/shape-notes.md` | narracja szczegółowa (materiał pomocniczy) |
| Tech stack | `context/foundation/tech-stack.md` | Astro 6 SSR + Supabase + ts-fsrs + Cloudflare |

**Stack i struktura (gdzie żyje logika biznesowa).**

- **API / trust boundary:** `src/pages/api/**` — endpointy walidują (zod), wymuszają
  ownership/origin, są jedynym miejscem zapisu.
- **Domena (logika czysta):** `src/lib/services/` — `scheduling.ts` (algorytm powtórek),
  `generation.ts` (destylacja tekstu → kandydaci). Brak osobnej warstwy "domain model" /
  agregatów — reguły są rozproszone (patrz KROK 4).
- **Persystencja:** Supabase Postgres, tabela `public.flashcards`, RLS per-user
  (`supabase/migrations/`). Typy generowane: `src/db/database.types.ts`, re-eksport w
  `src/types.ts`.
- **UI / state:** Astro pages (SSR) + React islands (`GeneratorView`, `ReviewSession`,
  `DeckView`, `ManualCardForm`). Stan sesji generacji żyje w `localStorage` po stronie klienta.

> **Ograniczenie analizy:** dokumenty wymagań istnieją i są bogate, więc destylacja opiera
> się głównie na nich + kodzie. Brak osobnej warstwy modelu domenowego oznacza, że wiele
> reguł "żyje" w SQL (CHECK/RLS), w schematach zod per-endpoint i w trikach typowych
> (`Pick<>`), a nie w jednym bycie — to materiał na KROK 4 i 5.

---

## KROK 1 — Ubiquitous Language

| Pojęcie | Definicja | Cytat źródłowy (dokument) | Gdzie żyje w kodzie |
| --- | --- | --- | --- |
| **Flashcard / Fiszka** | Para question/answer reprezentująca jeden uczony fakt, należąca do dokładnie jednego użytkownika | PRD Business Logic `prd.md:137-141`; Access `prd.md:145` | Encja `src/types.ts:7`; tabela `supabase/migrations/20260619123010_create_flashcards.sql:8-16` |
| **Source (origin) — ai \| manual** | Pochodzenie fiszki; ustalane przy tworzeniu i niezmienne | FR-009/FR-011 `prd.md:101,108`; success criterion "75% via AI" `prd.md:38` | Unia `CardSource` `src/types.ts:13`; CHECK `migrations/20260619123010…:13`; wymuszane serwerowo `api/cards.ts:108`, `api/cards/manual.ts:62` |
| **Candidate Card / Kandydat** | Fiszka wygenerowana przez AI **przed** akceptacją do talii (nie ma id, nie jest zapisana) | US-01 `prd.md:51-62`; FR-009 `prd.md:101` | `CandidateCard` `src/types.ts:34-37`; produkowany w `generation.ts:148` |
| **Atomicity (atomowość)** | Jedna fiszka = jeden samodzielny, jednoznaczny fakt; akapity wielofaktowe są dzielone, nie zlepiane | PRD Business Logic `prd.md:141` | **Tylko** w prompcie systemowym `generation.ts:18-24` — brak egzekucji kodem (patrz KROK 4) |
| **Source Text (tekst źródłowy)** | Wklejony fragment (≤ ~10 000 znaków) wejściowy do generacji; prywatny, nigdy nietrwały | FR-008 `prd.md:99`; guardrail prywatności `prd.md:46,130` | `GenerateRequest.sourceText` `src/types.ts:41-43`; cap `MAX_SOURCE_CHARS` `generation.ts:14` |
| **Deck / Talia** | Zbiór wszystkich fiszek jednego użytkownika; prywatny, bez współdzielenia | FR-012 `prd.md:113`; Access "exactly one user" `prd.md:145` | **BRAK osobnego bytu** — to wynik filtra po `user_id` + RLS; widok `DeckPage`/`DeckCard` `src/types.ts:22-30`; browse `api/cards.ts:40-75` |
| **Generation Session** | Trwająca sesja: kandydaci + decyzje accept/edit/reject, przeżywa refresh aż do zapisu lub odrzucenia | FR-010 `prd.md:103` | Stan klienta `GeneratorView.tsx`, `localStorage` `GeneratorView.tsx:10,55-67` — **brak bytu serwerowego** |
| **Review Session / Sesja powtórek** | Przejście przez karty due po jednej; reveal → rate → next | US-02 `prd.md:64-74`; FR-015 `prd.md:122` | Stan klienta `ReviewSession.tsx`; kolejka `api/review/due.ts` — **brak bytu serwerowego** |
| **Due / Termin** | Moment, od którego karta jest do powtórki (`due <= now`) | US-02 `prd.md:64` | Kolumna `due` `migrations/20260621130539…:12`; zapytanie `api/review/due.ts:34-39` |
| **FSRS Schedule** | Podzbiór kolumn karty czytany/zapisywany przez scheduler (ts-fsrs v5 Card) | Non-goal "off-the-shelf scheduler" `prd.md:155`; FR-015 `prd.md:122` | `FsrsSchedule` `src/types.ts:53-56`; kolumny `migrations/20260621130539…:11-24` + `…131214…:9-11` |
| **Recall Rating (Again/Hard/Good/Easy)** | Czterostopniowa ocena pamięci sterująca następnym terminem | FR-016 `prd.md:124` | `ReviewRating = 1\|2\|3\|4` `src/types.ts:60`; mapowanie `scheduling.ts:18-23` |
| **State (New/Learning/Review/Relearning)** | Stan karty w cyklu FSRS (0–3) | (pochodna ts-fsrs, non-goal `prd.md:155`) | CHECK `state in (0,1,2,3)` `migrations/20260621130539…:19`; `FsrsSchedule.state` `types.ts:55` |
| **Schedule-preserving edit** | Edycja treści fiszki NIE resetuje harmonogramu powtórek | FR-013 `prd.md:115` | Strukturalnie: PATCH przyjmuje tylko question/answer `api/cards/[id].ts:24,73` |
| **Anonymous Trial + Claim** | Gość generuje karty bez konta; po rejestracji w tej samej sesji karty są importowane | FR-001/FR-002 `prd.md:80-83` | **BRAK w kodzie** — `/generate` jest chronione `middleware.ts:5`; slice S-06 `blocked` `roadmap.md:143-153` |
| **Ownership / RLS** | Każda fiszka należy do jednego usera; brak dostępu do cudzych | Access `prd.md:145,151` | `user_id not null` + RLS `migrations/20260619123010…:10,31-43`; egzekwowane w każdym endpoincie |
| **Source-text privacy** | Tekst źródłowy nietrwały, nigdy w logach, nigdy do treningu | Guardrail `prd.md:46`; NFR `prd.md:130` | Komentarz-kontrakt `generation.ts:8`; generyczne błędy `generate.ts:55`; test `generation.privacy.test.ts` |

---

## KROK 2 — Klasyfikacja subdomen (Core / Supporting / Generic)

| Obszar / pojęcie | Kategoria | Uzasadnienie (odwołanie do celów produktu) |
| --- | --- | --- |
| **AI-distylacja tekstu → atomowe karty** (generation, atomicity, candidate review) | **CORE** | To jest przewaga i sens produktu — "paste-source-text beats manual workflow" `prd.md:24`. Success criteria mierzą wprost jakość rdzenia: 75% kart akceptowane, 75% kart powstaje przez AI `prd.md:37-38`. |
| **Harmonogram powtórek (scheduling / due / rating)** | **CORE (zintegrowany, nie budowany)** | Bez powtórek karta jest bezużyteczna — pełny flow "generate → review" to primary success criterion `prd.md:36`. ALE algorytm jest świadomie off-the-shelf (non-goal `prd.md:155`), więc rdzeniowa jest *integracja i niezmienniki* (kolejność, persystencja per-rating), nie sam algorytm. |
| **Deck management** (browse, edit, delete) | **SUPPORTING** | Konieczne, by produkt był użyteczny (FR-012/013/014), ale celowo minimalne: bez search/filter/tag/archive (non-goals `prd.md:159-160`). Wspiera rdzeń, nie stanowi przewagi. |
| **Manual card creation** | **SUPPORTING** | Świadomie zachowane mimo dominacji AI `prd.md:108-109`, ale to ścieżka uzupełniająca — non-core. |
| **Source-text privacy (guardrail)** | **SUPPORTING (krytyczny)** | Nie buduje przewagi, ale "even a flawless Primary outcome is a failure if material leaks" `prd.md:46` — porażka guardrailu unieważnia rdzeń. |
| **Auth (signup/verify/signin/reset/signout)** | **GENERIC** | Flat role model, email+hasło, standard — "no admin, no tiers" `prd.md:149`. Delegowane do Supabase; brak różnicowania produktowego. |
| **Anonymous trial + claim** | **CORE (aspiracyjny, niezrealizowany)** | Pomyślane jako hak onboardingowy do rdzeniowego "aha" przed signup `prd.md:81-83`, ale `blocked` przez Open Question #1 `roadmap.md:152` i nieobecne w kodzie. Sklasyfikowane jako rdzeniowa intencja, lecz dziś poza zakresem działającym. |

---

## KROK 3 — Kandydaci na agregaty i ich niezmienniki

| Agregat (kandydat) | Niezmiennik (musi być zawsze prawdziwy) | Cytat źródłowy | Status egzekucji w kodzie |
| --- | --- | --- | --- |
| **Flashcard** (root) | Należy do dokładnie jednego usera; nie da się czytać/pisać cudzej | `prd.md:145`; `migrations/…123010:10,31-43` | **EGZEKWOWANE** — `user_id not null` + 4 polityki RLS; każdy endpoint przez klienta usera |
| **Flashcard** | `source ∈ {ai, manual}`, ustalone przy tworzeniu i **niezmienne** | `prd.md:101,108`; `types.ts:17` | **EGZEKWOWANE** — DB CHECK `…123010:13`; serwer wymusza wartość (`api/cards.ts:108`, `manual.ts:62`); `UpdateFlashcardCommand` pomija `source` `types.ts:18`; PATCH strip `[id].ts:24` |
| **Flashcard** | Question i answer zawsze niepuste | Business Logic `prd.md:137-141` | **EGZEKWOWANE** — `not null` DB `…123010:11-12`; zod `.trim().min(1)` we wszystkich ścieżkach |
| **Flashcard** | `state ∈ {0,1,2,3}`; harmonogram zawsze prawidłowym ts-fsrs Card | non-goal `prd.md:155` | **EGZEKWOWANE** (częściowo) — CHECK na `state` `…130539:19`; round-trip Card ↔ schedule `scheduling.ts:33-61`. Pozostałe pola bez CHECK (np. `difficulty/stability` dowolny double) |
| **Flashcard** | Edycja treści NIE resetuje harmonogramu | FR-013 `prd.md:115` | **EGZEKWOWANE strukturalnie** — PATCH update tylko `{question, answer}` `[id].ts:73` |
| **Flashcard (rating)** | Nowy harmonogram liczony z **zapisanego** stanu + zegara serwera, nigdy z inputu klienta; zapis **przed** odpowiedzią (no-data-loss) | US-02 AC `prd.md:73`; guardrail `prd.md:47` | **EGZEKWOWANE** — `api/review/rate.ts:62-78` (read-modify-write); zod strip pól harmonogramu `rate.ts:15-18` |
| **Generation Session** | Kandydaci + decyzje accept/edit/reject przeżywają refresh aż do zapisu lub jawnego odrzucenia; żadna karta nie wchodzi do talii bez akcji save | FR-010 `prd.md:103`; FR-009 `prd.md:101` | **DEKLAROWANE, słabo egzekwowane** — tylko `localStorage` klienta `GeneratorView.tsx:55-67`; błąd zapisu *świadomie ignorowany* `GeneratorView.tsx:67`; brak kopii serwerowej |
| **Review Session** | Każda ocena utrwalona przed pokazaniem następnej karty; przerwana sesja wraca do pierwszej nieocenionej due | US-02 AC `prd.md:73-74` | **CZĘŚCIOWO** — per-rating persist `rate.ts:78` daje trwałość; "resume" = ponowny fetch `due.ts` (brak jawnego bytu sesji; działa, bo due-query jest bezstanowe) |
| **Deck** | Każda karta w dokładnie jednej talii jednego usera; brak współdzielenia | `prd.md:145` | **EGZEKWOWANE pośrednio** przez RLS — ale **brak bytu** `Deck`; to emergentny wynik zapytań, nie agregat |
| **Candidate → Flashcard promotion** | Atomowość (jeden fakt, samodzielny, jednoznaczny) | Business Logic `prd.md:141` | **IGNOROWANE w kodzie** — tylko instrukcja w prompcie `generation.ts:18-24`; jedyna realna egzekucja to człowiek w pętli (FR-009) |

---

## KROK 4 — Rozjazdy MODEL vs KOD (najcenniejsza część)

| # | Dokument mówi (MODEL) | Kod robi (KOD) | Dowód (plik:linia) | Komentarz |
| --- | --- | --- | --- | --- |
| D1 | FR-001/FR-002 **must-have**: gość generuje bez konta, karty są claimowane po rejestracji | `/generate` jest w `PROTECTED_ROUTES` → gość przekierowany na `/auth/signin`; brak importu kart, brak ścieżki anonimowej | MODEL `prd.md:80-83`; KOD `middleware.ts:5,36-40`; slice `roadmap.md:143-153` (`blocked`) | Największy rozjazd, ale to **decyzja zakresowa** (Open Question #1, deadline 2026-06-15 minął) — nie refaktor, tylko niezrealizowana funkcja |
| D2 | Karty są **atomowe by construction**: jeden fakt, samodzielne, jednoznaczne; wielofaktowe akapity dzielone | Kod nie weryfikuje atomowości — sprawdza tylko `min(1)` długości; reguła istnieje wyłącznie jako tekst promptu | MODEL `prd.md:141`; KOD prompt `generation.ts:18-24`, walidacja `generation.ts:44-51` | Rdzeniowy niezmiennik produktu nie ma egzekucji kodowej; jedyny "strażnik" to przegląd per-karta przez użytkownika (FR-009) |
| D3 | "**Deck**" jako pojęcie pierwszej klasy (browse, własność, prywatność) | Brak bytu `Deck` — to filtr po `user_id`; widoki to `Pick<>` z `Flashcard` | MODEL `prd.md:113,145`; KOD `types.ts:22-30`, `api/cards.ts:40-75` | Wiedza domenowa ("talia") nie ma odwzorowania w modelu — rozlana po zapytaniach. Akceptowalne dla MVP, ale ukrywa miejsce na niezmienniki (np. limity talii) |
| D4 | Sesja generacji (kandydaci + decyzje) przeżywa refresh — część guardrailu **no-data-loss** | Trwałość tylko w `localStorage`; przy błędzie zapisu wyjątek jest świadomie połykany; brak fallbacku serwerowego | MODEL `prd.md:103,47`; KOD `GeneratorView.tsx:55-67` (`// ignore` :67) | Niezmiennik guardrailu egzekwowany najsłabszym możliwym mechanizmem (storage klienta); wyczyszczenie storage = cicha utrata pracy |
| D5 | Harmonogram (`FsrsSchedule`) musi się zgadzać z kolumnami DB i kodem schedulera | Synchronizacja **ręczna** — komentarze "Kept in sync with the type" wskazują brak pojedynczego źródła prawdy | KOD `rate.ts:24`, `types.ts:53-56`, `scheduling.ts:33-61` | Niezmiennik utrzymany, ale przez konwencję, nie strukturę → ryzyko dryfu przy zmianie schematu |
| D6 | Rating aktualizuje kartę, która była **due** (sesja powtórek) | Endpoint `rate` nie weryfikuje, że karta jest due — oceni dowolną posiadaną kartę | MODEL US-02 `prd.md:64-74`; KOD `rate.ts:62-78` | Drobne; ts-fsrs `next()` policzy poprawnie i tak. Brak egzekucji "tylko due" — niegroźne dla pojedynczego usera |
| D7 | No-data-loss: ocena utrwalona, schedule spójny | Read-modify-write bez transakcji/optymistycznej blokady; równoległe oceny tej samej karty → lost update | MODEL `prd.md:47`; KOD `rate.ts:62-78` | Niskie prawdopodobieństwo (jedna sesja, jeden user), ale niezmiennik nie jest twardo chroniony |

**Zgodności warte odnotowania (MODEL = KOD, dobrze zrobione):** ownership/RLS (D-brak),
origin-immutability (`types.ts:17` ↔ `[id].ts:24`), schedule-preserving edit
(`[id].ts:73`), schedule-from-stored-state (`rate.ts:62-78`), privacy guardrail
(`generation.ts:8` + test). To pokazuje, że projekt egzekwuje niezmienniki tam, gdzie
zrobił to **strukturalnie** — rozjazdy dotyczą reguł trzymanych w prompcie / storage / konwencji.

---

## KROK 5 — Ranking refaktoru (wartość × ryzyko)

Wartość = jak rdzeniowy niezmiennik. Ryzyko = jak słabo egzekwowany dziś.

| Ranga | Kandydat | Wartość | Ryzyko (słabość egzekucji) | Uwaga |
| --- | --- | --- | --- | --- |
| **#1** | **Distylacja: atomowość + promocja Candidate → Flashcard** (D2) | **Najwyższa** — to *jest* rdzeń i miernik sukcesu (75%) | **Najwyższe** — reguła tylko w prompcie; brak bytu domenowego, logika rozlana: prompt (`generation.ts`) + klient (`GeneratorView`) + bulk-save (`cards.ts`) | Atomowość jest *semantyczna* (nie da się jej w 100% sprawdzić kodem), ale brak domowego bytu dla przejścia kandydat→karta to realny, wykonalny refaktor |
| #2 | **Generation Session jako jawny niezmiennik** (D4) | Wysoka — guardrail no-data-loss | Wysokie — `localStorage` + połknięty błąd, brak fallbacku | Najtańszy "duży" zysk dla guardrailu |
| #3 | **Konsolidacja niezmienników Flashcard / FsrsSchedule** (D5) | Wysoka — centralna encja | Średnie — egzekwowane, ale przez ręczną synchronizację i 4 osobne schematy zod | Refaktor anty-dryfowy: jedno źródło prawdy dla kolumn harmonogramu |
| #4 | **Byt Deck** (D3) | Średnia | Średnie — RLS chroni własność, brak bytu blokuje przyszłe niezmienniki (limity, statystyki) | Można odłożyć — non-goals trzymają zakres mały |
| #5 | **Atomowość zapisu rating** (D7) | Średnia (no-data-loss) | Niskie — single-user, mało prawdopodobne | Niski priorytet w MVP |
| — | **Anonymous trial (D1)** | n/d (funkcja) | n/d | To decyzja zakresowa (Open Question #1), nie refaktor niezmiennika |

### #1 do refaktoru — uzasadnienie

**Promocja Candidate → Flashcard z kontraktem atomowości to #1.** Powód: jest to dokładnie
ten niezmiennik, który stanowi przewagę produktu (`prd.md:22-24`) i jest mierzony przez
oba primary success criteria (`prd.md:37-38`), a jednocześnie ma **najsłabszą** egzekucję ze
wszystkich rdzeniowych reguł — żyje wyłącznie jako łańcuch znaków w prompcie systemowym
(`generation.ts:18-24`), bez bytu domenowego, który by go posiadał. Dziś wiedza o tym, czym
JEST poprawna fiszka, jest rozproszona: prompt zna regułę atomowości, klient
(`GeneratorView.tsx`) zna przepływ accept/edit/reject, a endpoint bulk-save (`api/cards.ts:77-119`)
zna tylko `min(1)` i wymuszenie `source:'ai'`. Refaktor: wydzielić moduł domenowy (np.
`src/lib/services/flashcard` lub typ promocji) odpowiedzialny za przejście kandydat→karta,
który kolokuje regułę atomowości (na ile sprawdzalna kodem: niepustość, brak numeracji,
brak „according to the text", limit długości) z ustawieniem origin i domyślnego harmonogramu —
tak, by jedyną „miękką" częścią pozostał ludzki przegląd (FR-009), a nie cała reguła. To
zamienia rdzeniowy, dziś nieuchwytny niezmiennik w jawny, testowalny element modelu.

---

## Podsumowanie

Ten artefakt destyluje domenę 10xCards z PRD/roadmapy i z kodu: buduje Ubiquitous Language
(15 pojęć z cytatami dokument↔kod), klasyfikuje subdomeny (Core: AI-distylacja i integracja
powtórek; Supporting: deck/manual/privacy; Generic: auth) oraz wskazuje kandydatów na agregaty
wraz ze statusem egzekucji ich niezmienników. Najważniejszy wniosek: projekt egzekwuje
niezmienniki bardzo dobrze tam, gdzie robi to **strukturalnie** (ownership/RLS,
origin-immutability, schedule-preserving edit, schedule-from-stored-state, privacy), a wszystkie
istotne rozjazdy MODEL↔KOD dotyczą reguł trzymanych „miękko" — w prompcie, w `localStorage`
albo w ręcznej synchronizacji typów. Rdzeniowy niezmiennik produktu — **atomowość fiszki i
przejście kandydat→karta** — nie ma dziś domu w modelu i żyje wyłącznie jako prompt, co czyni
go #1 kandydatem do refaktoru (najwyższa wartość, najsłabsza egzekucja). Drugorzędnie warto
utwardzić trwałość sesji generacji (guardrail no-data-loss oparty wyłącznie o klienta) i
skonsolidować definicję harmonogramu FSRS, by usunąć ryzyko dryfu. Rozjazd o najszerszym
zakresie (brak anonimowego trialu FR-001/FR-002) to świadomie zablokowana decyzja zakresowa,
nie dług w modelu domeny.
