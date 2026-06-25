---
title: Anti-Corruption Layer — isolating the spaced-repetition library (ts-fsrs)
created: 2026-06-25
type: refactor-plan
---

# Anti-Corruption Layer — izolacja schedulera (ts-fsrs)

> Produkt to **PLAN refaktoru**, nie implementacja — nie zmienia kodu produkcyjnego.
> Cytaty `plik:linia` zweryfikowane na repo z 2026-06-25.

---

## KROK 0 — Kontekst

**Deklaracja wymienialności (mocny sygnał).** PRD wprost mówi, że algorytm powtórek ma być
*off-the-shelf* i wymienialny:

- Non-goal: „**No custom spaced-repetition algorithm.** The MVP integrates an off-the-shelf
  scheduler; we do not write our own scheduling logic." (`context/foundation/prd.md:155`)
- FR-015 Socratic: „**Stack openness is binding** — the algorithm choice is downstream of this
  PRD, in the tech-stack-selection step. The PRD captures the capability and leaves the
  algorithm-shape as a stack decision." (`prd.md:123`)
- Kod sam to potwierdza: „PRD non-goal: we integrate an off-the-shelf scheduler (ts-fsrs), we do
  not write scheduling logic." (`src/lib/services/scheduling.ts:7`)

**Stack / zależności zewnętrzne (manifest).** `package.json`: `ts-fsrs ^5.4.1` (`:38`),
`@supabase/ssr`, `zod`, React 19, Astro. Warstwy: API (`src/pages/api`), domena/serwis
(`src/lib/services`), UI (`src/components`), persystencja (Supabase migrations + `database.types.ts`),
typy współdzielone (`src/types.ts`).

**Wniosek KROK 0:** intencja „dało się wymienić scheduler" jest zadeklarowana i binding. Pytanie
KROK 1–2: czy kod jej dotrzymuje.

---

## KROK 1 — Przeciekające zależności (kandydaci)

| Zależność | Sygnał przecieku | Werdykt |
| --- | --- | --- |
| **ts-fsrs** | Kształt `Card` biblioteki przecieka do **DB schema**, do **typów współdzielonych** i do **wire-kontraktu** (`RateResponse`); manualna „sync" kolumn | **← #1 przeciek** |
| LLM provider (OpenAI-compat) | Wołany tylko przez `fetch` w jednym pliku, bez SDK; konfiguracja przez `astro:env` | **Już izolowany** — `generation.ts` jest de facto adapterem; brak typów providera w API/UI |
| Supabase (`@supabase/ssr`) | `createClient` w middleware + każdym route + lib | Importowany szeroko, ale przez **jedną fabrykę** `@/lib/supabase`; typy DB generowane. Infrastrukturalny, nie „wymienialny" wg PRD — niższy priorytet |
| zod | W wielu route'ach | To walidacja brzegowa, nie domena — nie przeciek |

### Wszystkie pliki, które dziś „znają" ts-fsrs / jego kształt

| # | Plik:linia | Co wie o ts-fsrs |
| --- | --- | --- |
| L1 | `src/lib/services/scheduling.ts:1` | **Realny import** `ts-fsrs` (`Card, Grade, Rating, createEmptyCard, fsrs, generatorParameters`) |
| L2 | `src/lib/services/scheduling.ts:13,18-23,33-61` | Instancja schedulera; mapowanie `ReviewRating→Grade`; konwersja `Card ↔ FsrsSchedule` |
| L3 | `src/types.ts:51-56` | `FsrsSchedule` = `Pick<Flashcard, 9 kolumn>`; komentarz „**Mirrors the ts-fsrs v5 Card shape**" |
| L4 | `src/types.ts:79-80` | `RateResponse.schedule: FsrsSchedule` — **kształt biblioteki w kontrakcie wire** |
| L5 | `src/pages/api/review/rate.ts:23-24` | `SCHEDULE_COLUMNS` = ręcznie wypisane 9 nazw kolumn fsrs; komentarz „**Kept in sync with the type**" |
| L6 | `src/pages/api/review/rate.ts:83` | Zwraca `{schedule: next}` — kształt biblioteki przez wire do klienta |
| L7 | `supabase/migrations/20260621130539_add_fsrs_schedule_to_flashcards.sql:11-20` | 9 kolumn = pola ts-fsrs Card; komentarz „**mirror ts-fsrs createEmptyCard()**" |
| L8 | `supabase/migrations/20260621131214_reconcile_flashcards_to_fsrs_v5_card.sql:1-11` | **Migracja-rekoncyliacja**, bo ts-fsrs v5 Card różnił się od założeń (`+learning_steps`, `-elapsed_days`) |
| L9 | `src/db/database.types.ts:41-90` | Wygenerowane typy mirrorujące te kolumny |

