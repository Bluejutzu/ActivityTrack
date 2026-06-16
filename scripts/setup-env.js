#!/usr/bin/env bun
import { existsSync, lstatSync, renameSync, symlinkSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const ENV_FILE = resolve(ROOT_DIR, ".env.local");

const TARGETS = ["apps/web", "apps/desktop", "packages/backend"];

const GITIGNORE_FILE = resolve(ROOT_DIR, ".gitignore");
if (!existsSync(GITIGNORE_FILE)) {
  console.error(
    "❌ No .gitignore found at repo root — aborting to avoid leaking secrets.",
  );
  process.exit(1);
}

const gitignoreContent = await Bun.file(GITIGNORE_FILE).text();
const gitignoreLines = gitignoreContent
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const ENV_PATTERNS = /^\.env(\*|.*local.*)?$/;
const hasEnvIgnored = gitignoreLines.some((line) => ENV_PATTERNS.test(line));

if (!hasEnvIgnored) {
  console.error("❌ Your .gitignore does not appear to ignore .env files.");
  console.error("   Add one of the following before running this script:");
  console.error("     .env.local");
  console.error("     .env*");
  console.error("     .env*.local");
  process.exit(1);
}

if (!existsSync(ENV_FILE)) {
  console.error(`❌ No .env.local found at repo root (${ENV_FILE})`);
  process.exit(1);
}

for (const dir of TARGETS) {
  const targetDir = resolve(ROOT_DIR, dir);
  const link = resolve(targetDir, ".env.local");

  if (!existsSync(targetDir)) {
    console.log(`⚠️  Skipping ${dir} (directory not found)`);
    continue;
  }

  const stat = existsSync(link) ? lstatSync(link) : null;

  if (stat?.isSymbolicLink()) {
    console.log(`↩️  Already a symlink, skipping: ${dir}/.env.local`);
    continue;
  }

  if (stat?.isFile()) {
    console.log(
      `⚠️  Real file exists at ${dir}/.env.local — backing up to .env.local.bak`,
    );
    renameSync(link, `${link}.bak`);
  }

  symlinkSync(ENV_FILE, link);
  console.log(`✅ ${dir}/.env.local → .env.local`);
}

console.log("\nDone.");
