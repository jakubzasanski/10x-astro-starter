import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/auth/reset-password";
import { makeApiContext } from "../support/api-context";

// FR-006 (completion half) handler properties. The route runs with the recovery session already in
// cookies (minted by the reset-password page's verifyOtp). Contract:
//   - zod: password min 6 AND password === confirmPassword; invalid → 302 ?error= and updateUser NOT called
//   - valid → updateUser({ password }), then signOut, then 302 /auth/signin?reset=1
//   - updateUser error (e.g. recovery session expired) → 302 ?error=
//   - unconfigured client → 302 ?error=Supabase is not configured

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

const mockedCreate = vi.mocked(createClient);

function fakeClient(updateResult: { error: unknown } = { error: null }) {
  const updateUser = vi.fn().mockResolvedValue(updateResult);
  const signOut = vi.fn().mockResolvedValue({ error: null });
  return {
    client: { auth: { updateUser, signOut } } as unknown as ReturnType<typeof createClient>,
    updateUser,
    signOut,
  };
}

const location = (res: Response) => res.headers.get("Location") ?? "";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/reset-password — validation guards updateUser", () => {
  it("redirects to ?error= on mismatched passwords and never calls updateUser", async () => {
    const { client, updateUser } = fakeClient();
    mockedCreate.mockReturnValue(client);

    const res = await POST(makeApiContext({ formData: { password: "secret123", confirmPassword: "different1" } }));

    expect(res.status).toBe(302);
    expect(location(res)).toContain("/auth/reset-password?error=");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("redirects to ?error= on a too-short password and never calls updateUser", async () => {
    const { client, updateUser } = fakeClient();
    mockedCreate.mockReturnValue(client);

    const res = await POST(makeApiContext({ formData: { password: "abc", confirmPassword: "abc" } }));

    expect(res.status).toBe(302);
    expect(location(res)).toContain("/auth/reset-password?error=");
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/reset-password — happy path", () => {
  it("calls updateUser({ password }), then signOut, then 302 /auth/signin?reset=1", async () => {
    const { client, updateUser, signOut } = fakeClient();
    mockedCreate.mockReturnValue(client);

    const res = await POST(makeApiContext({ formData: { password: "newpass1", confirmPassword: "newpass1" } }));

    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith({ password: "newpass1" });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(302);
    expect(location(res)).toBe("/auth/signin?reset=1");
  });
});

describe("POST /api/auth/reset-password — error paths", () => {
  it("redirects to ?error= when updateUser fails (e.g. recovery session expired) and does not sign out", async () => {
    const { client, signOut } = fakeClient({ error: { message: "session expired" } });
    mockedCreate.mockReturnValue(client);

    const res = await POST(makeApiContext({ formData: { password: "newpass1", confirmPassword: "newpass1" } }));

    expect(res.status).toBe(302);
    expect(location(res)).toContain("/auth/reset-password?error=");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("redirects to a 'Supabase is not configured' error when the client cannot be created", async () => {
    mockedCreate.mockReturnValue(null);

    const res = await POST(makeApiContext({ formData: { password: "newpass1", confirmPassword: "newpass1" } }));

    expect(res.status).toBe(302);
    expect(location(res)).toContain("Supabase%20is%20not%20configured");
  });
});
