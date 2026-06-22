import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/cards/manual";
import { makeApiContext } from "../support/api-context";

// Roadmap S-04 / FR-011 — handler-level properties of POST /api/cards/manual, proven without a
// database (the real DB isolation lives in the integration suite). We mock the Supabase client and
// CAPTURE the insert payload to prove the route forces source:"manual" + user_id = the session
// user, overriding any client-supplied value (the spoofing guard — risks #1 owner, #4 nothing
// extra). Auth gate (#5), body cap + validation (#6), and generic error bodies (#2) round it out.
// Modeled on cards.test.ts.

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

const mockedCreate = vi.mocked(createClient);

const MANUAL_BODY_CAP = 16 * 1024;
const USER_ID = "user-1";
const SENTINEL = "ROW-LEAK-CANARY-manual-7c3";

// A fake Supabase client whose from("flashcards").insert(row) records its argument.
function fakeClient(insertResult: { error: unknown } = { error: null }) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const from = vi.fn().mockReturnValue({ insert });
  return { client: { from } as unknown as ReturnType<typeof createClient>, insert, from };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/cards/manual — auth gate (risk #5)", () => {
  it("returns 401 when there is no authenticated user", async () => {
    const res = await POST(makeApiContext({ user: null, body: { question: "q", answer: "a" } }));
    expect(res.status).toBe(401);
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/cards/manual — resource abuse (risk #6)", () => {
  it("returns 413 before parsing when content-length exceeds the cap", async () => {
    const res = await POST(makeApiContext({ contentLength: MANUAL_BODY_CAP + 1, jsonThrows: true }));
    expect(res.status).toBe(413);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("returns 400 on an unparseable JSON body", async () => {
    const res = await POST(makeApiContext({ jsonThrows: true }));
    expect(res.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["empty question", { question: "", answer: "a" }],
    ["whitespace question", { question: "   ", answer: "a" }],
    ["empty answer", { question: "q", answer: "" }],
    ["whitespace answer", { question: "q", answer: "   " }],
    ["missing answer", { question: "q" }],
    ["missing question", { answer: "a" }],
    ["non-object body", "just a string"],
  ])("returns 400 on invalid input: %s", async (_label, body) => {
    const res = await POST(makeApiContext({ body }));
    expect(res.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/cards/manual — owner/origin forcing (risks #1, #4)", () => {
  it("forces source:'manual' and user_id = session user, overriding client-supplied values", async () => {
    const { client, from, insert } = fakeClient();
    mockedCreate.mockReturnValue(client);

    const res = await POST(
      makeApiContext({
        user: { id: USER_ID },
        body: { question: "q1", answer: "a1", user_id: "ATTACKER-ID", source: "ai" },
      }),
    );

    expect(res.status).toBe(201);
    expect(from).toHaveBeenCalledWith("flashcards");
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.source).toBe("manual");
    expect(row.user_id).toBe(USER_ID);
    // the foreign user_id never survives, and no extra fields leak through
    expect(row.user_id).not.toBe("ATTACKER-ID");
    expect(Object.keys(row).sort()).toEqual(["answer", "question", "source", "user_id"]);
  });

  it("trims the persisted question and answer", async () => {
    const { client, insert } = fakeClient();
    mockedCreate.mockReturnValue(client);

    const res = await POST(makeApiContext({ body: { question: "  q1  ", answer: "  a1  " } }));

    expect(res.status).toBe(201);
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.question).toBe("q1");
    expect(row.answer).toBe("a1");
  });

  it("returns 201 with { saved: 1 } on success", async () => {
    const { client } = fakeClient();
    mockedCreate.mockReturnValue(client);
    const res = await POST(makeApiContext({ body: { question: "q1", answer: "a1" } }));
    expect(res.status).toBe(201);
    const json = (await res.json()) as { saved: number };
    expect(json.saved).toBe(1);
  });
});

describe("POST /api/cards/manual — persistence errors stay generic", () => {
  it("returns 500 when the client cannot be created", async () => {
    mockedCreate.mockReturnValue(null);
    const res = await POST(makeApiContext({ body: { question: "q", answer: "a" } }));
    expect(res.status).toBe(500);
  });

  it("returns 500 without echoing row contents on an insert error (risk #2)", async () => {
    const { client } = fakeClient({ error: { message: "rls denied" } });
    mockedCreate.mockReturnValue(client);
    const res = await POST(makeApiContext({ body: { question: `q ${SENTINEL}`, answer: `a ${SENTINEL}` } }));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain(SENTINEL);
  });
});
