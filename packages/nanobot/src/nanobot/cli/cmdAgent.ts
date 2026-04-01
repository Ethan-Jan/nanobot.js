/**
 * 对应上游：`nanobot agent`（交互 / `-m` 单条 / `-s` session）
 */

import { loadConfig } from "../../config.js";
import { runAgentLoop, runAgentMessage } from "../../agent.js";

export async function runAgentCommand(opts: {
  workspace?: string;
  allowShell?: boolean;
  message?: string;
  session?: string;
}): Promise<void> {
  const cfg = await loadConfig();
  if (opts.message) {
    const text = await runAgentMessage(cfg, opts.message, {
      workspaceRoot: opts.workspace,
      allowShell: opts.allowShell === true ? true : undefined,
      sessionKey: opts.session ?? "cli:direct",
    });
    console.log(text);
    return;
  }
  await runAgentLoop(cfg, {
    workspaceRoot: opts.workspace,
    allowShell: opts.allowShell === true ? true : undefined,
    sessionKey: opts.session ?? "cli:direct",
  });
}
