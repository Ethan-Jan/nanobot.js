import OpenAI from "openai";
import type { NanobotConfig } from "../config.js";
import type { ProviderConfig } from "../config.js";
import { configPath } from "../config.js";

const ENV_KEYS: Record<string, string[]> = {
  openrouter: ["OPENROUTER_API_KEY", "NANOBOT_OPENROUTER_API_KEY"],
  openai: ["OPENAI_API_KEY", "NANOBOT_OPENAI_API_KEY"],
  moonshot: ["MOONSHOT_API_KEY", "KIMI_API_KEY", "NANOBOT_MOONSHOT_API_KEY"],
  /** 智谱 GLM OpenAI 兼容：https://docs.bigmodel.cn/cn/guide/develop/openai/introduction */
  bigmodel: ["BIGMODEL_API_KEY", "ZHIPU_API_KEY", "NANOBOT_BIGMODEL_API_KEY"],
  /** 与 bigmodel 同端点；额外支持 ZHIPUAI_* 命名 */
  zhipuai: [
    "ZHIPUAI_API_KEY",
    "ZHIPU_API_KEY",
    "BIGMODEL_API_KEY",
    "NANOBOT_ZHIPUAI_API_KEY",
    "NANOBOT_BIGMODEL_API_KEY",
  ],
};

function apiKeyFromEnv(providerId: string): string | undefined {
  for (const v of ENV_KEYS[providerId] ?? []) {
    const k = process.env[v]?.trim();
    if (k) return k;
  }
  return undefined;
}

function resolveCredentials(config: NanobotConfig): {
  name: string;
  provider: ProviderConfig;
  apiKey: string;
} {
  const envKey = process.env.NANOBOT_API_KEY?.trim();
  const envProviderId = process.env.NANOBOT_PROVIDER?.trim();
  if (envKey && envProviderId) {
    const p = config.providers[envProviderId];
    if (!p) {
      throw new Error(
        `NANOBOT_PROVIDER is "${envProviderId}" but that id is missing in providers.* in ${configPath()}`,
      );
    }
    return { name: envProviderId, provider: p, apiKey: envKey };
  }

  const name = config.agents.defaults.provider;
  const provider = config.providers[name];
  if (!provider) {
    throw new Error(`Unknown provider "${name}" in ${configPath()}. Add a providers.${name} block.`);
  }
  let apiKey = provider.apiKey?.trim() || apiKeyFromEnv(name);
  let resolvedName = name;
  let resolvedProvider = provider;

  if (!apiKey) {
    const path = configPath();
    const tryIds = ["moonshot", "zhipuai", "bigmodel", "openai", "openrouter"].filter((id) => id !== name);
    for (const id of tryIds) {
      const k = apiKeyFromEnv(id);
      const p = config.providers[id];
      if (k && p) {
        console.error(
          `[nanobot] Using provider "${id}" from environment (default "${name}" has no key). Set agents.defaults.provider to "${id}" in ${path} to match.`,
        );
        apiKey = k;
        resolvedName = id;
        resolvedProvider = p;
        break;
      }
    }
  }

  if (!apiKey) {
    const path = configPath();
    const envVars = [...(ENV_KEYS[name] ?? []), "NANOBOT_PROVIDER+NANOBOT_API_KEY (together)"];
    const hint =
      name === "openrouter"
        ? ` For Kimi: agents.defaults.provider "moonshot", model e.g. "kimi-k2.5", providers.moonshot.apiKey or MOONSHOT_API_KEY.`
        : "";
    throw new Error(
      `Missing API key for provider "${name}". Edit ${path} → providers.${name}.apiKey, or env: ${envVars.join(", ")}.${hint} Or: nanobot onboard --wizard`,
    );
  }
  return { name: resolvedName, provider: resolvedProvider, apiKey };
}

/** 实际请求 API 用的模型 id（Moonshot 不能用 OpenRouter 风格的 vendor/model） */
export function effectiveChatModel(config: NanobotConfig, providerName: string): string {
  const m = config.agents.defaults.model.trim();
  if (providerName === "moonshot" && m.includes("/")) {
    console.error(
      `[nanobot] Model "${m}" is not a Kimi id; using "kimi-k2.5" for this run. Set agents.defaults.model in ${configPath()}.`,
    );
    return "kimi-k2.5";
  }
  if ((providerName === "bigmodel" || providerName === "zhipuai") && m.includes("/")) {
    console.error(
      `[nanobot] Model "${m}" looks like an OpenRouter-style id; using "glm-4-flash" for Zhipu. Set agents.defaults.model in ${configPath()}.`,
    );
    return "glm-4-flash";
  }
  return m;
}

export function createClient(config: NanobotConfig): {
  client: OpenAI;
  providerName: string;
  baseURL: string;
} {
  const { name, provider, apiKey } = resolveCredentials(config);
  const baseURL = provider.baseUrl ?? "https://api.openai.com/v1";
  const client = new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders:
      name === "openrouter"
        ? {
          "HTTP-Referer": "https://github.com/local/nanobot-ts",
          "X-Title": "nanobot-ts",
        }
        : undefined,
  });
  return { client, providerName: name, baseURL };
}