Pliki, które **nie** powinny znać schedulera, a kształt na nie wpływa: `api/review/due.ts`
(czyta tylko `due` — neutralne), `ReviewSession.tsx`/`useReviewKeys.ts` (znają `ReviewRating`,
co jest OK — to skala FR-016, nie typ biblioteki).

---

## KROK 2 — Klasyfikacja i wybór #1

| Oś | ts-fsrs |
| --- | --- |
| (a) liczba warstw/plików | **5 warstw, 9 miejsc** (L1–L9): serwis, typy, API, **wire-kontrakt**, **DB schema**, typy generowane |
| (b) ryzyko/koszt wymiany dziś | **Wysoki** — wymiana schedulera dziś wymaga: migracji DB (zmiana 9 kolumn), zmiany `types.ts`, zmiany wire-kontraktu `RateResponse`, ręcznej synchronizacji `SCHEDULE_COLUMNS`. Historia: jedna migracja-rekoncyliacja już była potrzebna przy v5 (L8) |
| (c) deklaracja wymienialności | **TAK, binding** (`prd.md:123,155`) — i kod jej **nie dotrzymuje** |

**Wybór #1: ts-fsrs.** To jedyna zależność, którą dokumenty *jawnie* deklarują jako wymienialną,
a która jednocześnie przecieka najgłębiej — aż do **schematu bazy** i **kontraktu wire**. Rozjazd
intencja-vs-kod jest tu maksymalny: PRD mówi „algorithm-shape to decyzja wymienialna", a kod
zamroził kształt v5 Card w nieusuwalnych miejscach (kolumny DB, payload API). LLM i Supabase
odpadają: pierwszy jest już izolowany (`fetch`-adapter), drugi jest infrastrukturą, której PRD nie
obiecuje wymieniać.

---

## KROK 3 — Diagnoza przecieku

**Duplikacja kształtu Card (jedno źródło prawdy nie istnieje):**

- Lista 9 pól żyje **trzy razy**: jako kolumny DB (L7/L8), jako `Pick<>` w `types.ts:53-56` (L3),
  jako string `SCHEDULE_COLUMNS` w `rate.ts:24` (L5) — z komentarzem „Kept in sync with the type",
  czyli **synchronizacja ręczna = gwarantowany dryf** przy zmianie biblioteki.
- `scheduling.ts:33-61` rekonstruuje `Card` z `FsrsSchedule` i z powrotem — to *jedyne* miejsce,
  które *powinno* znać Card, ale dzieli tę wiedzę z DB i wire.

**Przeciek przez granicę klient/serwer (groźny w wymiarze kontraktu):**

- `RateResponse.schedule: FsrsSchedule` (L4) wysyła kształt biblioteki **przez wire do klienta**.
- A klient **w ogóle go nie używa**: `ReviewSession.tsx:58` czyta wyłącznie `DueResponse`; po
  ocenie sprawdza tylko `res.ok` (`ReviewSession.tsx:8-11,80`). Czyli eksponujemy kształt
  v5 Card w publicznym kontrakcie API **bez żadnego konsumenta** — czysty, bezkosztowy do usunięcia
  przeciek.
  > (Groźba „serwerowa biblioteka w bundlu klienta" tu nie zachodzi: `scheduling.ts` importuje
  > ts-fsrs tylko w route API, nie w islandzie React. Przeciek jest *kontraktowy/strukturalny*,
  > nie bundlowy — ale to wciąż przeciek granicy.)

