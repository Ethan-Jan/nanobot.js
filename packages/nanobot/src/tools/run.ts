import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn, exec } from "node:child_process";
import { dirname, resolve, relative, sep, extname, join } from "node:path";
import { promisify } from "node:util";
import type { ToolPolicy } from "../config.js";
import { isWritePathBlocked } from "./writeGuard.js";

const execPromise = promisify(exec);

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
  ".nanobot-runtime",
  "coverage",
  ".nyc_output",
]);

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".md", ".txt", ".yml", ".yaml",
  ".css", ".scss", ".less", ".html", ".xml",
  ".py", ".rb", ".go", ".rs", ".java", ".cpp", ".c", ".h",
  ".sh", ".bash", ".zsh", ".ps1",
  ".sql", ".prisma", ".graphql",
  ".env", ".gitignore", ".dockerignore",
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

  // ===== New Tools =====

  if (name === "git_status") {
    return await getGitStatus(root);
  }

  if (name === "git_diff") {
    const staged = (args as { staged?: boolean }).staged ?? false;
    const path = String((args as { path?: string }).path ?? "");
    return await getGitDiff(root, staged, path);
  }

  if (name === "file_stats") {
    const sub = String((args as { path?: string }).path ?? ".");
    let topN = Number((args as { top_n?: number }).top_n);
    if (!Number.isFinite(topN) || topN < 1) topN = 10;
    return await getFileStats(root, sub, topN);
  }

  if (name === "get_package_info") {
    return await getPackageInfo(root);
  }

  return `Unknown tool: ${name}`;
}

// ===== Git Tools =====

async function getGitStatus(root: string): Promise<string> {
  try {
    const { stdout: branch } = await execPromise("git branch --show-current", { cwd: root });
    const { stdout: status } = await execPromise("git status --porcelain", { cwd: root });
    const { stdout: aheadBehind } = await execPromise(
      'git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0\t0"',
      { cwd: root },
    );
    
    const currentBranch = branch.trim();
    const [ahead, behind] = aheadBehind.trim().split("\t").map(Number);
    
    const lines = status.trim().split("\n").filter(Boolean);
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith("?? ")) {
        untracked.push(line.slice(3));
      } else {
        const stagedStatus = line[0];
        const unstagedStatus = line[1];
        const file = line.slice(3);
        if (stagedStatus !== " " && stagedStatus !== "?") {
          staged.push(`${file} (${stagedStatus})`);
        }
        if (unstagedStatus !== " " && unstagedStatus !== "?") {
          unstaged.push(`${file} (${unstagedStatus})`);
        }
      }
    }
    
    const parts: string[] = [];
    parts.push(`Branch: ${currentBranch}`);
    if (ahead > 0 || behind > 0) {
      parts.push(`Upstream: +${ahead}/-${behind}`);
    }
    parts.push("");
    if (staged.length) {
      parts.push(`Staged (${staged.length}):`);
      parts.push(...staged.map(s => `  + ${s}`));
      parts.push("");
    }
    if (unstaged.length) {
      parts.push(`Modified (${unstaged.length}):`);
      parts.push(...unstaged.map(s => `  M ${s}`));
      parts.push("");
    }
    if (untracked.length) {
      parts.push(`Untracked (${untracked.length}):`);
      parts.push(...untracked.slice(0, 20).map(s => `  ? ${s}`));
      if (untracked.length > 20) {
        parts.push(`  ... and ${untracked.length - 20} more`);
      }
    }
    if (!staged.length && !unstaged.length && !untracked.length) {
      parts.push("Working directory clean");
    }
    
    return parts.join("\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Git error: ${msg}. Is this a git repository?`;
  }
}

