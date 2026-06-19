#!/usr/bin/env node
// Verifies the three desktop version sources stay in lockstep, and optionally
// that they match an expected version (e.g. the release tag passed as argv[2]).
//
// `bump-version.js` already updates all three together, so this is a guard
// against manual edits or a bad merge silently desyncing them — a desync makes
// the Tauri updater's `latest.json` disagree with the installed build.
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function cargoVersion() {
  const c = readFileSync(
    resolve(ROOT, "apps/desktop/src-tauri/Cargo.toml"),
    "utf-8",
  );
  return c.match(/^version = "([^"]+)"/m)?.[1];
}
function jsonVersion(rel) {
  return JSON.parse(readFileSync(resolve(ROOT, rel), "utf-8")).version;
}

const versions = {
  "Cargo.toml": cargoVersion(),
  "tauri.conf.json": jsonVersion("apps/desktop/src-tauri/tauri.conf.json"),
  "package.json": jsonVersion("apps/desktop/package.json"),
};

let ok = true;
const unique = [...new Set(Object.values(versions))];
if (unique.length !== 1) {
  console.error("❌ Desktop version files disagree:");
  for (const [f, v] of Object.entries(versions)) console.error(`   ${f}: ${v}`);
  ok = false;
}

// argv[2], if given, is the expected version (a leading "v" from the tag is ok).
const expected = process.argv[2]?.replace(/^v/, "");
if (expected && unique[0] !== expected) {
  console.error(`❌ Version ${unique[0] ?? "?"} does not match expected ${expected}.`);
  ok = false;
}

if (!ok) process.exit(1);
console.log(`✅ Desktop version in sync: ${unique[0]}`);
