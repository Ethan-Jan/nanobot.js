import { mkdir, readdir, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type ProviderName = string;

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface AgentDefaults {
  model: string;
  provider: ProviderName;
}

/** 持久化记忆：workspace/MEMORY.md + .nanobot-runtime/memory/sessions/<session>.json */
export interface MemoryConfig {
  /** false 关闭注入与落盘 */
  enabled?: boolean;
  /** 每会话最多保留的条数（user/assistant 各算一条），默认 40 */
  maxPersistedMessages?: number;
}

export interface AgentsConfig {
  defaults: AgentDefaults;
  memory?: MemoryConfig;
}

export interface ToolPolicy {
  allowShell: boolean;
  workspaceRoot?: string;
  /** false 时禁止 write_file（读/搜/列仍可用）；默认 true */
  allowWrite?: boolean;
}

/**
 * 个人微信通道（iLink HTTP 长轮询），语义对齐上游 `nanobot/channels/weixin.py` / openclaw-weixin。
 */
export interface WeixinChannelConfig {
  /** true 时 `pnpm start` / 默认 agent REPL 会在后台并联启动 iLink 长轮询（须已 login）；运行中默认仅打一条就绪日志，详细见 NANOBOT_WEIXIN_VERBOSE */
  enabled?: boolean;
  /** 非空时仅这些 from_user_id 会触发 Agent */
  allow_from?: string[];
  base_url?: string;
  cdn_base_url?: string;
  route_tag?: string | number | null;
  /** 可手动填；通常由 `channels weixin login` 写入 account.json */
  token?: string;
  /** 状态目录，默认：`<repo>/.nanobot-runtime/weixin` */
  state_dir?: string;
  poll_timeout?: number;
}

export interface ChannelsConfig {
  weixin?: WeixinChannelConfig;
}

export interface NanobotConfig {
  providers: Record<ProviderName, ProviderConfig>;
  agents: AgentsConfig;
  tools: ToolPolicy;
  channels?: ChannelsConfig;
}

/** 仅在没有被磁盘上的 nanobot.config.json 覆盖时生效 */
const DEFAULT_MODEL = "kimi-k2.5";
const DEFAULT_PROVIDER: ProviderName = "moonshot";

/** 含 package.json / dist 的工程根（与 dist/cli.js 或 src 的位置相对） */
export function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

/**
 * 配置文件路径。默认：工程根目录下 nanobot.config.json。
 * 环境变量 NANOBOT_CONFIG：绝对路径，或相对于当前工作目录的相对路径。
 */
export function configPath(): string {
  const o = process.env.NANOBOT_CONFIG?.trim();
  if (o) {
    return isAbsolutePath(o) ? o : join(process.cwd(), o);
  }
  return join(repoRoot(), "nanobot.config.json");
}

function isAbsolutePath(p: string): boolean {
  return p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p);
}

/** 配置文件所在目录 */
export function configDir(): string {
  return dirname(configPath());
}

const LEGACY_USER_CONFIG = join(homedir(), ".nanobot", "config.json");

async function tryMigrateLegacyToProject(projectPath: string): Promise<string | null> {
  try {
    const raw = await readFile(LEGACY_USER_CONFIG, "utf8");
    await mkdir(dirname(projectPath), { recursive: true });
    await writeFile(projectPath, raw, "utf8");
    await unlink(LEGACY_USER_CONFIG);
    try {
      const legacyDir = dirname(LEGACY_USER_CONFIG);
      const left = await readdir(legacyDir);
      if (left.length === 0) await rmdir(legacyDir);
    } catch {
      // ignore
    }
    console.error(`[nanobot] Migrated config from ${LEGACY_USER_CONFIG} to ${projectPath}`);
    return raw;
  } catch {
    return null;
  }
}

