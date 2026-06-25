---
title: Invariant-Guardian Aggregate Refactor — 10xCards
created: 2026-06-25
type: refactor-plan
---

# Invariant-Guardian Aggregate Refactor — 10xCards

> Produkt tego dokumentu to **PLAN refaktoru**, nie implementacja. Nie zmienia kodu
> produkcyjnego. Bazuje na destylacji `context/domain/01-domain-distillation.md`, ale
> niezmienniki i agregat są tu wybrane od nowa na trzech osiach. Cytaty `plik:linia`
> zweryfikowane na repo z 2026-06-25.

---

## KROK 0 — Kontekst

- **Wizja/reguła rdzeniowa:** wklejony tekst → atomowe fiszki Q/A; przewaga = "paste-source-text
  beats manual workflow" (`context/foundation/prd.md:22-24`). Mierniki rdzenia: 75% kart
  akceptowanych, 75% kart powstaje przez AI (`prd.md:37-38`).
- **Business Logic:** karty są atomowe *by construction* — jeden fakt, samodzielne, jednoznaczne;
  akapity wielofaktowe są dzielone, nie zlepiane (`prd.md:137-141`).
- **Warstwy logiki biznesowej:**
  - API / trust boundary: `src/pages/api/**`
  - Domena (czysta): `src/lib/services/` (`generation.ts`, `scheduling.ts`) — **brak warstwy
    agregatów/modelu**; reguły rozlane po SQL + zod + trikach typowych
  - Persystencja: Supabase Postgres `public.flashcards` + RLS (`supabase/migrations/`)
  - UI/state: React islands; sesja generacji w `localStorage`
- **Stack testowy (istotne dla KROK 5):** vitest jest skonfigurowany — `test` = `vitest run
  --project unit`, `test:integration`, `test:e2e` = playwright, oraz Stryker mutation
  (`package.json:13-16,45-64`). Dyscyplina test-first jest realna (`*.test.ts` w `src/lib/services/`).
  > Uwaga: `CLAUDE.md` twierdzi "No test runner is configured" — to nieaktualne; runner istnieje.

---

## KROK 1 — Niezmienniki biznesowe (lista)

| ID | Niezmiennik (zawsze prawdziwy) | Źródło (dokument) | Gdzie żyje w kodzie |
| --- | --- | --- | --- |
| INV-1 | Fiszka należy do dokładnie jednego usera; nikt nie czyta/pisze cudzej | `prd.md:145,151` | RLS + `user_id not null` `migrations/…123010:10,31-43` |
| INV-2 | `source ∈ {ai, manual}`, ustalone przy tworzeniu i **niezmienne** | `prd.md:101,108` | CHECK `…123010:13`; wymuszane `api/cards.ts:108`, `manual.ts:62`; pominięte w update `types.ts:18`, `[id].ts:24` |
| INV-3 | **Karta wchodzi do talii TYLKO przez jawny zapis zweryfikowanych kandydatów; treść atomowa (jeden fakt, samodzielna, jednoznaczna, niepusta); zapis partii = wszystko-albo-nic** | `prd.md:101,103,137-141` | prompt `generation.ts:18-24`; decyzje accept/edit/reject `GeneratorView.tsx:73,111`; zapis `api/cards.ts:77-119` |
| INV-4 | Edycja treści NIE resetuje harmonogramu powtórek | FR-013 `prd.md:115` | strukturalnie: PATCH tylko question/answer `[id].ts:24,73` |
| INV-5 | Ocena liczona z **zapisanego** stanu + zegara serwera; zapis przed odpowiedzią | US-02 AC `prd.md:73`; `prd.md:47` | `api/review/rate.ts:62-78` |
| INV-6 | Sesja generacji (kandydaci+decyzje) przeżywa refresh aż do save/discard | FR-010 `prd.md:103` | tylko `localStorage` `GeneratorView.tsx:55-67` |
| INV-7 | Tekst źródłowy nietrwały, nigdy w logach, nigdy do treningu | guardrail `prd.md:46,130` | `generation.ts:8`; generyczne błędy `generate.ts:55`; test `generation.privacy.test.ts` |
| INV-8 | Usunięcie wymaga jawnego potwierdzenia | FR-014 `prd.md:117` | potwierdzenie tylko w UI; route kasuje `[id].ts:13,89-115` |

---

## KROK 2 — Klasyfikacja na 3 osiach i wybór #1

Osie: **(a) rdzeniowość** dla sensu produktu · **(b) rozsmarowanie** po warstwach ·
**(c) egzekucja** (EGZEKWOWANY / DEKLAROWANY / NARUSZALNY).

