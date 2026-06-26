# @sage/code-reviewer

Oskryptowany agent do code review zbudowany na **Codex SDK** (10xDevs M5L2).
Czyta git diff na stdin, zwraca ustrukturyzowaną ocenę JSON: pięć kryteriów w skali 1-10
(poprawność, idiomatyczność, złożoność, pokrycie testami, bezpieczeństwo), wiążący werdykt
(`pass`/`fail`) i podsumowanie w Markdown.

To **niezależna paczka** — własny `package.json`, `node_modules` i `tsconfig`, świadomie
wykluczona z lintu/typecheku/CI aplikacji Astro (`packages/**`).

## Kategoria SDK

Codex SDK to **gotowy agent**: opakowuje binarkę `codex` CLI (JSONL przez stdio) i wciąga
cały harness agenta. Pętlę narzędziową, sesje i sandbox dostajesz w pakiecie; ceną jest
przywiązanie do runtime'u i modeli OpenAI.

## Setup

```bash
npm install                      # w tym katalogu
cp .env.example .env             # i wklej OPENAI_API_KEY
```

Uwierzytelnienie (jedno z):

- `OPENAI_API_KEY` (lub `CODEX_API_KEY`) w `.env` albo w shellu,
- `codex login` (logowanie przez ChatGPT).

## Uruchomienie

```bash
# realny diff z repo:
git diff | npm run review

# symulowany diff (fixtures/sample.diff) — szybkie potwierdzenie komunikacji z modelem:
npm run review:sample
```

## Pliki

| Plik                   | Rola                                                            |
| ---------------------- | --------------------------------------------------------------- |
| `src/review-schema.ts` | wspólny prompt systemowy + schemat `zod` (jedno źródło prawdy)   |
| `src/reviewer.ts`      | reużywalny `reviewDiff()` — wejście pod przyszłe evale promptfoo |
| `src/index.ts`         | entry point: stdin → review → JSON na stdout                    |
| `fixtures/sample.diff` | symulowany diff z wstrzykniętymi problemami (do Kroku 3)        |

## Następny krok

W **M5L3** ten sam `reviewDiff()` wepniemy w CI/CD jako pierwszy przebieg review na PR-ze
(human-in-the-loop) i obłożymy evalami promptfoo.
