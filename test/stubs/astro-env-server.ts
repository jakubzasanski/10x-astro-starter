// Test stub for the `astro:env/server` virtual module.
//
// Vitest aliases `astro:env/server` to this file (see vitest.config.ts). The real virtual
// module is only synthesised by Astro's Vite plugin from the `env.schema` in astro.config.mjs,
// so under a bare Vitest transform the id is unresolvable and `generation.ts` would fail to
// transform before any `vi.mock` could intervene. This stub provides concrete runtime values
// for the three names the service imports, with a configured key by default.
//
// To exercise the config-error path (missing LLM_API_KEY), a test layers
// `vi.mock("astro:env/server", ...)` + `vi.resetModules()` on top of this alias.

export const LLM_API_KEY = "test-key";
export const LLM_BASE_URL = "https://api.openai.com/v1";
export const LLM_MODEL = "gpt-test";
