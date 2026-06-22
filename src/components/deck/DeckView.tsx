import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Pencil, RefreshCw, Save, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { DeckCard, DeckPage } from "@/types";

// Roadmap S-03 deck management. Owns the full browse/edit/delete loop against /api/cards and
// /api/cards/[id]. Browse is a "Load more" pager keyed by a ROW offset (DeckPage.nextOffset): on a
// delete we decrement the cursor by one so the next page stays aligned with the live ordering and
// skips nothing (plan F2). Editing PATCHes only { question, answer } — the route preserves the FSRS
// schedule (FR-013). Deleting is confirm-gated (FR-014): the first click arms, the second fires.

type Status = "loading" | "ready" | "error";

interface ActionError {
  id: string;
  message: string;
}

export default function DeckView() {
  const [status, setStatus] = useState<Status>("loading");
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ question: string; answer: string }>({ question: "", answer: "" });
  const [savingId, setSavingId] = useState<string | null>(null);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // At most one row is being acted on at a time, but bind the error to a card id so it renders
  // under the right card.
  const [actionError, setActionError] = useState<ActionError | null>(null);

  const loadInitial = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/cards");
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = (await res.json()) as DeckPage;
      setCards(data.cards);
      setNextOffset(data.nextOffset);
      setHasMore(data.hasMore);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; loadInitial only setStates after the await
    void loadInitial();
  }, [loadInitial]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const res = await fetch(`/api/cards?offset=${nextOffset}`);
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as DeckPage;
      setCards((prev) => [...prev, ...data.cards]);
      setNextOffset(data.nextOffset);
      setHasMore(data.hasMore);
    } catch {
      setLoadMoreError("Could not load more cards. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  function startEdit(card: DeckCard) {
    setEditingId(card.id);
    setDraft({ question: card.question, answer: card.answer });
    setActionError(null);
    setConfirmingDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setActionError(null);
  }

  async function saveEdit(id: string) {
    const question = draft.question.trim();
    const answer = draft.answer.trim();
    if (!question || !answer || savingId) return;
    setSavingId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      if (!res.ok) throw new Error("save failed");
      const updated = (await res.json()) as DeckCard;
      setCards((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
    } catch {
      // Keep edit mode open so the user's edits aren't lost (no silent drop).
      setActionError({ id, message: "Could not save the card. Please try again." });
    } finally {
      setSavingId(null);
    }
  }

  async function confirmDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setCards((prev) => prev.filter((c) => c.id !== id));
      // The deleted row no longer occupies a slot below the cursor — keep "Load more" aligned (F2).
      setNextOffset((prev) => Math.max(0, prev - 1));
      setConfirmingDeleteId(null);
    } catch {
      setActionError({ id, message: "Could not delete the card. Please try again." });
    } finally {
      setDeletingId(null);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex justify-center py-16 text-blue-100/70">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-center backdrop-blur-xl">
        <AlertCircle className="mx-auto mb-3 size-8 text-red-300" />
        <p className="text-blue-100/80">Could not load your deck.</p>
        <Button className="mt-6" variant="secondary" onClick={() => void loadInitial()}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-center backdrop-blur-xl">
        <p className="text-lg font-semibold">No cards yet</p>
        <p className="mt-1 text-sm text-blue-100/60">Generate your first cards to start building your deck.</p>
        <a
          href="/generate"
          className="mt-6 inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20"
        >
          <Sparkles className="size-4" /> Generate flashcards
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => {
        const isEditing = editingId === card.id;
        const isConfirmingDelete = confirmingDeleteId === card.id;
        const error = actionError?.id === card.id ? actionError.message : null;

        return (
          <Card key={card.id} className="border-white/10 bg-white/10">
            <CardContent className="space-y-3 p-4">
              {isEditing ? (
                <>
                  <div className="space-y-1">
                    <span className="text-xs font-medium tracking-wide text-blue-100/50 uppercase">Question</span>
                    <Textarea
                      value={draft.question}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, question: e.target.value }));
                      }}
                      className="min-h-0 resize-none bg-white/5 text-white"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium tracking-wide text-blue-100/50 uppercase">Answer</span>
                    <Textarea
                      value={draft.answer}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, answer: e.target.value }));
                      }}
                      className="min-h-0 resize-none bg-white/5 text-white"
                      rows={2}
                    />
                  </div>
                  {error && <p className="text-sm text-red-300">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={savingId === card.id}>
                      <X className="size-4" /> Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void saveEdit(card.id)}
                      disabled={!draft.question.trim() || !draft.answer.trim() || savingId === card.id}
                    >
                      {savingId === card.id ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Save
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <span className="text-xs font-medium tracking-wide text-blue-100/50 uppercase">Question</span>
                    <p className="text-white">{card.question}</p>
                  </div>
                  <div className="space-y-1 border-t border-white/10 pt-3">
                    <span className="text-xs font-medium tracking-wide text-blue-100/50 uppercase">Answer</span>
                    <p className="text-white">{card.answer}</p>
                  </div>
                  {error && <p className="text-sm text-red-300">{error}</p>}
                  <div className="flex justify-end gap-2">
                    {isConfirmingDelete ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setConfirmingDeleteId(null);
                          }}
                          disabled={deletingId === card.id}
                        >
                          <X className="size-4" /> Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-200 hover:text-red-100"
                          onClick={() => void confirmDelete(card.id)}
                          disabled={deletingId === card.id}
                        >
                          {deletingId === card.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                          Confirm delete
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            startEdit(card);
                          }}
                        >
                          <Pencil className="size-4" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-200 hover:text-red-100"
                          onClick={() => {
                            setActionError(null);
                            setConfirmingDeleteId(card.id);
                          }}
                        >
                          <Trash2 className="size-4" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {hasMore && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button variant="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Load more
          </Button>
          {loadMoreError && <p className="text-sm text-red-300">{loadMoreError}</p>}
        </div>
      )}
    </div>
  );
}
