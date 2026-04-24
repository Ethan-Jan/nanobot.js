/**
 * 用户画像 / 当前意图 / 交互偏好，持久化在 workspace 下 `.nanobot/user-context.json`。
 * 与 MEMORY.md 互补：偏结构化、便于管理端与模型协作更新。
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const USER_CONTEXT_REL_PATH = ".nanobot/user-context.json";

export type UserProfile = {
  /** 一段自然语言，概括你是谁、什么角色 */
  summary?: string;
  /** 如：全栈开发、产品经理、学生 */
  role?: string;
  /** 工作/学习领域与场景 */
  domain?: string;
  /** 常用技术栈、语言、框架 */
  techStack?: string[];
  /** 时区或作息说明（选填） */
  timezoneOrSchedule?: string;
  /** 其它对协作重要的背景 */
  notes?: string;
};

export type UserIntent = {
  /** 当前阶段最想完成或推进的事 */
  summary?: string;
  /** 更短周期的具体目标 */
  shortTerm?: string;
  /** ISO 时间，人类或助手上次更新「意图」时填写 */
  updatedAt?: string;
};

export type UserPreferences = {
  /** 回复语言，如 zh、en、中英混 */
  responseLanguage?: string;
  /** 详略 */
  detailLevel?: "brief" | "normal" | "detailed";
  /** 代码与文档风格，如：TypeScript 优先、少注释、函数式等 */
  codeAndDocsStyle?: string;
  /** 自由补充：工作节奏、审阅方式、禁忌等 */
  extra?: string;
};

export type UserContextData = {
  version: 1;
  updatedAt: string;
  profile?: UserProfile;
  intent?: UserIntent;
  preferences?: UserPreferences;
};

function defaultEmpty(): UserContextData {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    profile: {},
    intent: {},
    preferences: {},
  };
}

export function userContextPath(workspaceRoot: string): string {
  return join(workspaceRoot, USER_CONTEXT_REL_PATH);
}

export async function loadUserContext(workspaceRoot: string): Promise<UserContextData | null> {
  try {
    const raw = await readFile(userContextPath(workspaceRoot), "utf8");
    const data = JSON.parse(raw) as UserContextData;
    if (data?.version !== 1) return null;
    return {
      version: 1,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
      profile: data.profile && typeof data.profile === "object" ? data.profile : undefined,
      intent: data.intent && typeof data.intent === "object" ? data.intent : undefined,
      preferences: data.preferences && typeof data.preferences === "object" ? data.preferences : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveUserContext(workspaceRoot: string, data: UserContextData): Promise<void> {
  const body: UserContextData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    profile: data.profile,
    intent: data.intent,
    preferences: data.preferences,
  };
  const dir = join(workspaceRoot, ".nanobot");
  await mkdir(dir, { recursive: true });
  await writeFile(
    userContextPath(workspaceRoot),
    JSON.stringify(body, null, 2) + "\n",
    "utf8",
  );
}

/** 无文件时供 API 展示默认空表 */
export function emptyUserContextForEditor(): UserContextData {
  return defaultEmpty();
}

/**
 * 注入 system 的 Markdown 段；无有效内容时返回空串
 */
export function formatUserContextForPrompt(data: UserContextData | null): string {
  if (!data) return "";
  const p = data.profile;
  const i = data.intent;
  const f = data.preferences;

  const lines: string[] = [];

  if (p) {
    const sub: string[] = [];
    if (p.summary?.trim()) sub.push(`- **概况**：${p.summary.trim()}`);
    if (p.role?.trim()) sub.push(`- **角色**：${p.role.trim()}`);
    if (p.domain?.trim()) sub.push(`- **领域/场景**：${p.domain.trim()}`);
    if (p.techStack?.length) sub.push(`- **常用技术**：${p.techStack.join("、")}`);
    if (p.timezoneOrSchedule?.trim()) sub.push(`- **时区/作息**：${p.timezoneOrSchedule.trim()}`);
    if (p.notes?.trim()) sub.push(`- **其它背景**：${p.notes.trim()}`);
    if (sub.length) lines.push(`### 用户画像\n${sub.join("\n")}`);
  }

  if (i && (i.summary?.trim() || i.shortTerm?.trim())) {
    const sub: string[] = [];
    if (i.summary?.trim()) sub.push(`- **当前主要意图**：${i.summary.trim()}`);
    if (i.shortTerm?.trim()) sub.push(`- **短期目标**：${i.shortTerm.trim()}`);
    if (i.updatedAt?.trim()) sub.push(`- *意图最近更新*：${i.updatedAt.trim()}`);
    if (sub.length) lines.push(`### 用户意图（协作时请对齐）\n${sub.join("\n")}`);
  }

  if (f) {
    const sub: string[] = [];
    if (f.responseLanguage?.trim()) sub.push(`- **回复语言**：${f.responseLanguage.trim()}`);
    if (f.detailLevel) sub.push(`- **详略**：${f.detailLevel}`);
    if (f.codeAndDocsStyle?.trim()) sub.push(`- **代码/文档风格**：${f.codeAndDocsStyle.trim()}`);
    if (f.extra?.trim()) sub.push(`- **其它偏好**：${f.extra.trim()}`);
    if (sub.length) lines.push(`### 用户偏好\n${sub.join("\n")}`);
  }

  if (!lines.length) return "";

  return [
    "## 用户画像、意图与偏好",
    "以下为用户在 workspace 的 `.nanobot/user-context.json` 中维护的信息；**请据此个人化建议与表达**，与事实冲突时以用户**本轮说法**和**工具读到的项目事实**为准。",
    "若用户明显更新了背景或目标，可提醒其保存到该文件或管理端「用户画像」页。",
    ...lines,
  ].join("\n\n");
}
