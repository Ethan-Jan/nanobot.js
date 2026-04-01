/**
 * 上游对应：`nanobot/command/router.py` + `nanobot/command/builtin.py`
 *
 * 上游在 AgentLoop 中拦截以 `/` 开头的输入，优先级高于普通用户消息。
 * 内置示例：`/stop`、`/restart`、`/status`、`/new` 等。
 *
 * 本 TS 在 CLI REPL 中做**简化版**语义：
 * - 与上游**不完全等价**（例如 `/restart` 在单进程 node 中无法复刻多进程网关重启）
 * - 注释中标明差异，便于日后对齐
 */

import type { NanobotConfig } from "../../config.js";
import { isMemoryEnabled, sessionMemoryFilePath, setSessionAgentDisplayName } from "../memory/memoryStore.js";
import { getCodeAnalysisReport, listAvailableSkills } from "../skills/skillsLoader.js";

export type SlashOutcome = "exit" | "continue" | "consumed";

export interface SlashContext {
  /** 用于 /status 展示 */
  configPath: string;
  /** 上游 session 键格式；当前 CLI 固定占位 */
  sessionKey: string;
  /** 清空对话并可选清空本会话持久化记忆（/new） */
  resetConversation: () => void | Promise<void>;
  /** 当前合并后的 workspace，用于简要展示 */
  workspaceRoot: string;
  cfg: NanobotConfig;
}

const EXIT_TOKENS = new Set(["exit", "quit", "/exit", "/quit", ":q"]);

/**
 * 若返回 `consumed`，调用方不应再把该行交给大模型。
 */
export async function handleSlashLine(
  line: string,
  ctx: SlashContext,
  write: (s: string) => void,
): Promise<SlashOutcome> {
  const t = line.trim();
  if (!t.startsWith("/")) {
    if (EXIT_TOKENS.has(t.toLowerCase())) return "exit";
    return "continue";
  }

  const [cmd, ...rest] = t.slice(1).split(/\s+/);
  const arg = rest.join(" ").trim();

  switch (cmd.toLowerCase()) {
    case "exit":
    case "quit":
      return "exit";

    /** 上游：取消当前工具/任务；此处仅占位 */
    case "stop":
      write("[nanobot] /stop：stub（未实现任务取消队列）。\n");
      return "consumed";

    /**
     * 上游：重启进程/网关。
     * 单进程 CLI 无法等价实现；提示用户手动重启终端。
     */
    case "restart":
      write("[nanobot] /restart：CLI stub — 请 Ctrl+C 后重新执行 `nanobot` 或 `npm start`。\n");
      return "consumed";

    /** 上游：展示运行时统计；此处打印静态诊断 */
    case "status":
      write(
        `[nanobot] /status\n  config: ${ctx.configPath}\n  session: ${ctx.sessionKey}\n  workspace: ${ctx.workspaceRoot}\n  provider: ${ctx.cfg.agents.defaults.provider}\n  model: ${ctx.cfg.agents.defaults.model}\n`,
      );
      return "consumed";

    /** 上游：新会话；此处清空消息数组并删除本会话 JSON 记忆 */
    case "new":
      await Promise.resolve(ctx.resetConversation());
      write(`[nanobot] /new：已清空对话并清除本会话持久化记忆（session=${ctx.sessionKey}）。\n`);
      if (arg) write(`（附言已忽略：${arg}）\n`);
      return "consumed";

    case "memory": {
      if (!isMemoryEnabled(ctx.cfg)) {
        write("[nanobot] /memory：当前 agents.memory.enabled=false，未启用持久化记忆。\n");
        return "consumed";
      }
      write(`[nanobot] /memory\n  文件：${sessionMemoryFilePath(ctx.sessionKey)}\n  工作区备忘：${ctx.workspaceRoot}/MEMORY.md\n`);
      return "consumed";
    }

    case "alias":
    case "nick":
    case "nickname": {
      if (!arg) {
        write("[nanobot] /alias <称呼> — 设置本会话助手昵称（写入会话 JSON，优先于默认名、低于配置 agents.displayName）。\n");
        return "consumed";
      }
      try {
        await setSessionAgentDisplayName(ctx.sessionKey, arg);
        write(`[nanobot] 已设置称呼为「${arg.trim()}」；下一条对话起生效（REPL 下一行输入前会刷新 system）。\n`);
      } catch (e) {
        write(`[nanobot] /alias 失败：${e instanceof Error ? e.message : String(e)}\n`);
      }
      return "consumed";
    }

    /** 代码分析：生成项目概览报告 */
    case "analyze":
    case "stats": {
      try {
        write("[nanobot] 正在分析代码库...\n\n");
        const report = await getCodeAnalysisReport(ctx.workspaceRoot);
        write(report + "\n");
      } catch (e) {
        write(`[nanobot] 分析失败：${e instanceof Error ? e.message : String(e)}\n`);
      }
      return "consumed";
    }

    /** 列出可用的技能和工具 */
    case "skills": {
      try {
        const skills = await listAvailableSkills(ctx.workspaceRoot);
        write(`[nanobot] /skills\n\n${skills}\n`);
      } catch (e) {
        write(`[nanobot] 加载失败：${e instanceof Error ? e.message : String(e)}\n`);
      }
      return "consumed";
    }

    case "help":
      write(
        "[nanobot] /help：\n" +
        "  /new       - 清空对话和记忆\n" +
        "  /alias     - 设置本会话助手称呼（/alias 小智）\n" +
        "  /memory    - 显示记忆文件路径\n" +
        "  /status    - 显示配置状态\n" +
        "  /analyze   - 分析代码库结构\n" +
        "  /skills    - 列出可用技能\n" +
        "  /stop      - 取消当前任务\n" +
        "  /restart   - 重启（手动）\n" +
        "  /exit      - 退出\n" +
        "\n普通消息直接对话，可使用 git_*、file_stats 等工具。\n"
      );
      return "consumed";

    default:
      write(`[nanobot] 未知命令 /${cmd}；输入 /help\n`);
      return "consumed";
  }
}
