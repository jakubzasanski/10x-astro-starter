# Repository Refinement Implementation Plan

## Overview

Modernize the 10x-astro-starter repository across six areas: remove legacy AI IDE config files, update all dependencies (including lucide-react 0.x → 1.x), modernize ESLint with type-checked rules and new Astro-specific linting, swap from Node.js to Cloudflare Workers adapter, add a CI workflow, and rewrite CLAUDE.md + README to reflect the new state.

## Current State Analysis

The repo is a clean Astro 6 SSR + React 19 + Tailwind 4 + Supabase auth starter. It works but carries baggage from an older multi-IDE AI rules approach (Cursor, Copilot, Windsurf configs + sync scripts), has 4 unused ESLint dependencies, missing Prettier as an explicit dep, no CI/CD, and targets Node.js instead of Cloudflare for deployment.

### Key Discoveries:

- `eslint.config.js:26-35` — jsxA11yConfig has redundant spreading that `extends` already handles
- `eslint.config.js:14-16` — verbose gitignore path can use `import.meta.dirname` (Node 22+)
- `package.json:37-57` — 4 unused devDeps: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-import`, `eslint-import-resolver-typescript`
- `src/components/auth/*.tsx` — 7 lucide-react icons used (Mail, Lock, LogIn, UserPlus, AlertCircle, Eye, EyeOff); all confirmed safe in v1.x. `AlertCircle` renamed to `CircleAlert` (alias preserved)
- `astro.config.mjs:17-19` — Node adapter to be replaced with Cloudflare
- `.cursor/rules/` — 8 .mdc files, `.windsurfrules`, `.github/copilot-instructions.md`, `AGENTS.md`, `scripts/sync-ai-rules.sh`, `scripts/init-openspec.sh` — all legacy

## Desired End State

A clean, modern starter with:

- Zero legacy AI config files — only `CLAUDE.md` as the single source of truth
- All dependencies at latest stable versions
- ESLint with type-checked rules (`strictTypeChecked`), Astro-specific rules, Astro a11y, and underscore-prefix ignore patterns
- Prettier with Tailwind class sorting plugin
- Cloudflare Workers as the deployment target via `@astrojs/cloudflare`
- GitHub Actions CI running lint + build on every PR
- CLAUDE.md and README accurately reflecting the current setup

**Verification**: `npm run lint` passes, `npm run build` succeeds, `npm run dev` starts on workerd runtime, CI workflow validates on push.

## What We're NOT Doing

- No OxLint migration — Astro support gaps make it not worth the hybrid complexity
- No ESLint 10 upgrade — `eslint-plugin-react` and `eslint-plugin-jsx-a11y` don't support it yet
- No auto-deploy in CI — workflow is lint + build only; deploy is manual via wrangler
- No new features or application code changes (beyond icon rename)
- No Supabase migration changes
- No test infrastructure setup

## Implementation Approach

Six sequential phases, each independently verifiable. Legacy cleanup first (reduces noise), then dependency updates (foundation), then config modernization (depends on new deps), then adapter swap (depends on clean deps), then CI (depends on working build), and finally docs (depends on all prior phases being done).

## Critical Implementation Details

- **Type-checked ESLint + Astro**: eslint-plugin-astro's flat config sets `project: null` on virtual `*.astro/*.ts` files (script tags). This is intentional — type-checked rules work on `.ts`/`.tsx` but not inside `<script>` tags in `.astro` files. No conflict; no workaround needed.
- **`restrict-template-expressions`**: This rule is very strict by default (rejects numbers in template literals). Relax with `allowNumber: true` to avoid noise.
- **`no-misused-promises`**: React event handlers returning promises flag this rule. May need `checksVoidReturn: { attributes: false }` to suppress false positives on `onClick={async () => ...}`.

---

## Phase 1: Legacy Cleanup

### Overview

Delete all legacy AI IDE config files, sync scripts, and related npm scripts. Remove the "AI Development Support" section from README.

### Changes Required:

#### 1. Delete legacy AI config files and directories

**Files to delete**:

- `.cursor/` (entire directory — 8 .mdc files)
- `.github/copilot-instructions.md` (leaves `.github/` empty → delete the directory)
- `.windsurfrules`
- `AGENTS.md`
- `scripts/sync-ai-rules.sh`
- `scripts/init-openspec.sh` (leaves `scripts/` empty → delete the directory)

**Intent**: Remove all remnants of the multi-IDE AI rules approach. CLAUDE.md is the single source of truth.

#### 2. Remove legacy npm scripts from package.json

**File**: `package.json`

**Intent**: Remove the `"ai:rules"` and `"openspec:init"` scripts that reference deleted files.

**Contract**: Delete the two script entries from the `"scripts"` object.

### Success Criteria:

#### Automated Verification:

- No legacy files remain: `ls .cursor .windsurfrules AGENTS.md .github/copilot-instructions.md scripts/ 2>&1 | grep -c "No such file"` returns 6
- `npm run build` still succeeds (no references to deleted files)
- `npm run lint` still passes

#### Manual Verification:

- Confirm `CLAUDE.md` is the only AI rules file at the repo root

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Dependency Updates

### Overview

Remove unused ESLint packages, add missing Prettier dependencies, and bump all packages to latest stable — including the lucide-react 0.x → 1.x major version upgrade.

### Changes Required:

#### 1. Remove unused devDependencies

**File**: `package.json`

**Intent**: Remove 4 packages that are either redundant (unified `typescript-eslint` package already provides them) or not imported in `eslint.config.js`.

**Contract**: Remove `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-import`, `eslint-import-resolver-typescript` from `devDependencies`.

#### 2. Add missing dependencies

**File**: `package.json`

**Intent**: Add `prettier` as an explicit devDependency (currently only a fragile peer dep) and `prettier-plugin-tailwindcss` for automatic Tailwind class sorting.

**Contract**: Add `prettier` (^3.8.3) and `prettier-plugin-tailwindcss` (^0.8.0) to `devDependencies`.

#### 3. Update lucide-react to 1.x and rename AlertCircle

**File**: `package.json`

**Intent**: Bump `lucide-react` from `^0.487.0` to `^1.14.0`. All 7 icons used in the project are confirmed safe in v1.x.

**Contract**: Update the version range in `dependencies`. Then rename `AlertCircle` → `CircleAlert` in `src/components/auth/FormField.tsx:2` and `src/components/auth/ServerError.tsx:1` (the old name is an alias but we should use the canonical name).

#### 4. Bump remaining dependencies

**Intent**: Update all other packages to their latest within semver range. Run `npm update` followed by manual bumps for packages where the range ceiling is below latest.

**Contract**: Key bumps: `astro` ^6.1.9 → ^6.3.1, `@supabase/ssr` ^0.9.0 → ^0.10.3, `react`/`react-dom` ^19.2.4 → ^19.2.6, `tailwindcss`/`@tailwindcss/vite` ^4.2.1 → ^4.2.4, `eslint-plugin-react-hooks` 5.2.0 → ^7.1.1, `eslint-plugin-astro` ^1.6.0 → ^1.7.0, `typescript-eslint` ^8.57.0 → ^8.59.2.

#### 5. Clean install

**Intent**: Delete `node_modules/` and `package-lock.json`, run `npm install` to regenerate a clean lockfile with all changes.

### Success Criteria:

#### Automated Verification:

- `npm install` completes without errors
- `npm run build` succeeds
- `npm run lint` passes (with current eslint config)
- No `AlertCircle` imports remain: `grep -r "AlertCircle" src/` returns empty

#### Manual Verification:

- Auth forms render correctly with icons visible (Mail, Lock, LogIn, UserPlus, CircleAlert, Eye, EyeOff)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: ESLint + Prettier Modernization

### Overview

Rewrite `eslint.config.js` with type-checked rules, simplified config patterns, and new Astro-specific rules. Update `.prettierrc.json` with modern defaults and Tailwind plugin.

### Changes Required:

#### 1. Rewrite eslint.config.js

**File**: `eslint.config.js`

**Intent**: Modernize the config: enable `strictTypeChecked` + `stylisticTypeChecked`, simplify the gitignore path to use `import.meta.dirname`, remove redundant spreading in jsxA11yConfig, add Astro-specific rules and Astro a11y config, add underscore-prefix pattern for `no-unused-vars`, and tune noisy type-checked rules.

**Contract**: The full rewritten config:

```js
import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import eslintPluginAstro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";
import pluginReact from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import path from "node:path";
import tseslint from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

const baseConfig = tseslint.config({
  extends: [eslint.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    "no-console": "warn",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
  },
});

const jsxA11yConfig = tseslint.config({
  files: ["**/*.{js,jsx,ts,tsx}"],
  extends: [jsxA11y.flatConfigs.recommended],
});

