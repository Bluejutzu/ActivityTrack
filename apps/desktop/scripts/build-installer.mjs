// Stages everything the Inno Setup installer needs, then invokes iscc.
//
// Steps (to be fleshed out during implementation):
//   1. pnpm build           -> apps/desktop/dist/index.js
//   2. copy a pinned node.exe into staging/        (download or vendor it)
//   3. copy dist/ into staging/dist/
//   4. copy node_modules/koffi (incl. prebuilt .node) into staging/
//   5. iscc installer/activitytrack.iss            -> installer/Output/*.exe
//
// Kept as an explicit script (not buried in npm) so the GitHub Actions release
// workflow and a local Windows build run the exact same path.

import { execSync } from "node:child_process";
import { mkdirSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.resolve(root, "..");
const staging = path.join(desktop, "installer", "staging");

mkdirSync(staging, { recursive: true });

// TODO: vendor node.exe (e.g. download nodejs.org/dist/<ver>/win-x64/node.exe).
// TODO: copy dist + koffi once `pnpm build` has run.
cpSync(path.join(desktop, "dist"), path.join(staging, "dist"), { recursive: true });
cpSync(
  path.join(desktop, "node_modules", "koffi"),
  path.join(staging, "node_modules", "koffi"),
  { recursive: true },
);

execSync("iscc installer/activitytrack.iss", { cwd: desktop, stdio: "inherit" });
console.log("Installer written to apps/desktop/installer/Output/");