**Przeciek do persystencji (najgłębszy):** 9 kolumn DB to bezpośrednie odwzorowanie pól v5 Card
(L7), a migracja L8 udowadnia, że zmiana wersji biblioteki **wymusiła DDL**. To dokładnie to,
czego PRD chciał uniknąć (`prd.md:155`).

**Dotrzymanie deklaracji:** PRD `prd.md:123` mówi „algorithm-shape = decyzja wymienialna". Kod jej
**nie dotrzymuje** — kształt jest zamrożony w DB + wire + 3 zduplikowanych miejscach.

---

## KROK 4 — Projekt ACL

Cel: ts-fsrs ma być znany **wyłącznie** w jednym adapterze. Reszta kodu zna `due` (pojęcie
domenowe, potrzebne do zapytań) + **nieprzezroczysty** stan algorytmu.

### Value object — `ReviewSchedule` (jedyne miejsce wiedzy o kształcie harmonogramu)

```ts
// src/lib/domain/review/review-schedule.ts  (NOWE, czyste, bez ts-fsrs)

// `due` jest domenowe i queryowalne. `state` jest NIEPRZEZROCZYSTY dla domeny — to blob,
// którego kształt zna tylko adapter. Domena nie czyta jego pól.
type AlgorithmState = Readonly<Record<string, unknown>>; // opaque; brand opcjonalnie

class ReviewSchedule {
  private constructor(
    readonly due: Date,
    readonly state: AlgorithmState, // serializowany 1:1 do kolumny jsonb
  ) {}
  static fromPersistence(due: string, state: AlgorithmState): ReviewSchedule {
    return new ReviewSchedule(new Date(due), state);
  }
  toPersistence(): { due: string; schedule_state: AlgorithmState } {
    return { due: this.due.toISOString(), schedule_state: this.state };
  }
}
```

### Wąski port (interfejs domenowy)

```ts
// src/lib/domain/review/scheduler.port.ts
import type { ReviewRating } from "@/types"; // 1..4, skala FR-016 — pojęcie domenowe, nie biblioteczne

export interface Scheduler {
  newCard(now: Date): ReviewSchedule;                                   // zastępuje createEmptyCard
  advance(current: ReviewSchedule, rating: ReviewRating, now: Date): ReviewSchedule;
}
```

### Adapter — JEDYNE miejsce importu ts-fsrs

```ts
// src/lib/domain/review/ts-fsrs.adapter.ts  (jedyny plik z `import ... from "ts-fsrs"`)
import { type Card, type Grade, Rating, createEmptyCard, fsrs, generatorParameters } from "ts-fsrs";
import type { Scheduler } from "./scheduler.port";
import { ReviewSchedule } from "./review-schedule";

const RATING_TO_GRADE: Record<ReviewRating, Grade> =
  { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy };

export class TsFsrsScheduler implements Scheduler {
  private readonly engine = fsrs(generatorParameters({ enable_fuzz: true }));

  newCard(now: Date): ReviewSchedule {
    const c = createEmptyCard(now);
    return ReviewSchedule.fromPersistence(c.due.toISOString(), this.toState(c));
  }
  advance(current: ReviewSchedule, rating: ReviewRating, now: Date): ReviewSchedule {
    const { card } = this.engine.next(this.toCard(current), now, RATING_TO_GRADE[rating]);
    return ReviewSchedule.fromPersistence(card.due.toISOString(), this.toState(card));
  }
  // toState/toCard: JEDYNE miejsce znające nazwy pól v5 Card (stability, difficulty,
  // scheduled_days, learning_steps, reps, lapses, state, last_review). Dziś = scheduling.ts:33-61.
  private toState(c: Card): AlgorithmState { /* pick z Card → plain obj (bez `due`, bez deprecated) */ }
  private toCard(s: ReviewSchedule): Card  { /* {...createEmptyCard(s.due), ...s.state, due:s.due} */ }
}
```

### Cienkie API (rate.ts po refaktorze)