const reactConfig = tseslint.config({
  files: ["**/*.{js,jsx,ts,tsx}"],
  extends: [pluginReact.configs.flat.recommended],
  languageOptions: {
    ...pluginReact.configs.flat.recommended.languageOptions,
    globals: {
      window: true,
      document: true,
    },
  },
  plugins: {
    "react-hooks": eslintPluginReactHooks,
    "react-compiler": reactCompiler,
  },
  settings: { react: { version: "detect" } },
  rules: {
    ...eslintPluginReactHooks.configs.recommended.rules,
    "react/react-in-jsx-scope": "off",
    "react-compiler/react-compiler": "error",
  },
});

const astroConfig = tseslint.config({
  files: ["**/*.astro"],
  rules: {
    "astro/no-set-html-directive": "error",
    "astro/no-unused-css-selector": "warn",
    "astro/prefer-class-list-directive": "warn",
  },
});

export default tseslint.config(
  includeIgnoreFile(gitignorePath),
  baseConfig,
  jsxA11yConfig,
  reactConfig,
  eslintPluginAstro.configs["flat/recommended"],
  ...eslintPluginAstro.configs["flat/jsx-a11y-recommended"],
  astroConfig,
  eslintPluginPrettier,
);
```

#### 2. Update .prettierrc.json

**File**: `.prettierrc.json`

**Intent**: Update `trailingComma` to modern default and add Tailwind class sorting plugin.

**Contract**: Change `"trailingComma": "es5"` → `"trailingComma": "all"`. Add `"prettier-plugin-tailwindcss"` to the `plugins` array (must be last).

#### 3. Fix type-checked lint errors

**Intent**: Run `npm run lint` and fix any new errors surfaced by the type-checked rules. Common issues: unhandled promises in Astro frontmatter, async event handlers, unnecessary type assertions.

**Contract**: Fix errors in source files. If a rule is too noisy for the codebase, add a targeted rule override in `eslint.config.js` rather than disabling the rule globally.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with zero errors
- `npm run format` runs without errors
- `npm run build` succeeds
- Type checking passes: `npx astro check`

#### Manual Verification:

- Review lint output to confirm type-checked rules are active (look for `@typescript-eslint/` rule names in any warnings)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Cloudflare Adapter Swap

### Overview

Replace the Node.js adapter with Cloudflare Workers adapter. Create wrangler config and supporting files. Update astro.config.mjs.

### Changes Required:

#### 1. Swap adapter packages

**Intent**: Remove `@astrojs/node` and install `@astrojs/cloudflare` + `wrangler`.

**Contract**: `npm remove @astrojs/node && npm install @astrojs/cloudflare wrangler`

#### 2. Update astro.config.mjs

**File**: `astro.config.mjs`

**Intent**: Switch adapter import and config. Remove `server.port` (Cloudflare controls the port).

**Contract**: Replace `import node from "@astrojs/node"` with `import cloudflare from "@astrojs/cloudflare"`. Replace `adapter: node({ mode: "standalone" })` with `adapter: cloudflare()`. Remove the `server: { port: 3000 }` line.

#### 3. Create wrangler.jsonc

**File**: `wrangler.jsonc` (new)

**Intent**: Cloudflare Workers config with `nodejs_compat` flag for Supabase SSR compatibility.

**Contract**:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "10x-astro-starter",
  "main": "./dist/_worker.js/index.js",
  "compatibility_date": "2026-05-08",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist",
    "not_found_handling": "404-page",
  },
  "observability": {
    "enabled": true,
  },
}
```

