#!/usr/bin/env node
/**
 * 热重载（生产 bundle）：先完整 build 一次，再并行
 * - vite build --watch（改 src 即重打包 dist/cli.js）
 * - node --watch dist/cli.js（dist 变化即重启 CLI，含 REPL / 微信并联）
 *
 * Ctrl+C 会结束两个子进程。
 */
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distCli = join(root, "dist", "cli.js");
const viteJs = join(root, "node_modules", "vite", "bin", "vite.js");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

let exiting = false;
/** @type {import('node:child_process').ChildProcess | undefined} */
let buildProc;
/** @type {import('node:child_process').ChildProcess | undefined} */
let runProc;

function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  try {
    buildProc?.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  try {
    runProc?.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

execFileSync(npmCmd, ["run", "build"], { cwd: root, stdio: "inherit" });

buildProc = spawn(process.execPath, [viteJs, "build", "--watch"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

buildProc.on("exit", (code, signal) => {
  if (exiting) return;
  if (signal) console.error(`[vite build --watch] signal ${signal}`);
  else console.error(`[vite build --watch] exit ${code}`);
  shutdown(code ?? 1);
});

runProc = spawn(process.execPath, ["--watch", distCli], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

runProc.on("exit", (code, signal) => {
  if (exiting) return;
  if (signal) console.error(`[node --watch] signal ${signal}`);
  else console.error(`[node --watch] exit ${code}`);
  shutdown(code ?? 1);
});