```ts
// parse → port → persystencja przez repozytorium. Brak nazw kolumn fsrs, brak kształtu Card.
const { cardId, rating } = requestSchema.parse(body);
const sched = await reviewRepo.loadSchedule(cardId, user);   // ReviewSchedule | null  (RLS → 404)
if (!sched) return json({ error: "Card not found" }, 404);
const next = scheduler.advance(sched, rating, new Date());   // port, nie ts-fsrs
await reviewRepo.saveSchedule(cardId, next);                 // {due, schedule_state}
return json({ ok: true }, 200);                              // wire NIE zwraca kształtu schedulera
```

### Repozytorium

```ts
interface ReviewRepository {
  loadSchedule(cardId: string, user: User): Promise<ReviewSchedule | null>; // select due, schedule_state
  saveSchedule(cardId: string, s: ReviewSchedule): Promise<void>;           // update {due, schedule_state}
}
```

### Persystencja po refaktorze

Tabela trzyma **`due timestamptz`** (domenowe, indeksowane dla due-query) + **`schedule_state
jsonb`** (nieprzezroczysty blob algorytmu). 8 kolumn fsrs (stability…last_review) zwija się do
jednego `jsonb`. Indeks `flashcards_user_id_due_idx` (`…130539:23`) zostaje — operuje na `due`.

---

## KROK 5 — Dowód izolacji + before/after + rozstrzygnięcie kontraktu

### Dowód izolacji (co dotyka wymiana biblioteki)

| Warstwa | Przed ACL | Po ACL (wymiana schedulera dotyka?) |
| --- | --- | --- |
| Tabela DB / migracje | **TAK** (9 kolumn = Card; L7/L8) | **NIE** — `due` + `schedule_state jsonb`; nowy algorytm = inna *zawartość* jsonb, bez DDL |
| `database.types.ts` | TAK (L9) | NIE (kolumny się nie zmieniają) |
| `types.ts` (`FsrsSchedule`) | TAK (L3) | **Usunięte** — domena zna `ReviewSchedule` (opaque) |
| Wire `RateResponse.schedule` | TAK (L4/L6) | **Usunięte** — `{ ok: true }` |
| `api/review/rate.ts` | TAK (L5) | NIE — zna tylko port + repo |
| `api/review/due.ts` | nie | NIE (zawsze tylko `due`) |
| UI (`ReviewSession`) | nie (i tak nie czytał `schedule`) | NIE |
| **Adapter** | — | **TAK — i tylko on** |

### Before / After (zduplikowane miejsca)

| Miejsce | Before | After |
| --- | --- | --- |
| `scheduling.ts:1,33-61` | import ts-fsrs + konwersja Card↔schedule, eksport `schedule()` | przeniesione do `ts-fsrs.adapter.ts` (jedyny import); stara ścieżka usunięta |
| `types.ts:53-56` `FsrsSchedule` | `Pick<>` 9 pól, „Mirrors ts-fsrs Card" | usunięte; `ReviewSchedule` (due + opaque state) |
| `types.ts:79-80` `RateResponse` | `{ schedule: FsrsSchedule }` | `{ ok: true }` (brak kształtu biblioteki na wire) |
| `rate.ts:23-24` `SCHEDULE_COLUMNS` | ręczna lista 9 nazw + „Kept in sync" | znika; repo selektuje `due, schedule_state` |
| `rate.ts:83` | `json({schedule: next})` | `json({ok:true})` |
| DB 9 kolumn | mirror Card | `due` + `schedule_state jsonb` |
| UI | dostaje surowy kształt (nieużywany) | bez zmian — i tak czyta tylko `DueResponse` |

UI dostaje wyłącznie dane domenowe (`ReviewCard`, `DueResponse`) — nigdy surowego obiektu biblioteki.

### Rozstrzygnięcie otwartego pytania zależnego od kontraktu ts-fsrs

