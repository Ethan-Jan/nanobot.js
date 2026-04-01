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
import { loadSkillPromptFragments } from "../skills/skillsLoader.js";

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
  /** 本会话助手称呼，CLI `/alias` 写入；优先于默认名、低于 agents.displayName */
  agentDisplayName?: string;
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

async function readSessionFile(sessionKey: string): Promise<SessionMemoryFile | null> {
  const p = sessionMemoryFilePath(sessionKey);
  try {
    const raw = await readFile(p, "utf8");
    const data = JSON.parse(raw) as SessionMemoryFile;
    const tr = Array.isArray(data.transcript)
      ? data.transcript.filter(
          (x) =>
            x &&
            (x.role === "user" || x.role === "assistant") &&
            typeof x.content === "string",
        )
      : [];
    return {
      version: typeof data.version === "number" ? data.version : FILE_VERSION,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
      transcript: tr,
      agentDisplayName:
        typeof data.agentDisplayName === "string" ? data.agentDisplayName.trim() || undefined : undefined,
    };
  } catch {
    return null;
  }
}

async function loadTranscript(sessionKey: string): Promise<TranscriptLine[]> {
  const f = await readSessionFile(sessionKey);
  return f?.transcript ?? [];
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
  const prev = await readSessionFile(sessionKey);
  let tr = prev?.transcript ?? [];
  const agentDisplayName = prev?.agentDisplayName;
  tr.push({ role: "user", content: u }, { role: "assistant", content: a });
  if (tr.length > maxMessages) tr = tr.slice(-maxMessages);
  const dir = join(repoRoot(), ".nanobot-runtime", "memory", "sessions");
  await mkdir(dir, { recursive: true });
  const body: SessionMemoryFile = {
    version: FILE_VERSION,
    updatedAt: new Date().toISOString(),
    transcript: tr,
    ...(agentDisplayName ? { agentDisplayName } : {}),
  };
  await writeFile(sessionMemoryFilePath(sessionKey), JSON.stringify(body, null, 2) + "\n", "utf8");
}

const MAX_ALIAS_CHARS = 120;

/** 写入本会话助手称呼（持久化到 session JSON，下次进系统 prompt） */
export async function setSessionAgentDisplayName(sessionKey: string, name: string): Promise<void> {
  const trimmed = name.trim().slice(0, MAX_ALIAS_CHARS);
  const prev = await readSessionFile(sessionKey);
  const tr = prev?.transcript ?? [];
  const dir = join(repoRoot(), ".nanobot-runtime", "memory", "sessions");
  await mkdir(dir, { recursive: true });
  const body: SessionMemoryFile = {
    version: FILE_VERSION,
    updatedAt: new Date().toISOString(),
    transcript: tr,
    ...(trimmed ? { agentDisplayName: trimmed } : {}),
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

function formatSkills(skills: string[]): string {
  if (!skills.length) return "";
  return skills.join("\n\n");
}

const DEFAULT_AGENT_LABEL = "nanobot（小纳）";

function buildCoreSystemBlock(displayName: string): string {
  return `你是 ${displayName}，简洁、可靠的本地编程助手。

**工具（在有用时自动调用）** — 不要凭空猜测磁盘上的文件内容或项目结构：
- 在断言「项目里有什么」之前，先用 list_dir、search_repo、read_file 核实。
- 仅在用户明确要求修改或新建文件时使用 write_file；无法写入敏感路径（.env、密钥、微信 account.json、证书等）。
- run_shell 仅在配置中显式开启时可用；默认视为关闭，除非你看到成功的 shell 输出。
- git_status / git_diff：查看 Git 仓库状态和变更。
- file_stats：分析项目文件统计（代码行数、文件类型分布）。
- get_package_info：读取 package.json 了解项目配置和依赖。

回答尽量简短；需要时给出代码。若工具调用失败，说明原因并给出可行修复建议。

（系统可能附带「长期备忘 MEMORY.md」与「近期已持久化对话」摘要，请当作上下文参考。）`;
}

const ASK_NICKNAME_GUIDE = `

（会话引导）若当前是本会话中双方首次交流、且尚未约定称呼，请先用一两句友好话术询问：用户希望如何称呼你（昵称或别名均可）；得知后在本会话后续回复中自然地用该称呼指代自己。若用户已明显给出称呼或已在前文约定，则不必重复追问。`;

async function resolveAgentDisplayName(cfg: NanobotConfig, sessionKey: string): Promise<string> {
  const fromCfg = cfg.agents?.displayName?.trim();
  if (fromCfg) return fromCfg;
  const f = await readSessionFile(sessionKey);
  const fromSession = f?.agentDisplayName?.trim();
  if (fromSession) return fromSession;
  return DEFAULT_AGENT_LABEL;
}

async function shouldAppendAskNicknameGuide(cfg: NanobotConfig, sessionKey: string): Promise<boolean> {
  if (!cfg.agents?.askNicknameOnStart) return false;
  if (cfg.agents?.displayName?.trim()) return false;
  if (!isMemoryEnabled(cfg)) return false;
  const f = await readSessionFile(sessionKey);
  if (f?.agentDisplayName?.trim()) return false;
  const tr = f?.transcript ?? [];
  return tr.length === 0;
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
  const skills = await loadSkillPromptFragments(workspaceRoot);
  
  const parts = [
    formatSkills(skills),
    formatBlocks(blocks), 
    formatTranscript(tr)
  ].filter(Boolean);
  
  if (!parts.length) return "";
  return parts.join("\n\n---\n\n");
}

export async function buildFullSystemPrompt(
  cfg: NanobotConfig,
  workspaceRoot: string,
  sessionKey: string,
): Promise<string> {
  const displayName = await resolveAgentDisplayName(cfg, sessionKey);
  let base = buildCoreSystemBlock(displayName);
  if (await shouldAppendAskNicknameGuide(cfg, sessionKey)) {
    base += ASK_NICKNAME_GUIDE;
  }
  const suffix = await buildMemorySystemSuffix(cfg, workspaceRoot, sessionKey);
  if (!suffix) return base;
  return `${base}\n\n---\n\n${suffix}`;
}