async function getGitDiff(root: string, staged: boolean, path: string): Promise<string> {
  try {
    let cmd = staged ? "git diff --staged" : "git diff";
    if (path) {
      const abs = assertInsideWorkspace(root, path);
      cmd += ` "${relative(root, abs) || path}"`;
    }
    cmd += " --no-color";
    
    const { stdout } = await execPromise(cmd, { cwd: root });
    if (!stdout.trim()) {
      return staged ? "No staged changes" : "No unstaged changes";
    }
    
    // Truncate if too large
    if (stdout.length > 100_000) {
      return stdout.slice(0, 100_000) + "\n\n...[diff truncated, use path parameter for specific file]";
    }
    return stdout;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Git diff error: ${msg}`;
  }
}

// ===== File Stats Tool =====

interface FileInfo {
  path: string;
  size: number;
  lines: number;
  ext: string;
}

async function getFileStats(root: string, sub: string, topN: number): Promise<string> {
  const start = assertInsideWorkspace(root, sub);
  const files: FileInfo[] = [];
  const extCounts: Map<string, { count: number; lines: number }> = new Map();
  let totalFiles = 0;
  let totalLines = 0;
  let totalSize = 0;
  
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (SKIP_DIR_NAMES.has(e.name)) continue;
      const full = resolve(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        const relPath = relative(root, full);
        const ext = extname(e.name).toLowerCase();
        let size = 0;
        let lines = 0;
        
        try {
          const stats = await stat(full);
          size = stats.size;
          
          // Count lines for text files
          if (TEXT_EXTENSIONS.has(ext) || size < 1024 * 1024) {
            try {
              const content = await readFile(full, "utf8");
              lines = content.split("\n").length;
            } catch {
              // Binary or unreadable
            }
          }
        } catch {
          continue;
        }
        
        totalFiles++;
        totalLines += lines;
        totalSize += size;
        
        const extKey = ext || "(no ext)";
        const curr = extCounts.get(extKey) || { count: 0, lines: 0 };
        curr.count++;
        curr.lines += lines;
        extCounts.set(extKey, curr);
        
        files.push({ path: relPath, size, lines, ext: extKey });
      }
    }
  }
  
  await walk(start);
  
  if (!files.length) {
    return "No files found in the specified path.";
  }
  
  // Sort by size for top N
  files.sort((a, b) => b.size - a.size);
  const largest = files.slice(0, topN);
  
  // Sort extensions by count
  const extSorted = [...extCounts.entries()].sort((a, b) => b[1].count - a[1].count);
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };
  
  const parts: string[] = [];
  parts.push(`📁 Directory: ${sub === "." ? "workspace root" : sub}`);
  parts.push(`📄 Total files: ${totalFiles.toLocaleString()}`);
  parts.push(`📊 Total lines: ${totalLines.toLocaleString()}`);
  parts.push(`💾 Total size: ${formatSize(totalSize)}`);
  parts.push("");
  
  parts.push("📈 File types:");
  for (const [ext, info] of extSorted.slice(0, 10)) {
    parts.push(`  ${ext}: ${info.count} files (${info.lines.toLocaleString()} lines)`);
  }
  parts.push("");
  
  parts.push(`🔝 Largest files (top ${topN}):`);
  for (const f of largest) {
    const lineInfo = f.lines > 0 ? `, ${f.lines.toLocaleString()} lines` : "";
    parts.push(`  ${f.path} (${formatSize(f.size)}${lineInfo})`);
  }
  
  return parts.join("\n");
}

// ===== Package Info Tool =====

async function getPackageInfo(root: string): Promise<string> {
  const pkgPath = join(root, "package.json");
  
  try {
    const content = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(content);
    
    const parts: string[] = [];
    parts.push(`📦 ${pkg.name || "Unnamed Project"}${pkg.version ? ` v${pkg.version}` : ""}`);
    
    if (pkg.description) {
      parts.push(`📝 ${pkg.description}`);
    }
    parts.push("");
    
    if (pkg.scripts && Object.keys(pkg.scripts).length > 0) {
      parts.push("⚡ Available scripts:");
      for (const [name, cmd] of Object.entries(pkg.scripts)) {
        parts.push(`  ${name}: ${String(cmd).slice(0, 60)}${String(cmd).length > 60 ? "..." : ""}`);
      }
      parts.push("");
    }
    
    const depTypes = [
      { key: "dependencies", label: "📌 Dependencies" },
      { key: "devDependencies", label: "🔧 Dev Dependencies" },
      { key: "peerDependencies", label: "🔗 Peer Dependencies" },
    ];
    
    for (const { key, label } of depTypes) {
      const deps = pkg[key];
      if (deps && Object.keys(deps).length > 0) {
        const depList = Object.entries(deps).slice(0, 15);
        parts.push(`${label} (${Object.keys(deps).length}):`);
        for (const [name, version] of depList) {
          parts.push(`  ${name}@${version}`);
        }
        if (Object.keys(deps).length > 15) {
          parts.push(`  ... and ${Object.keys(deps).length - 15} more`);
        }
        parts.push("");
      }
    }
    
    if (pkg.engines) {
      parts.push("⚙️  Engine requirements:");
      for (const [engine, version] of Object.entries(pkg.engines)) {
        parts.push(`  ${engine}: ${version}`);
      }
    }
    
    return parts.join("\n");
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return "No package.json found in the workspace.";
    }
    return `Error reading package.json: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ===== Shell Execution =====

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