#### 4. Create supporting files

**File**: `public/.assetsignore` (new)

**Intent**: Exclude worker entry from static assets.

**Contract**: Contents: `_worker.js\n_routes.json`

**File**: `.dev.vars` (new, gitignored)

**Intent**: Local development secrets for Cloudflare dev server.

**Contract**: Contents: `SUPABASE_URL=###\nSUPABASE_KEY=###`

#### 5. Update .gitignore

**File**: `.gitignore`

**Intent**: Add `.dev.vars` and `.wrangler/` to gitignore.

**Contract**: Add entries for `.dev.vars` and `.wrangler/`.

### Success Criteria:

#### Automated Verification:

- `npm run build` succeeds with Cloudflare adapter (produces `dist/_worker.js/`)
- `npm run lint` passes
- `wrangler.jsonc` is valid: `npx wrangler deploy --dry-run` doesn't error on config parsing

#### Manual Verification:

- `npm run dev` starts successfully on workerd runtime
- Auth flow works: sign up, sign in, dashboard access, sign out
- Supabase SSR client connects without errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: CI/CD Workflow

### Overview

Create a GitHub Actions workflow that runs lint and build on every push and PR to master.

### Changes Required:

#### 1. Create GitHub Actions workflow

**File**: `.github/workflows/ci.yml` (new)

