/**
 * 持久化 `account.json`：token、get_updates 游标、各用户的 context_token（回复必填）。
 * 路径对齐上游 `WeixinChannel._save_state`。
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WeixinChannelConfig } from "../../../config.js";
import { repoRoot } from "../../../config.js";

export interface WeixinAccountState {
  token: string;
  get_updates_buf: string;
  context_tokens: Record<string, string>;
  base_url?: string;
}

export function defaultStateDir(cfg: WeixinChannelConfig): string {
  const custom = cfg.state_dir?.trim();
  if (custom) return custom;
  return join(repoRoot(), ".nanobot-runtime", "weixin");
}

export function accountJsonPath(stateDir: string): string {
  return join(stateDir, "account.json");
}

export async function loadAccountState(stateDir: string): Promise<WeixinAccountState | null> {
  try {
    const raw = await readFile(accountJsonPath(stateDir), "utf8");
    const data = JSON.parse(raw) as WeixinAccountState;
    if (!data.token) return null;
    return {
      token: data.token,
      get_updates_buf: data.get_updates_buf ?? "",
      context_tokens: typeof data.context_tokens === "object" && data.context_tokens ? data.context_tokens : {},
      base_url: data.base_url,
    };
  } catch {
    return null;
  }
}

export async function saveAccountState(stateDir: string, state: WeixinAccountState): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  await writeFile(accountJsonPath(stateDir), JSON.stringify(state, null, 2) + "\n", "utf8");
}
