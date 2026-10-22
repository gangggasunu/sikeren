import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const flagsDir = join(scriptDir, "..", "node_modules", "flag-icons", "flags", "4x3");
const bucket = process.env.R2_BUCKET || "secure-private-country-flags";
const entries = await readdir(flagsDir, { withFileTypes: true });
const flags = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".svg"));

if (flags.length === 0) {
  throw new Error(`No SVG flags found in ${flagsDir}. Run npm install first.`);
}

for (const flag of flags) {
  const country = flag.name.slice(0, -4).toUpperCase();
  const file = join(flagsDir, flag.name);
  const result = spawnSync("npx", [
    "wrangler", "r2", "object", "put", `${bucket}/flags/${country}.svg`,
    "--file", file,
    "--content-type", "image/svg+xml",
    "--remote",
  ], { stdio: "inherit" });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Uploaded ${flags.length} SVG flags to private R2 bucket ${bucket}.`);