**Intent**: CI pipeline that validates code quality and build on every PR and push to master. No auto-deploy — deploy is manual via `npx wrangler deploy`.

**Contract**:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
```

### Success Criteria:

#### Automated Verification:

- Workflow file is valid YAML: `npx yaml-lint .github/workflows/ci.yml` or `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
- `.github/workflows/` directory exists with `ci.yml`

#### Manual Verification:

- Push a branch and verify the CI workflow triggers on GitHub

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Docs Refresh

### Overview

Rewrite CLAUDE.md and README.md to accurately reflect the modernized repo state: updated commands, Cloudflare adapter, CI workflow, removed AI tools section.

### Changes Required:

#### 1. Rewrite CLAUDE.md

**File**: `CLAUDE.md`

**Intent**: Update to reflect: Cloudflare Workers adapter (not Node), updated lint/format commands, Prettier with Tailwind plugin, CI workflow, ESLint with type-checked rules. Remove any references to ESLint flat config details (just say "ESLint" in commands). Add CI section.

**Contract**: Update the Commands section (reflect actual scripts), Architecture section (change adapter reference to `@astrojs/cloudflare`, mention Cloudflare Workers), Environment section (add `.dev.vars` for local Cloudflare dev, mention `wrangler`). Add a CI section mentioning GitHub Actions.

#### 2. Rewrite README.md

**File**: `README.md`

**Intent**: Update tech stack versions, remove the "AI Development Support" section (lines 148-173) and its Cursor/Copilot/Windsurf references, remove the "Contributing" section reference to "AI configuration files", add a Cloudflare deployment section, update "Available Scripts".

**Contract**: The README should cover: tech stack (with current versions from package.json), getting started (updated for Cloudflare dev), available scripts, project structure, Supabase configuration (keep existing section), deployment to Cloudflare Workers (new section: build + wrangler deploy), and CI.

### Success Criteria:

#### Automated Verification:

- No references to Cursor, Copilot, or Windsurf in CLAUDE.md or README.md: `grep -i "cursor\|copilot\|windsurf" CLAUDE.md README.md` returns empty
- No references to `@astrojs/node` in CLAUDE.md or README.md
- `npm run format` passes (Prettier formats markdown)
- Build still succeeds: `npm run build`

