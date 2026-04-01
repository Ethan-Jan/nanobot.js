/**
 * 对应上游：`nanobot onboard` + `nanobot/cli/onboard.py` 中的向导与模板同步。
 * 当前：写默认配置 + 可选向导；`--sync-templates` 调用 workspace 模板 stub。
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  configPath,
  defaultConfig,
  loadConfig,
  mergeAndSave,
  saveConfig,
} from "../../config.js";
import { syncWorkspaceTemplates } from "../templates/workspaceSync.js";

export async function runOnboardCommand(opts: {
  wizard?: boolean;
  provider: string;
  syncTemplates?: boolean;
}): Promise<void> {
  const base = defaultConfig();
  await saveConfig(base);
  const p = opts.provider;

  const ws = base.tools.workspaceRoot ?? process.cwd();

  if (opts.syncTemplates) {
    const paths = await syncWorkspaceTemplates(ws, false);
    output.write(`Synced templates under ${ws}:\n${paths.map((x) => `  ${x}`).join("\n")}\n`);
  }

  if (!opts.wizard) {
    output.write(
      `Wrote ${configPath()}. Set providers / agents.defaults; use .env for keys. Then: nanobot agent\n`,
    );
    return;
  }

  const rl = createInterface({ input, output });
  try {
    const key = (await rl.question(`API key for provider "${p}" (paste, Enter to skip): `)).trim();
    const model = (await rl.question(`Model id [${base.agents.defaults.model}]: `)).trim();
    await mergeAndSave({
      providers: { [p]: { apiKey: key || undefined } },
      agents: { defaults: { model: model || base.agents.defaults.model, provider: p } },
    });
    output.write(`Saved ${configPath()}\n`);
  } finally {
    rl.close();
  }
}

/** 上游：已存在配置时 refresh / overwrite；此处尝试 merge 读入后再保存默认缺项 */
export async function runOnboardRefresh(): Promise<void> {
  try {
    const cur = await loadConfig();
    await saveConfig(cur);
    process.stdout.write(`Refreshed ${configPath()} (no deep migration).\n`);
  } catch {
    await saveConfig(defaultConfig());
    process.stdout.write(`Created default ${configPath()}\n`);
  }
}
