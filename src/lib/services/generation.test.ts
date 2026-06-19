import { describe, expect, it } from "vitest";
import { MAX_CANDIDATES, MAX_SOURCE_CHARS } from "@/lib/services/generation";

// Phase 1 bootstrap probe: a green run here means the `astro:env/server` alias, the env stub,
// Vitest globals, and the transform pipeline all work end-to-end. The exported constants are
// their own oracle ONLY here, where the point is "the module loaded", not behaviour.
// Phase 2 replaces this file with the real risk-#3 suite.
describe("generation runner smoke test", () => {
  it("loads the service module and exposes the caps", () => {
    expect(MAX_CANDIDATES).toBe(30);
    expect(MAX_SOURCE_CHARS).toBe(10_000);
  });
});
