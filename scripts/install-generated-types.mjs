// Installs the output of the Supabase MCP `generate_typescript_types` tool (saved to a
// file when it is too large to print) as types/db-schema.ts.
//   node scripts/install-generated-types.mjs <saved-output-file> [required-symbol ...]
import fs from "node:fs";

const [file, ...required] = process.argv.slice(2);
if (!file) {
	console.error("usage: node scripts/install-generated-types.mjs <file> [symbol ...]");
	process.exit(1);
}
const raw = fs.readFileSync(file, "utf8");
let types;
try {
	const j = JSON.parse(raw);
	types = typeof j === "string" ? j : j.types ?? j.result ?? j.text;
} catch {
	types = raw;
}
if (typeof types !== "string" || !types.startsWith("export type Json")) throw new Error("Unexpected file format — not generated Supabase types.");
const missing = required.filter((r) => !types.includes(r));
if (missing.length) throw new Error(`Generated types are missing: ${missing.join(", ")} (was the migration applied to this project?)`);
fs.writeFileSync(new URL("../types/db-schema.ts", import.meta.url), types);
console.log(`types/db-schema.ts written (${types.length} chars)`);
