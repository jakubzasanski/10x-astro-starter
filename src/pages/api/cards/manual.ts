import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import type { FlashcardInsert } from "@/types";

export const prerender = false;

// Authenticated manual-create: persist exactly one user-authored flashcard to the deck as
// source:'manual' (roadmap S-04, FR-011). The trust boundary for the manual path — it mirrors
// POST /api/cards' owner/origin forcing: the client supplies only { question, answer }; the server
// forces source:'manual' + user_id = the session user, never trusting a client-supplied value.
// The insert goes through the user's authenticated client, so RLS enforces per-user ownership.
// The FSRS schedule columns default to due-now/New (S-02), so the card is immediately reviewable.

const bodySchema = z.object({
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
});

// Reject oversized bodies before buffering/parsing. A single Q/A pair is tiny — 16KB is generous
// headroom while far tighter than /api/cards' 128KB cap (sized for 30 cards).
const MAX_BODY_BYTES = 16 * 1024;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const contentLength = Number(context.request.headers.get("content-length"));
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "Request body too large" }, 413);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Expected a non-empty question and answer" }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "Persistence is not configured" }, 500);
  }

  // Force source + user_id server-side; client-supplied user_id/source were stripped at parse.
  const row: FlashcardInsert = {
    question: parsed.data.question,
    answer: parsed.data.answer,
    source: "manual",
    user_id: user.id,
  };

  const { error } = await supabase.from("flashcards").insert(row);
  if (error) {
    // RLS/DB failure: generic message, no row contents echoed.
    return json({ error: "Could not add the card. Please try again." }, 500);
  }

  return json({ saved: 1 }, 201);
};
