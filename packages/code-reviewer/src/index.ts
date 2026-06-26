import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewDiff } from "./reviewer";

const here = dirname(fileURLToPath(import.meta.url));

// Wczytaj packages/code-reviewer/.env (Node 24). Brak pliku jest OK — klucz może być w shellu.
try {
  process.loadEnvFile(join(here, "..", ".env"));
} catch {
  /* brak .env */
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

let diff = await readStdin();

if (!diff.trim()) {
  const sample = join(here, "..", "fixtures", "sample.diff");
  if (existsSync(sample)) {
    diff = readFileSync(sample, "utf8");
    console.error("ℹ️  Brak diffa na stdin — używam fixtures/sample.diff (symulowany diff).\n");
  } else {
    console.error("Użycie: git diff | npm run review");
    process.exit(1);
  }
}

const { review, usage } = await reviewDiff(diff);
console.log(JSON.stringify(review, null, 2));
if (usage) console.error("\n📊 usage:", JSON.stringify(usage));
