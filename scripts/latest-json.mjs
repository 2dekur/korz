// Writes the updater manifest for a locally built, signed release.
// Usage (after `TAURI_SIGNING_PRIVATE_KEY=... npm run tauri build`): node scripts/latest-json.mjs 0.0.6
// Output: src-tauri/target/release/bundle/latest.json, to upload to the GitHub release with the installer.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("usage: node scripts/latest-json.mjs X.Y.Z");

const bundle = new URL("../src-tauri/target/release/bundle/", import.meta.url);
const installer = `Korz_${version}_x64-setup.exe`;
const signature = readFileSync(new URL(`nsis/${installer}.sig`, bundle), "utf8").trim();
const notes = execFileSync(process.execPath, [fileURLToPath(new URL("release-notes.mjs", import.meta.url)), `v${version}`], {
  encoding: "utf8",
}).trim();

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/2dekur/korz/releases/download/v${version}/${installer}`,
    },
  },
};
writeFileSync(new URL("latest.json", bundle), JSON.stringify(manifest, null, 2) + "\n");
console.log(`latest.json written for ${installer}`);
