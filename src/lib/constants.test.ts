import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";

// Drift guard for the one password-length mirror the type system cannot see:
// `supabase/config.toml`'s `minimum_password_length` is the real GoTrue enforcement floor but is not
// importable by TS. If it ever diverges from MIN_PASSWORD_LENGTH the security floor silently weakens,
// so pin them together here. Plain fs + regex — no TOML parser dependency. The path is anchored to
// this file (src/lib/ -> repo root is two levels up), not cwd, so the read survives any invocation dir.
describe("MIN_PASSWORD_LENGTH", () => {
  it("is locked at 8", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it("matches supabase/config.toml minimum_password_length", () => {
    const configPath = fileURLToPath(new URL("../../supabase/config.toml", import.meta.url));
    const toml = readFileSync(configPath, "utf8");

    const match = /^minimum_password_length\s*=\s*(\d+)/m.exec(toml);
    if (!match) {
      throw new Error(
        "supabase/config.toml is missing a `minimum_password_length = <n>` line; cannot verify the password-length floor against MIN_PASSWORD_LENGTH",
      );
    }

    const configValue = Number(match[1]);
    expect(
      configValue,
      `supabase/config.toml minimum_password_length (${configValue}) drifted from MIN_PASSWORD_LENGTH (${MIN_PASSWORD_LENGTH}); keep both in sync`,
    ).toBe(MIN_PASSWORD_LENGTH);
  });
});