#### Manual Verification:

- README reads coherently and accurately describes the current project setup
- CLAUDE.md provides correct guidance for AI agents working in this repo

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Per-Phase Testing:

Each phase has its own automated + manual verification. The key automated checks across all phases:

- `npm run lint` — ESLint passes
- `npm run build` — Astro production build succeeds
- `npm run format` — Prettier runs without errors
- `npx astro check` — TypeScript type checking passes

### End-to-End Verification (after all phases):

1. Fresh clone → `npm install` → `npm run dev` starts on workerd
2. Auth flow works end-to-end (sign up, sign in, dashboard, sign out)
3. `npm run lint` passes with type-checked rules active
4. `npm run build` produces `dist/_worker.js/`
5. No legacy files remain in the repo

## Performance Considerations

- Type-checked ESLint rules are slower than non-type-checked (runs the TS compiler). For this small codebase, the slowdown is negligible. If it becomes an issue, `projectService` is already the fastest option (faster than the deprecated `project` array).
- Cloudflare Workers have a 128MB memory limit and 30s CPU time limit per request. The Astro SSR + Supabase auth flow is well within these bounds.

## References

- Related research: `context/changes/refinement/research.md`
- Current ESLint config: `eslint.config.js:1-66`
- Current Astro config: `astro.config.mjs:1-27`
- Supabase client: `src/lib/supabase.ts`
- Auth components with lucide-react: `src/components/auth/*.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Legacy Cleanup

#### Automated

- [x] 1.1 No legacy files remain (6 paths return "No such file") — fcf942d
- [x] 1.2 Build succeeds: `npm run build` — fcf942d
- [x] 1.3 Lint passes: `npm run lint` — fcf942d

#### Manual

- [x] 1.4 CLAUDE.md is the only AI rules file at repo root — fcf942d

### Phase 2: Dependency Updates

#### Automated

- [x] 2.1 `npm install` completes without errors — 7da500b
- [x] 2.2 Build succeeds: `npm run build` — 7da500b
- [x] 2.3 Lint passes: `npm run lint` — 7da500b
- [x] 2.4 No `AlertCircle` imports remain — 7da500b

#### Manual

- [ ] 2.5 Auth forms render with icons visible

### Phase 3: ESLint + Prettier Modernization

#### Automated

- [x] 3.1 Lint passes with zero errors: `npm run lint` — e9ae9d8
- [x] 3.2 Format runs without errors: `npm run format` — e9ae9d8
- [x] 3.3 Build succeeds: `npm run build` — e9ae9d8
- [x] 3.4 Type checking passes: `npx astro check` — e9ae9d8

#### Manual

- [x] 3.5 Type-checked rules are active (verify rule names in lint output) — e9ae9d8

### Phase 4: Cloudflare Adapter Swap

#### Automated

- [x] 4.1 Build succeeds with Cloudflare adapter
- [x] 4.2 Lint passes: `npm run lint`
- [x] 4.3 Wrangler config is valid: `npx wrangler deploy --dry-run`

#### Manual

- [x] 4.4 Dev server starts on workerd runtime
- [x] 4.5 Auth flow works end-to-end
- [x] 4.6 Supabase SSR client connects without errors

### Phase 5: CI/CD Workflow

#### Automated

- [ ] 5.1 Workflow file is valid YAML
- [ ] 5.2 `.github/workflows/ci.yml` exists

#### Manual

- [ ] 5.3 CI workflow triggers on GitHub push

### Phase 6: Docs Refresh

#### Automated

- [ ] 6.1 No Cursor/Copilot/Windsurf references in docs
- [ ] 6.2 No `@astrojs/node` references in docs
- [ ] 6.3 Format passes: `npm run format`
- [ ] 6.4 Build succeeds: `npm run build`

#### Manual

- [ ] 6.5 README reads coherently and accurately
- [ ] 6.6 CLAUDE.md provides correct AI agent guidance
