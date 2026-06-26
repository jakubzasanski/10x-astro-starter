import { Codex, type Usage } from "@openai/codex-sdk";
import { REVIEW_JSON_SCHEMA, REVIEW_SCHEMA, SYSTEM_PROMPT, type Review } from "./review-schema";

export interface ReviewResult {
  review: Review;
  finalResponse: string;
  usage: Usage | null;
}

/**
 * Recenzuje pojedynczy git diff i zwraca ustrukturyzowaną ocenę.
 * Eksportowane jako reużywalna funkcja — w M5L3 to samo wejście pójdzie pod evale promptfoo.
 */
export async function reviewDiff(diff: string): Promise<ReviewResult> {
  // Dwie ścieżki auth: jawny klucz API (env/.env) albo sesja `codex login`.
  // Jeśli nie ma klucza, oddajemy auth binarce codex — błąd (jeśli będzie) wyjdzie z CLI.
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.CODEX_API_KEY;
  if (!apiKey) {
    console.error(
      "ℹ️  Brak OPENAI_API_KEY/CODEX_API_KEY — liczę na sesję `codex login`. " +
        "Jeśli zobaczysz błąd auth, ustaw klucz w packages/code-reviewer/.env lub wykonaj `codex login`.",
    );
  }

  const codex = new Codex(apiKey ? { apiKey } : {});

  // Recenzent ma tylko zrecenzować diff z promptu — nie eksplorować, nie pisać plików,
  // nie wychodzić do sieci. Zamykamy go w sandboxie read-only bez sieci i bez zatwierdzeń.
  const thread = codex.startThread({
    skipGitRepoCheck: true,
    sandboxMode: "read-only",
    networkAccessEnabled: false,
    approvalPolicy: "never",
    modelReasoningEffort: "low",
  });

  const prompt =
    `${SYSTEM_PROMPT}\n\n` +
    "Zrecenzuj poniższy diff i zwróć WYŁĄCZNIE obiekt JSON zgodny ze schematem " +
    "(bez komentarza, bez bloków ```):\n\n" +
    diff;

  const result = await thread.run(prompt, { outputSchema: REVIEW_JSON_SCHEMA });

  const review = parseReview(result.finalResponse);
  return { review, finalResponse: result.finalResponse, usage: result.usage };
}

/** Wyłuskuje i waliduje JSON z odpowiedzi modelu (tolerując bloki ``` lub otaczający tekst). */
function parseReview(text: string): Review {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    const match = /\{[\s\S]*\}/.exec(cleaned);
    if (!match) throw new Error(`Odpowiedź modelu nie zawiera JSON-a:\n${text}`);
    json = JSON.parse(match[0]);
  }

  const parsed = REVIEW_SCHEMA.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Niepoprawny structured output: ${parsed.error.message}\n\nSurowa odpowiedź:\n${text}`);
  }
  return parsed.data;
}
