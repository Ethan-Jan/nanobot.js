/**
 * 对应上游：`nanobot status`（见 `nanobot/cli/commands.py`）
 * 上游会遍历 PROVIDERS 注册表检查 api_key / base / OAuth。
 * 此处：打印配置文件路径、各 provider 是否在 json 或环境变量中有密钥。
 */

import type { NanobotConfig } from "../../config.js";
import { configPath } from "../../config.js";

/** 与 openai-compat 中列表对齐，避免循环依赖可手写一份 env 名 */
const ENV_FOR: Record<string, string[]> = {
  openrouter: ["OPENROUTER_API_KEY", "NANOBOT_OPENROUTER_API_KEY"],
  openai: ["OPENAI_API_KEY", "NANOBOT_OPENAI_API_KEY"],
  moonshot: ["MOONSHOT_API_KEY", "KIMI_API_KEY", "NANOBOT_MOONSHOT_API_KEY"],
};

function hasEnvKey(providerId: string): boolean {
  for (const v of ENV_FOR[providerId] ?? []) {
    if (process.env[v]?.trim()) return true;
  }
  return false;
}

export function formatStatus(cfg: NanobotConfig): string {
  const path = configPath();
  const lines: string[] = [
    `config file: ${path}`,
    `default provider: ${cfg.agents.defaults.provider}`,
    `default model: ${cfg.agents.defaults.model}`,
    "",
    "providers:",
  ];
  for (const [id, p] of Object.entries(cfg.providers)) {
    const fileKey = Boolean(p.apiKey?.trim());
    const envKey = hasEnvKey(id);
    const ready = fileKey || envKey;
    lines.push(`  ${id}: ${ready ? "ready (key in file and/or env)" : "missing key"}  baseUrl=${p.baseUrl ?? "(default)"}`);
  }
  lines.push("", "NANOBOT_API_KEY + NANOBOT_PROVIDER 组合可覆盖默认 provider（见 openai-compat.ts）。");
  return lines.join("\n");
}
