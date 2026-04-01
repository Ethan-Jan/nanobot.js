import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve, relative, sep } from "node:path";
import type { ToolPolicy } from "../config.js";
import { isWritePathBlocked } from "./writeGuard.js";

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".nanobot",
  ".venv",
  "venv",
]);

function assertInsideWorkspace(root: string, target: string): string {
  const absRoot = resolve(root);
  const abs = resolve(root, target);
  const rel = relative(absRoot, abs);
  if (rel.startsWith(`..${sep}`) || rel === "..") {
    throw new Error("Path escapes workspace");
  }
  return abs;
}

export async function runTool(
  name: string,
  args: unknown,
  policy: ToolPolicy,
): Promise<string> {
  const root = resolve(policy.workspaceRoot ?? process.cwd());
  const allowShell = policy.allowShell ?? false;

  const allowWrite = policy.allowWrite !== false;
  try {
    return await runToolInner(name, args, root, allowShell, allowWrite);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Error: ${msg}`;
  }
}

async function runToolInner(
  name: string,
  args: unknown,
  root: string,
  allowShell: boolean,
  allowWrite: boolean,
): Promise<string> {
  if (name === "read_file") {
    const path = String((args as { path?: string }).path ?? "");
    const abs = assertInsideWorkspace(root, path);
    const content = await readFile(abs, "utf8");
    return content.length > 120_000 ? content.slice(0, 120_000) + "\n…[truncated]" : content;
  }

  if (name === "list_dir") {
    const path = String((args as { path?: string }).path ?? ".");
    const abs = assertInsideWorkspace(root, path);
    const entries = await readdir(abs, { withFileTypes: true });
    return entries.map((e) => `${e.isDirectory() ? "dir " : "file"} ${e.name}`).join("\n");
  }

  if (name === "write_file") {
    if (!allowWrite) {
      return "Error: write_file is disabled (set tools.allowWrite true in nanobot.config.json).";
    }
    const path = String((args as { path?: string }).path ?? "");
    const content = String((args as { content?: string }).content ?? "");
    if (isWritePathBlocked(path)) {
      return `Error: refusing to write sensitive path (${path}): .env*, SSH private key names, weixin account.json, .pem/.p12/.pfx.`;
    }
    const abs = assertInsideWorkspace(root, path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
    return `Wrote ${relative(root, abs) || path} (${content.length} bytes)`;
  }

  if (name === "search_repo") {
    const query = String((args as { query?: string }).query ?? "");
    const sub = String((args as { path?: string }).path ?? ".");
    let maxResults = Number((args as { max_results?: number }).max_results);
    if (!Number.isFinite(maxResults) || maxResults < 1) maxResults = 80;
    maxResults = Math.min(200, maxResults);
    if (!query) return "Empty query";
    const start = assertInsideWorkspace(root, sub);
    const lines: string[] = [];
    let filesScanned = 0;
    const maxFiles = 500;
    const maxFileBytes = 384 * 1024;

    async function walk(dir: string): Promise<void> {
      if (lines.length >= maxResults || filesScanned >= maxFiles) return;
      const entries = await readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (lines.length >= maxResults || filesScanned >= maxFiles) return;
        if (SKIP_DIR_NAMES.has(e.name)) continue;
        const full = resolve(dir, e.name);
        if (e.isDirectory()) {
          await walk(full);
        } else if (e.isFile()) {
          let size = 0;
          try {
            size = (await stat(full)).size;
          } catch {
            continue;
          }
          if (size > maxFileBytes) continue;
          filesScanned += 1;
          let text: string;
          try {
            text = await readFile(full, "utf8");
          } catch {
            continue;
          }
          if (text.includes("\0")) continue;
          const relPath = relative(root, full);
          const parts = text.split("\n");
          for (let i = 0; i < parts.length; i++) {
            if (lines.length >= maxResults) return;
            if (parts[i].includes(query)) {
              lines.push(`${relPath}:${i + 1}: ${parts[i].slice(0, 500)}`);
            }
          }
        }
      }
    }

    await walk(start);
    if (!lines.length) return `No matches for ${JSON.stringify(query)} (scanned ${filesScanned} files)`;
    return lines.join("\n");
  }

  if (name === "run_shell") {
    if (!allowShell) {
      return "Shell is disabled. Set tools.allowShell true in nanobot.config.json (project root) or NANOBOT_CONFIG path.";
    }
    const command = String((args as { command?: string }).command ?? "");
    if (!command.trim()) {
      return "Empty command";
    }
    return await execInDir(root, command.trim());
  }

  return `Unknown tool: ${name}`;
}

function execInDir(cwd: string, command: string): Promise<string> {
  return new Promise((resolvePromise) => {
    const isWin = process.platform === "win32";
    const child = spawn(isWin ? "cmd.exe" : "sh", isWin ? ["/d", "/s", "/c", command] : ["-lc", command], {
      cwd,
      env: process.env,
      windowsHide: true,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      const body = [out, err && `[stderr]\n${err}`].filter(Boolean).join("\n");
      resolvePromise(`exit ${code}\n${body || "(no output)"}`);
    });
    child.on("error", (e) => resolvePromise(`spawn error: ${(e as Error).message}`));
  });
}
