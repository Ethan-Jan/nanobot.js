/**
 * 对齐上游 `nanobot/agent/memory.py` 的轻量实现（无向量库）。
 *
 * 1) **workspace/MEMORY.md**：用户可编辑的 `## 标题` 分块，注入 system。
 * 2) **.nanobot-runtime/memory/sessions/<session>.json**：按 session 持久化最近若干轮 user/assistant 文本，跨进程/重启衔接。
 */

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MemoryConfig, NanobotConfig } from "../../config.js";
import { repoRoot } from "../../config.js";

export interface MemoryBlock {
  title: string;
  content: string;
}

export interface TranscriptLine {
  role: "user" | "assistant";
  content: string;
}

interface SessionMemoryFile {
  version: number;
  updatedAt: string;
  transcript: TranscriptLine[];
}

const FILE_VERSION = 1;
const MAX_LINE_CHARS = 12_000;

export function sanitizeSessionKey(key: string): string {
  const s = key.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return s || "default";
}

export function sessionMemoryFilePath(sessionKey: string): string {
  return join(repoRoot(), ".nanobot-runtime", "memory", "sessions", `${sanitizeSessionKey(sessionKey)}.json`);
}

function resolvedMemoryConfig(cfg: NanobotConfig): Required<MemoryConfig> {
  const m = cfg.agents.memory ?? {};
  return {
    enabled: m.enabled !== false,
    maxPersistedMessages: Math.min(200, Math.max(4, m.maxPersistedMessages ?? 40)),
  };
}

export function isMemoryEnabled(cfg: NanobotConfig): boolean {
  return resolvedMemoryConfig(cfg).enabled;
}

export function memoryPersistLimit(cfg: NanobotConfig): number {
  return resolvedMemoryConfig(cfg).maxPersistedMessages;
}

/** 解析 Markdown：含 `## ` 则按标题分块；否则整文件一块 */
export function parseMemoryMarkdown(raw: string): MemoryBlock[] {
  const text = raw.replace(/^\uFEFF/, "");
  if (!/^##\s/m.test(text)) {
    const t = text.trim();
    return t ? [{ title: "MEMORY.md", content: t }] : [];
  }
  const blocks: MemoryBlock[] = [];
  const lines = text.split(/\r?\n/);
  let title = "";
  const buf: string[] = [];
  const flush = (): void => {
    const c = buf.join("\n").trim();
    buf.length = 0;
    if (!title && !c) return;
    blocks.push({ title: title || "备忘", content: c });
  };
  for (const line of lines) {
    const m = /^##\s+(.+)$/.exec(line);
    if (m) {
      flush();
      title = m[1].trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return blocks;
}

export async function loadMemoryBlocks(workspaceRoot: string): Promise<MemoryBlock[]> {
  try {
    const raw = await readFile(join(workspaceRoot, "MEMORY.md"), "utf8");
    return parseMemoryMarkdown(raw);
  } catch {
    return [];
  }
}

async function loadTranscript(sessionKey: string): Promise<TranscriptLine[]> {
  const p = sessionMemoryFilePath(sessionKey);
  try {
    const raw = await readFile(p, "utf8");
    const data = JSON.parse(raw) as SessionMemoryFile;
    if (!Array.isArray(data.transcript)) return [];
    return data.transcript.filter(
      (x) =>
        x &&
        (x.role === "user" || x.role === "assistant") &&
        typeof x.content === "string",
    );
  } catch {
    return [];
  }
}

export async function clearSessionMemory(sessionKey: string): Promise<void> {
  try {
    await unlink(sessionMemoryFilePath(sessionKey));
  } catch {
    /* noop */
  }
}

export async function appendSessionTranscript(
  sessionKey: string,
  user: string,
  assistant: string,
  maxMessages: number,
): Promise<void> {
  const u = user.slice(0, MAX_LINE_CHARS);
  const a = assistant.slice(0, MAX_LINE_CHARS);
  let tr = await loadTranscript(sessionKey);
  tr.push({ role: "user", content: u }, { role: "assistant", content: a });
  if (tr.length > maxMessages) tr = tr.slice(-maxMessages);
  const dir = join(repoRoot(), ".nanobot-runtime", "memory", "sessions");
  await mkdir(dir, { recursive: true });
  const body: SessionMemoryFile = {
    version: FILE_VERSION,
    updatedAt: new Date().toISOString(),
    transcript: tr,
  };
  await writeFile(sessionMemoryFilePath(sessionKey), JSON.stringify(body, null, 2) + "\n", "utf8");
}

function formatBlocks(blocks: MemoryBlock[]): string {
  if (!blocks.length) return "";
  const parts = blocks.map((b) => `### ${b.title}\n${b.content}`);
  return `## 长期备忘（工作区 MEMORY.md）\n${parts.join("\n\n")}`;
}

function formatTranscript(tr: TranscriptLine[]): string {
  if (!tr.length) return "";
  const lines = tr.map((m) => (m.role === "user" ? `用户：${m.content}` : `助手：${m.content}`));
  return `## 近期对话（已持久化，可跨重启）\n${lines.join("\n\n")}`;
}

/** 拼入 system 的附加段；无内容则空串 */
export async function buildMemorySystemSuffix(
  cfg: NanobotConfig,
  workspaceRoot: string,
  sessionKey: string,
): Promise<string> {
  if (!isMemoryEnabled(cfg)) return "";
  const blocks = await loadMemoryBlocks(workspaceRoot);
  const tr = await loadTranscript(sessionKey);
  const parts = [formatBlocks(blocks), formatTranscript(tr)].filter(Boolean);
  if (!parts.length) return "";
  return parts.join("\n\n---\n\n");
}

export async function buildFullSystemPrompt(
  baseSystem: string,
  cfg: NanobotConfig,
  workspaceRoot: string,
  sessionKey: string,
): Promise<string> {
  const suffix = await buildMemorySystemSuffix(cfg, workspaceRoot, sessionKey);
  if (!suffix) return baseSystem;
  return `${baseSystem}\n\n---\n\n${suffix}`;
}
