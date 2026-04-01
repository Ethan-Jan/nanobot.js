/**
 * 上游对应：`nanobot/templates/**` + onboard 时的 `sync_workspace_templates`
 *
 * 上游会在 workspace 下生成 AGENTS.md、MEMORY.md、HEARTBEAT.md、SOUL.md 等，
 * 供 Agent 自我描述与长期记忆引导。
 *
 * 当前：不写入文件，避免在未确认工作区时污染用户目录。
 * 调用方可传入 `dryRun: true` 仅打印将创建的路径。
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_FILES: Record<string, string> = {
  "AGENTS.md": "# Agents\n\n（stub）描述各子代理角色。\n",
  "MEMORY.md": "# Memory\n\n（stub）长期记忆由 memoryStore 后续写入。\n",
  "HEARTBEAT.md": "# Heartbeat\n\n（stub）心跳任务说明。\n",
};

export async function syncWorkspaceTemplates(workspaceRoot: string, dryRun: boolean): Promise<string[]> {
  const created: string[] = [];
  for (const [name, body] of Object.entries(DEFAULT_FILES)) {
    const path = join(workspaceRoot, name);
    if (dryRun) {
      created.push(`[dry-run] would write ${path}`);
      continue;
    }
    await mkdir(workspaceRoot, { recursive: true });
    await writeFile(path, body, "utf8");
    created.push(path);
  }
  return created;
}