| ID | (a) Rdzeniowość | (b) Rozsmarowanie | (c) Egzekucja | Werdykt |
| --- | --- | --- | --- | --- |
| INV-1 ownership | wysoka | 1 warstwa (DB/RLS) | **EGZEKWOWANY** strukturalnie | solidny — nie ruszać |
| INV-2 origin-immutability | wysoka | 3 (DB, route, typy) | **EGZEKWOWANY** | solidny |
| **INV-3 promocja+atomowość** | **najwyższa** (to miernik 75%) | **najszersze: 5** (prompt, klient, 2 route, typy, SQL) | **NARUSZALNY** serwerowo — facety atomowości tylko w prompcie; klient jedynym strażnikiem decyzji | **← #1** |
| INV-4 schedule-preserving edit | średnia | 2 | EGZEKWOWANY strukturalnie | dobry |
| INV-5 rating-from-stored-state | wysoka | 2 | EGZEKWOWANY (brak blokady optymistycznej → drobnie NARUSZALNY) | mocny; #2 kandydat |
| INV-6 session no-data-loss | średnia-wysoka | 1 (klient) | **DEKLAROWANY** — klient jedyny strażnik, błąd połykany (`:67`) | słaby, ale klientowy z założenia |
| INV-7 privacy | wysoka (guardrail) | 2 | EGZEKWOWANY + test | dobry |
| INV-8 delete-confirmation | niska (UX) | 1 (klient) | klient jedyny strażnik | poza zakresem domeny |

### Wybór #1 — INV-3 i uzasadnienie

Wybieram **INV-3: „Karta wchodzi do talii wyłącznie przez jawną promocję zweryfikowanego
kandydata — z wymuszonym pochodzeniem i własnością, treścią niepustą i strukturalnie atomową —
a zapis partii jest wszystko-albo-nic."**

Jest jednocześnie **najbardziej rdzeniowy** (operacjonalizuje dokładnie tę regułę, która jest
sensem produktu i jest mierzona przez oba primary success criteria — `prd.md:37-38,137-141`) i
**najsłabiej egzekwowany strukturalnie**:

