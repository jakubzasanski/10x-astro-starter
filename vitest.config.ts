/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// NOTE: we deliberately do NOT use Astro's `getViteConfig` here. It loads the
// `@astrojs/cloudflare` adapter's Vite plugin, which rejects Vitest's environment options
// ("resolve.external ... incompatible with the Cloudflare Vite plugin") and aborts at startup.
// The service under test is pure logic over global `fetch` + Zod, so a plain Vite/Vitest config
// with two manual aliases is faithful and avoids the workerd plugin entirely.
//
// The load-bearing line is the `astro:env/server` alias: without it Vite cannot resolve that
// virtual id under Vitest and `generation.ts` fails to transform before any `vi.mock` could
// apply. The alias key must be the exact id. The `@` alias mirrors the tsconfig `@/*` path.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    unstubGlobals: true,
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "astro:env/server": fileURLToPath(new URL("./test/stubs/astro-env-server.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
