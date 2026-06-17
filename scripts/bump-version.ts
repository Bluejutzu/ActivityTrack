#!/usr/bin/env node
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");

interface Config {
  version: string;
  dryRun: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node scripts/bump-version.ts <version> [--dry-run]");
    console.error("Example: node scripts/bump-version.ts 0.2.5");
    process.exit(1);
  }

  const version = args[0];
  const dryRun = args.includes("--dry-run");

  // Validate version format
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error("❌ Version must be in x.y.z format (e.g. 0.2.5)");
    process.exit(1);
  }

  return { version, dryRun };
}

function exec(cmd: string, silent = false): string {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: "utf-8" }).toString();
  } catch (e) {
    if (!silent) throw e;
    return "";
  }
}

function checkGitStatus(): void {
  const status = exec("git status --porcelain", true);
  if (status.trim()) {
    console.error("❌ Working tree has uncommitted changes.");
    console.error("   Commit or stash them first.");
    process.exit(1);
  }
}

function checkTagExists(version: string): void {
  const tagName = `v${version}`;
  const existingTag = exec(`git tag -l ${tagName}`, true);
  if (existingTag.trim()) {
    console.error(`❌ Tag ${tagName} already exists.`);
    console.error("   Use a different version or delete the tag first.");
    process.exit(1);
  }
}

function updateCargoToml(version: string): void {
  const path = resolve(ROOT_DIR, "apps/desktop/src-tauri/Cargo.toml");
  let content = readFileSync(path, "utf-8");

  // Replace only the first occurrence (package version, not deps)
  const match = content.match(/^version = "[^"]*"/m);
  if (match) {
    const index = content.indexOf(match[0]);
    content = content.slice(0, index) + `version = "${version}"` + content.slice(index + match[0].length);
  }

  writeFileSync(path, content);
}

function updateTauriConf(version: string): void {
  const path = resolve(ROOT_DIR, "apps/desktop/src-tauri/tauri.conf.json");
  const content = JSON.parse(readFileSync(path, "utf-8"));
  content.version = version;
  writeFileSync(path, JSON.stringify(content, null, 2) + "\n");
}

function updatePackageJson(version: string): void {
  const path = resolve(ROOT_DIR, "apps/desktop/package.json");
  const content = JSON.parse(readFileSync(path, "utf-8"));
  content.version = version;
  writeFileSync(path, JSON.stringify(content, null, 2) + "\n");
}

async function main() {
  const { version, dryRun } = parseArgs();

  console.log(`🔄 Bumping version to ${version}...\n`);

  checkGitStatus();
  checkTagExists(version);

  // Update files
  updateCargoToml(version);
  updateTauriConf(version);
  updatePackageJson(version);

  const files = [
    "apps/desktop/src-tauri/Cargo.toml",
    "apps/desktop/src-tauri/tauri.conf.json",
    "apps/desktop/package.json",
  ];

  console.log("✅ Updated:");
  files.forEach((f) => console.log(`   ${f}`));

  if (dryRun) {
    console.log("\n📋 Dry run — showing diff:\n");
    exec(`git diff ${files.join(" ")}`);
    console.log("\nSkipping git commit, tag, and push.");
    process.exit(0);
  }

  console.log("\n🔗 Creating commit and tag...");
  exec(`git add ${files.join(" ")}`);
  exec(`git commit -m "chore: bump version to ${version}"`);
  exec(`git tag -a v${version} -m "v${version}"`);

  console.log("🚀 Pushing to remote...");
  exec("git push");
  exec(`git push origin v${version}`);

  console.log(`\n✨ Done! v${version} is ready for CI build and publish.`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
