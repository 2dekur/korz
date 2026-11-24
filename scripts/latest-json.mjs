// Prepares a locally built, signed release for GitHub.
// Usage (after a signed `npm run tauri build`): node scripts/latest-json.mjs 0.0.1
// Output: src-tauri/target/release/bundle/release/ with the installers (no spaces in their names:
// GitHub would rename them and break the updater URL) and latest.json, read by the in-app updater.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("usage: node scripts/latest-json.mjs X.Y.Z");

const bundle = new URL("../src-tauri/target/release/bundle/", import.meta.url);
const out = new URL("release/", bundle);
mkdirSync(out, { recursive: true });

const product = "KORZ Music";
const asset = (name) => name.replaceAll(" ", "-");
const nsis = `${product}_${version}_x64-setup.exe`;
const msi = `${product}_${version}_x64_en-US.msi`;
copyFileSync(new URL(`nsis/${nsis}`, bundle), new URL(asset(nsis), out));
copyFileSync(new URL(`msi/${msi}`, bundle), new URL(asset(msi), out));

const signature = readFileSync(new URL(`nsis/${nsis}.sig`, bundle), "utf8").trim();
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
      url: `https://github.com/2dekur/korz/releases/download/v${version}/${asset(nsis)}`,
    },
  },
};
writeFileSync(new URL("latest.json", out), JSON.stringify(manifest, null, 2) + "\n");
console.log(`release ready in ${fileURLToPath(out)}: ${asset(nsis)}, ${asset(msi)}, latest.json`);
