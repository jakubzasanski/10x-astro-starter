import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/auth/forgot-password";
import { makeApiContext } from "../support/api-context";

// FR-006 (request half) handler properties, proven without a DB or real email. The route's contract:
//   - zod-validate the email; invalid → 302 ?error= and NO recovery email sent
//   - valid → resetPasswordForEmail(email, { redirectTo .../auth/reset-password }), then 302 ?sent=1
//   - NON-ENUMERATION: the same ?sent=1 whether or not the address is registered (Supabase does not
//     distinguish, and the route must never branch UX on existence)
//   - transport/config error → 302 ?error=; unconfigured client → 302 ?error=Supabase is not configured

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

const mockedCreate = vi.mocked(createClient);

function fakeClient(result: { error: unknown } = { error: null }) {
  const resetPasswordForEmail = vi.fn().mockResolvedValue(result);
  return {
    client: { auth: { resetPasswordForEmail } } as unknown as ReturnType<typeof createClient>,
    resetPasswordForEmail,
  };
}

const location = (res: Response) => res.headers.get("Location") ?? "";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/forgot-password — validation", () => {
  it.each([
    ["empty email", ""],
    ["malformed email", "not-an-email"],
    ["missing @", "userexample.com"],
  ])("redirects to ?error= on %s and never sends a recovery email", async (_label, email) => {
    const { client, resetPasswordForEmail } = fakeClient();
    mockedCreate.mockReturnValue(client);

    const res = await POST(makeApiContext({ formData: { email } }));

    expect(res.status).toBe(302);
    expect(location(res)).toContain("/auth/forgot-password?error=");
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/forgot-password — happy path", () => {
  it("calls resetPasswordForEmail with the email and a /auth/reset-password redirectTo, then 302 ?sent=1", async () => {
    const { client, resetPasswordForEmail } = fakeClient();
    mockedCreate.mockReturnValue(client);

    const res = await POST(makeApiContext({ formData: { email: "user@example.com" } }));

    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    const [email, opts] = resetPasswordForEmail.mock.calls[0] as [string, { redirectTo: string }];
    expect(email).toBe("user@example.com");
    expect(opts.redirectTo).toMatch(/\/auth\/reset-password$/);
    expect(res.status).toBe(302);
    expect(location(res)).toBe("/auth/forgot-password?sent=1");
  });

  it("is non-enumerating: an unknown email gets the same ?sent=1 confirmation", async () => {
    // Supabase returns success even when the address is not registered; the route must not branch.
    const { client } = fakeClient({ error: null });
    mockedCreate.mockReturnValue(client);

    const res = await POST(makeApiContext({ formData: { email: "ghost@example.com" } }));

    expect(res.status).toBe(302);
    expect(location(res)).toBe("/auth/forgot-password?sent=1");
  });
});

describe("POST /api/auth/forgot-password — error paths", () => {
  it("redirects to ?error= on a transport/config error from Supabase", async () => {
    const { client } = fakeClient({ error: { message: "smtp down" } });
    mockedCreate.mockReturnValue(client);

    const res = await POST(makeApiContext({ formData: { email: "user@example.com" } }));

    expect(res.status).toBe(302);
    expect(location(res)).toContain("/auth/forgot-password?error=");
  });

  it("redirects to a 'Supabase is not configured' error when the client cannot be created", async () => {
    mockedCreate.mockReturnValue(null);

    const res = await POST(makeApiContext({ formData: { email: "user@example.com" } }));

    expect(res.status).toBe(302);
    expect(location(res)).toContain("Supabase%20is%20not%20configured");
  });
});