- Reguła atomowości żyje **wyłącznie** jako tekst promptu (`generation.ts:18-24`) — serwer
  zapisujący karty sprawdza tylko niepustość (`api/cards.ts:21-27`), więc dowolny klient może
  zapisać kartę łamiącą atomowość (numeracja, „according to the text", sklejone fakty).
- **Klient jest jedynym strażnikiem** tego, *które* kandydaty zostały zaakceptowane i jak
  wyedytowane — filtr `acceptedCards` i `updateCard` żyją w `GeneratorView.tsx:73,111`; serwer
  ich nie zna.
- Reguła jest **rozsmarowana po 5 miejscach** (prompt, klient, route bulk-save, route manual,
  typy/SQL) — nie ma jednego bytu, który by ją posiadał (potwierdza D2/D3 z destylacji).

INV-5 (rating) jest mocnym kandydatem #2, ale jest *już* egzekwowany serwerowo z zapisanego
stanu — jego słabość (brak blokady optymistycznej) jest drobna i mało prawdopodobna dla
single-usera. INV-3 łączy najwyższą rdzeniowość z realną naruszalnością → #1.

> **Granica uczciwości:** *semantyczna* atomowość („czy to naprawdę jeden fakt") jest
> nierozstrzygalna kodem — jej strażnikiem pozostaje **człowiek w pętli (FR-009)**. Agregat
> egzekwuje wszystkie **strukturalnie sprawdzalne** facety + całą resztę INV-3 (pochodzenie,
> własność, jawność wejścia, atomowość zapisu). To celowe zawężenie, nie pominięcie.

---

## KROK 3 — Diagnoza INV-3 (gdzie dziś żyje reguła)

| Warstwa | Co robi z regułą | Cytat | Ocena |
| --- | --- | --- | --- |
| Prompt LLM | Deklaruje atomowość i limit ≤30 | `generation.ts:18-24` | **deklaracja, nie egzekucja** — model może zignorować |
| Serwis generacji | Waliduje kształt (Q/A niepuste), cap 30, trim | `generation.ts:44-51,140-143` | egzekwuje *kształt*, nie *atomowość* |
| Klient (GeneratorView) | Trzyma decyzje accept/edit/reject, filtruje `acceptedCards`, wysyła do save | `GeneratorView.tsx:73,111,125-140` | **jedyny strażnik** „co i czy" wchodzi |
| Route bulk-save | Sprawdza `min(1)`, cap 30, wymusza `source:'ai'` + `user_id`, jeden `insert(rows)` | `api/cards.ts:21-27,105-118` | egzekwuje INV-1/INV-2 i niepustość; **NIE** facetów atomowości |
| Route manual | `min(1)`, wymusza `source:'manual'` + `user_id` | `api/cards/manual.ts:15-18,60-65` | druga, **niespójna** ścieżka wejścia tej samej reguły |
| Persystencja | `not null` na question/answer, CHECK na source, RLS | `migrations/…123010:11-13,31-43` | egzekwuje INV-1/INV-2; nic o atomowości |

**Wnioski diagnostyczne:**
1. **Brak warstwy egzekwującej facety atomowości** — między promptem (deklaracja) a DB
   (niepustość) nikt nie sprawdza struktury karty.
2. **Dwie niespójne ścieżki wejścia** (`api/cards.ts` POST i `api/cards/manual.ts`) powielają
   wymuszanie origin/owner i obie pomijają facety atomowości → reguła rozsmarowana i podatna na dryf.
3. **Klient jako jedyny strażnik** decyzji o akceptacji — serwer ufa, że ciało żądania to „to, co
   user zaakceptował"; nie ma serwerowego pojęcia „kandydat" ani „decyzja".
4. **Brak bytu „promocji"** — nie istnieje obiekt, którego nazwą jest „wejście karty do talii";
   jest tylko `insert`. (Atomowość *zapisu* partii jest dziś przypadkowo zachowana, bo to jeden
   statement `insert(rows)` `api/cards.ts:112` — ale nie jest *wyrażona* jako niezmiennik.)

---

## KROK 4 — Projekt agregatu-strażnika

### Wybór granicy agregatu

Root: **`Deck`** jako granica spójności „co może wejść do talii tego usera". W MVP **nie ma
niezmiennika międzykartowego** (brak unikalności, brak limitu liczby kart — `prd.md:159`), więc
`Deck.accept…` **nie ładuje wszystkich kart** — unikamy antywzorca zbyt dużego agregatu. `Deck`
jest tu strażnikiem *reguły wejścia*, a wyprodukowana `Flashcard` jest osobnym, małym agregatem
trwałości. Atomowość *partii* (wszystko-albo-nic) jest niezmiennikiem operacji `accept`, nie samego `Deck`.

### Wartości (Value Objects) i błędy domenowe

```ts
// src/lib/domain/flashcard/  (NOWA warstwa domenowa, czysta, bez I/O)

// VO: treść karty — jedyne miejsce facetów strukturalnej atomowości.
class CardContent {
  private constructor(readonly question: string, readonly answer: string) {}
  static create(question: string, answer: string): CardContent {
    const q = question.trim(), a = answer.trim();
    if (!q || !a) throw new EmptyCardContent();
    if (q.length > Q_MAX || a.length > A_MAX) throw new CardContentTooLong();
    // strukturalne facety atomowości (sprawdzalne kodem; semantyka -> człowiek FR-009)
    if (LEADING_NUMBER.test(q)) throw new NonAtomicCard("card numbering");
    if (META_REFERENCE.test(q) || META_REFERENCE.test(a)) // "according to the text", "as stated above"
      throw new NonAtomicCard("meta-reference to source");
    return new CardContent(q, a);
  }
}

type CardOrigin = "ai" | "manual";

// Nazwane błędy domenowe — nielegalna operacja RZUCA, nie loguje-i-jedzie.
class DomainError extends Error {}
class EmptyCardContent   extends DomainError {}
class CardContentTooLong extends DomainError {}
class NonAtomicCard      extends DomainError { constructor(readonly reason: string){ super(reason); } }
class EmptyBatch         extends DomainError {}
class BatchTooLarge      extends DomainError {}
```

### Root agregatu + metody domenowe (preconditions)

```ts
// Flashcard — mały agregat trwałości; tworzony WYŁĄCZNIE przez fabryki Deck.
class Flashcard {
  private constructor(
    readonly ownerId: string,
    readonly content: CardContent,
    readonly origin: CardOrigin,
    readonly schedule: NewSchedule, // due=now, state=New(0) — gotowa do powtórki (INV: S-02 default)
  ) {}
  static __forDeck(ownerId: string, c: CardContent, origin: CardOrigin) {
    return new Flashcard(ownerId, c, origin, NewSchedule.create());
  }
}

// Deck — JEDYNE wejście karty do talii. Egzekwuje INV-3 w całości.
class Deck {
  constructor(private readonly ownerId: string) {}

  // Promocja zweryfikowanych kandydatów (ścieżka AI). Atomowa w intencji: albo wszystkie
  // przechodzą walidację, albo żaden nie powstaje (rzut przed jakimkolwiek I/O).
  acceptCandidates(candidates: { question: string; answer: string }[]): Flashcard[] {
    if (candidates.length === 0) throw new EmptyBatch();
    if (candidates.length > MAX_CANDIDATES) throw new BatchTooLarge();
    // map rzuca na PIERWSZEJ złamanej karcie -> partia nie powstaje częściowo (fail-fast)
    return candidates.map((c) =>
      Flashcard.__forDeck(this.ownerId, CardContent.create(c.question, c.answer), "ai"),
    );
  }

  // Ścieżka manualna — ta sama reguła treści, inne pochodzenie. Druga ścieżka znika z route.
  addManualCard(question: string, answer: string): Flashcard {
    return Flashcard.__forDeck(this.ownerId, CardContent.create(question, answer), "manual");
  }
}
```

### Repozytorium (zapis partii w JEDNEJ transakcji)

```ts
// src/lib/domain/flashcard/deck-repository.ts
interface DeckRepository {
  // Wszystko-albo-nic. Jeden statement insert (już atomowy) LUB jawny rpc/transakcja, gdy
  // pojawi się krok wielotabelowy. owner/source pochodzą z agregatu, nie z klienta.
  saveNewCards(cards: Flashcard[]): Promise<{ saved: number }>;
}

class SupabaseDeckRepository implements DeckRepository {
  constructor(private readonly db: SupabaseClient) {}
  async saveNewCards(cards: Flashcard[]) {
    const rows = cards.map((c) => ({
      user_id: c.ownerId, question: c.content.question, answer: c.content.answer,
      source: c.origin, // due/state itd. = DB default (NewSchedule)
    }));
    const { error } = await this.db.from("flashcards").insert(rows); // single statement = atomic
    if (error) throw new PersistenceError();
    return { saved: rows.length };
  }
}
```

### Cienkie API (parse → metoda agregatu → mapowanie błędu)

```ts
// api/cards.ts POST  (po refaktorze — bez logiki domenowej)
const accepted = bodySchema.parse(await req.json());          // tylko kształt
const deck = new Deck(user.id);                               // owner z sesji, nie z ciała
let cards: Flashcard[];
try { cards = deck.acceptCandidates(accepted); }              // EGZEKUCJA na serwerze
catch (e) { return mapDomainError(e); }                       // 422 NonAtomicCard / EmptyBatch ...
const { saved } = await repo.saveNewCards(cards);             // wszystko-albo-nic
return json({ saved }, 201);

// mapDomainError: EmptyBatch/BatchTooLarge/NonAtomicCard/Empty.../TooLong -> 422 z `reason`;
//                 PersistenceError -> 500 generyczne (bez echa treści).
```

Egzekucja **przenosi się z klienta na serwer**: facety atomowości i decyzja „co wchodzi" są
teraz wymuszane w `Deck`, niezależnie od tego, co wyśle klient. UI nadal może walidować *zawczasu*
(UX), ale przestaje być *strażnikiem*.

---

## KROK 5 — Before/After, fazy, testy, nazwy

### Before / After (każde dzisiejsze miejsce reguły)

| Miejsce | Before | After |
| --- | --- | --- |
| `generation.ts:18-24` (prompt) | jedyne „miejsce" atomowości | zostaje (guiding the model), ale **przestaje być jedynym strażnikiem** |
| `GeneratorView.tsx:73,111` | klient decyduje co wchodzi; serwer ufa | klient = UX prewalidacja; `Deck` na serwerze rozstrzyga |
| `api/cards.ts:105-118` | `min(1)` + ręczne origin/owner + insert | parse → `Deck.acceptCandidates` → `repo.saveNewCards`; origin/owner z agregatu |
| `api/cards/manual.ts:60-65` | druga, niespójna ścieżka | `Deck.addManualCard` → ten sam `repo`; jedna reguła treści |
| facety atomowości | **nigdzie** w kodzie | `CardContent.create` (jedyne miejsce) |
| atomowość zapisu partii | niejawna (przypadkiem 1 insert) | jawny kontrakt `DeckRepository.saveNewCards` (wszystko-albo-nic) |

### Plan faz (test-first tam, gdzie to czysta logika)

1. **Faza 1 — domena, TEST-FIRST** (`vitest --project unit`). Napisz testy dla `CardContent` i
   `Deck.acceptCandidates`/`addManualCard` (przypadki niżej), potem implementacja. Czysta, bez I/O →
   idealna pod test-first; rozważ próg Stryker (runner już jest, `package.json:47`).
2. **Faza 2 — repozytorium + integracja** (`test:integration`). `SupabaseDeckRepository`; test, że
   partia z jedną złą kartą **nie zapisuje żadnej** (fail-fast przed I/O) i że owner/source pochodzą
   z agregatu, nie z ciała.
3. **Faza 3 — przepięcie route** (`api/cards.ts`, `api/cards/manual.ts`) na agregat + `mapDomainError`.
   Zachowaj kontrakt odpowiedzi (`{saved}` / 201) i prywatność błędów (`generate.ts:55` jako wzorzec).
4. **Faza 4 — UI jako prewalidacja** (nieblokująca): `GeneratorView` może uprzedzać błędy domenowe
   dla UX, ale nie jest już strażnikiem. Brak zmian kontraktu.

### Przypadki testowe dla INV-3

**Legalne (muszą przejść):**
- `CardContent.create("What is RLS?", "Row-level security.")` → ok.
- `Deck.acceptCandidates([1..30 poprawnych])` → 30 `Flashcard`, każda `origin="ai"`, schedule New/due-now.
- `Deck.addManualCard("Q","A")` → `origin="manual"`.

**Nielegalne (muszą RZUCIĆ nazwany błąd — fail-fast):**
- pusty/whitespace question lub answer → `EmptyCardContent`.
- pytanie z numeracją „1. ..." → `NonAtomicCard("card numbering")`.
- „According to the text, ..." w Q lub A → `NonAtomicCard("meta-reference to source")`.
- treść > limitu → `CardContentTooLong`.
- `acceptCandidates([])` → `EmptyBatch`; `acceptCandidates([31])` → `BatchTooLarge`.
- **partia z 1 złą kartą** → rzut, `repo.saveNewCards` **nie wołane** (żadna karta nie zapisana).
- route: klient wysyła `source:"admin"`/`user_id` innego usera → zignorowane (origin/owner z agregatu);
  nielegalna treść → **422**, nie 201.

### Nowe „load-bearing" nazwy do rejestracji (kontrakty)

Projekt nie ma jeszcze rejestru kontraktów, ale te nazwy są nośne i warte spisania (np. w
`context/foundation/` lub w nagłówkach plików, jak istniejące „Kept in sync"):

- `Deck` (root) — jedyne wejście karty do talii.
- `Deck.acceptCandidates` / `Deck.addManualCard` — jedyne fabryki `Flashcard`.
- `CardContent` (VO) — jedyne miejsce facetów strukturalnej atomowości.
- `DeckRepository.saveNewCards` — kontrakt zapisu wszystko-albo-nic.
- Błędy domenowe: `EmptyCardContent`, `CardContentTooLong`, `NonAtomicCard`, `EmptyBatch`,
  `BatchTooLarge`, `PersistenceError` — mapowane przez `mapDomainError`.

---

## Podsumowanie

Dokument wybiera spośród ośmiu niezmienników 10xCards jeden do utwardzenia: **INV-3 — karta
wchodzi do talii wyłącznie przez jawną promocję zweryfikowanego kandydata, z wymuszonym
pochodzeniem i własnością, treścią niepustą i strukturalnie atomową, a zapis partii jest
wszystko-albo-nic.** Wybrano go, bo na trzech osiach jest jednocześnie najbardziej rdzeniowy (to
operacjonalizacja reguły mierzonej przez oba primary success criteria), najszerzej rozsmarowany
(prompt + klient + dwa route'y + typy + SQL) i najsłabiej egzekwowany serwerowo — facety
atomowości żyją tylko w prompcie, a klient jest jedynym strażnikiem tego, co faktycznie wchodzi do
talii. Diagnoza pokazuje brak warstwy egzekucji między promptem a DB, dwie niespójne ścieżki
wejścia i brak bytu „promocji". Projekt wprowadza agregat-strażnik **`Deck`** jako jedyne wejście,
z value object `CardContent` jako jedynym miejscem facetów atomowości, nazwanymi błędami domenowymi
(fail-fast, nie loguj-i-jedź), repozytorium gwarantującym zapis wszystko-albo-nic i cienkimi
route'ami mapującymi błąd domenowy na 422. Plan jest fazowy i test-first dla czystej domeny
(vitest + Stryker już są), z jawną listą legalnych i nielegalnych przejść. Semantyczna atomowość
celowo pozostaje przy człowieku w pętli (FR-009) — kod egzekwuje wszystko, co strukturalnie
sprawdzalne, i przenosi strażnika z klienta na serwer.