export function defaultConfig(): NanobotConfig {
  return {
    providers: {
      openrouter: {
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "",
      },
      openai: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
      },
      /**
       * Kimi（月之暗面）OpenAI 兼容接口。
       * 国内账号：https://platform.moonshot.cn → baseUrl 用 https://api.moonshot.cn/v1
       * 国际：https://platform.moonshot.ai → https://api.moonshot.ai/v1
       */
      moonshot: {
        baseUrl: "https://api.moonshot.cn/v1",
        apiKey: "",
      },
    },
    agents: {
      defaults: {
        model: DEFAULT_MODEL,
        provider: DEFAULT_PROVIDER,
      },
      memory: {
        enabled: true,
        maxPersistedMessages: 40,
      },
    },
    tools: {
      allowShell: false,
      allowWrite: true,
      workspaceRoot: process.cwd(),
    },
    channels: {
      weixin: {
        /** 实际以仓库根 `nanobot.config.json` 为准；此处 false 为安全默认 */
        enabled: false,
        allow_from: [],
        base_url: "https://ilinkai.weixin.qq.com",
        cdn_base_url: "https://novac2c.cdn.weixin.qq.com/c2c",
        route_tag: null,
        token: "",
        state_dir: "",
        poll_timeout: 35,
      },
    },
  };
}

function mergeDeep<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const out = { ...base } as T;
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const pv = patch[key];
    if (pv === undefined) continue;
    const bv = base[key];
    if (
      pv &&
      typeof pv === "object" &&
      !Array.isArray(pv) &&
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      (out as Record<string, unknown>)[key as string] = mergeDeep(
        bv as Record<string, unknown>,
        pv as Record<string, unknown>,
      );
    } else {
      (out as Record<string, unknown>)[key as string] = pv as unknown;
    }
  }
  return out;
}

/** 深度合并：磁盘上的配置覆盖 defaultConfig() */
export function normalizeConfig(parsed: Partial<NanobotConfig>): NanobotConfig {
  const defaults = defaultConfig();
  const merged = mergeDeep(defaults as unknown as Record<string, unknown>, parsed as Record<string, unknown>) as unknown as NanobotConfig;
  if (!merged.providers || !merged.agents?.defaults?.model || !merged.agents.defaults.provider) {
    throw new Error("Invalid config: missing providers or agents.defaults.model/provider");
  }
  return merged;
}

export async function loadConfig(): Promise<NanobotConfig> {
  const path = configPath();
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      const migrated = await tryMigrateLegacyToProject(path);
      if (migrated === null) {
        throw new Error(`Config not found at ${path}. Run: nanobot onboard`);
      }
      raw = migrated;
    } else {
      throw e;
    }
  }
  const parsed = JSON.parse(raw) as Partial<NanobotConfig>;
  return normalizeConfig(parsed);
}

export async function saveConfig(config: NanobotConfig): Promise<void> {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2) + "\n", "utf8");
}

export async function mergeAndSave(patch: Partial<NanobotConfig>): Promise<NanobotConfig> {
  let base: NanobotConfig;
  try {
    base = await loadConfig();
  } catch {
    base = defaultConfig();
  }
  const dTools = defaultConfig().tools!;
  const dAgents = defaultConfig().agents!;
  const merged: NanobotConfig = {
    providers: { ...base.providers },
    agents: {
      defaults: { ...base.agents.defaults },
      memory: { ...dAgents.memory, ...(base.agents.memory ?? {}) },
    },
    tools: {
      allowShell: base.tools?.allowShell ?? dTools.allowShell,
      allowWrite: base.tools?.allowWrite ?? dTools.allowWrite,
      workspaceRoot: base.tools?.workspaceRoot ?? dTools.workspaceRoot,
    },
    channels: base.channels
      ? {
        weixin: { ...defaultConfig().channels!.weixin, ...base.channels.weixin },
      }
      : defaultConfig().channels,
  };
  if (patch.providers) {
    for (const [name, pc] of Object.entries(patch.providers)) {
      merged.providers[name] = { ...merged.providers[name], ...pc };
    }
  }
  if (patch.agents?.defaults) {
    merged.agents.defaults = { ...merged.agents.defaults, ...patch.agents.defaults };
  }
  if (patch.agents?.memory) {
    merged.agents.memory = { ...merged.agents.memory, ...patch.agents.memory };
  }
  if (patch.tools) {
    merged.tools = {
      allowShell: patch.tools.allowShell ?? merged.tools.allowShell,
      allowWrite: patch.tools.allowWrite ?? merged.tools.allowWrite,
      workspaceRoot: patch.tools.workspaceRoot ?? merged.tools.workspaceRoot,
    };
  }
  if (patch.channels?.weixin) {
    merged.channels = merged.channels ?? {};
    merged.channels.weixin = { ...merged.channels.weixin, ...patch.channels.weixin };
  }
  await saveConfig(merged);
  return merged;
}