ts-fsrs v6 ma **usunąć** `elapsed_days` (już zdeprecjonowane) — to wymusiło migrację L8 przy v5.
**Decyzja:** kształt Card (które pola istnieją w danej wersji) kodujemy **w adapterze**
(`toState`/`toCard`), nie w DB ani API. Skutek: upgrade v5→v6 zmienia tylko serializację w
adapterze i *zawartość* jsonb; **zero DDL, zero zmian wire/typów**. To miejsce zakodowania decyzji:
`src/lib/domain/review/ts-fsrs.adapter.ts`, nie warstwa API.

---

## KROK 6 — Weryfikacja i plan faz

**Kryterium sukcesu (grep):**

```
grep -rn "ts-fsrs" src/            # po refaktorze: WYŁĄCZNIE src/lib/domain/review/ts-fsrs.adapter.ts (+ jego test)
grep -rn "FsrsSchedule" src/        # 0 trafień (typ usunięty)
grep -rn "SCHEDULE_COLUMNS" src/    # 0 trafień
```

Dziś zna zależność: L1–L9 (9 miejsc, 5 warstw). Po refaktorze: **1 plik** (adapter) + jego test.

**Plan faz (konwencja projektu: vitest unit/integration + Stryker; test-first dla czystej logiki):**

1. **Faza 1 — port + adapter + VO, TEST-FIRST** (`vitest --project unit`). Przenieś logikę z
   `scheduling.ts` (`scheduling.test.ts` istnieje — adaptuj testy do `Scheduler`/`ReviewSchedule`).
   Determinizm zachowany (fuzz seedowany z karty — `scheduling.ts:10-13`).
2. **Faza 2 — repozytorium + migracja DB**. Nowa migracja: dodaj `schedule_state jsonb`, backfill z
   9 kolumn (przez adapter `toState`), potem drop 8 kolumn (zostaw `due`). Test integracyjny
   round-trip (no-data-loss guardrail `prd.md:47`).
3. **Faza 3 — przepięcie `rate.ts`** na port+repo; usuń `FsrsSchedule`/`RateResponse.schedule`;
   zwracaj `{ok:true}`. `due.ts` bez zmian.
4. **Faza 4 — czyszczenie**: usuń `scheduling.ts`, `SCHEDULE_COLUMNS`; uruchom grepy z kryterium
   sukcesu jako bramkę.

> Koszt jednorazowy: faza 2 to realna migracja danych (9 kolumn → jsonb). Po niej *każda* przyszła
> wymiana schedulera jest adapter-only — to właśnie korzyść, której PRD oczekuje.

---

## Podsumowanie

Spośród zależności zewnętrznych dokument wybiera **ts-fsrs** jako najgorszy przeciek granic: to
jedyna biblioteka, którą PRD jawnie deklaruje jako wymienialną (`prd.md:123,155`), a której kształt
v5 `Card` przeciekł aż do **schematu bazy** (9 kolumn), **typów współdzielonych** (`FsrsSchedule`)
i **kontraktu wire** (`RateResponse.schedule`) — w sumie 9 miejsc w 5 warstwach, z ręczną
„synchronizacją" gwarantującą dryf. Diagnoza pokazuje potrójną duplikację listy pól i kontraktowy
przeciek klient/serwer, który jest tym bardziej jaskrawy, że klient `RateResponse.schedule`
**w ogóle nie czyta** (`ReviewSession.tsx:58`). Projekt ACL wprowadza value object `ReviewSchedule`
(domenowe `due` + nieprzezroczysty `schedule_state`), wąski port `Scheduler` i jeden adapter
`TsFsrsScheduler` — jedyne miejsce importu ts-fsrs i jedyne, które zna nazwy pól Card. Persystencja
zwija 8 kolumn fsrs do jednego `jsonb`, dzięki czemu przyszła wymiana algorytmu nie rusza DDL, API
ani UI. Otwarte pytanie wersji (deprecjacja `elapsed_days` w v6) rozstrzygamy w adapterze, nie w
warstwie API. Kryterium sukcesu jest sprawdzalne gołym grepem: po refaktorze `ts-fsrs` występuje
wyłącznie w pliku adaptera. Plan jest fazowy i test-first dla czystej domeny, z jawnym, jednorazowym
kosztem migracji danych w fazie 2.
