// Prints the ROADMAP.md section of a version as release notes (shown in the in-app update popup).
// Usage: node scripts/release-notes.mjs v0.0.6
import { readFileSync } from "node:fs";

const version = (process.argv[2] ?? "").replace(/^v?/, "v");
const md = readFileSync(new URL("../ROADMAP.md", import.meta.url), "utf8");
const heading = `### ${version} `;
const start = md.indexOf(heading);
let notes = "Améliorations et corrections.";
if (start >= 0) {
  const body = md.slice(md.indexOf("\n", start) + 1);
  const end = body.search(/\n#{2,3} /);
  notes = (end >= 0 ? body.slice(0, end) : body).trim().replace(/^- \[x\] /gm, "- ");
}
process.stdout.write(notes + "\n");
