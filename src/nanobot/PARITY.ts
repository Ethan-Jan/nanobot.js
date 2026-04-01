/**
 * 与 HKUDS/nanobot（Python）的功能对照表。
 *
 * 上游仓库：https://github.com/HKUDS/nanobot
 * Python 包布局：`nanobot/agent`、`nanobot/bus`、`nanobot/channels`、`nanobot/cli`、
 * `nanobot/cron`、`nanobot/heartbeat`、`nanobot/providers`、`nanobot/security`、
 * `nanobot/session`、`nanobot/skills`、`nanobot/templates` 等。
 *
 * 本 TypeScript 移植采用「同名目录 + 注释说明 + 分阶段实现」：
 * - **full**：行为与上游接近，可在本仓库直接使用
 * - **partial**：子集或简化语义
 * - **stub**：仅占位/打印说明，尚未接入真实逻辑（欢迎按 PARITY 表逐项补全）
 */

/** 单条能力在 TS 侧的完成度 */
export type ParityLevel = "full" | "partial" | "stub";

export interface ParityEntry {
  /** Python 侧典型路径或概念名 */
  upstream: string;
  /** 本仓库对应模块（相对 src） */
  tsModule: string;
  level: ParityLevel;
  /** 与上游差异或后续工作说明 */
  notes: string;
}

/**
 * 能力矩阵（非穷举上游所有文件，覆盖主要子系统）。
 * CLI 细节参考上游 `nanobot/cli/commands.py`（Typer）及官方文档。
 */
export const PARITY_MATRIX: readonly ParityEntry[] = [
  {
    upstream: "cli/commands.py — onboard",
    tsModule: "nanobot/cli/cmdOnboard.ts + config.ts",
    level: "partial",
    notes: "已写默认 nanobot.config.json；上游另有 workspace 模板同步（SOUL/AGENTS/MEMORY 等），见 templates/workspaceSync.ts stub",
  },
  {
    upstream: "cli/commands.py — agent (-m / REPL)",
    tsModule: "agent.ts + nanobot/cli/cmdAgent.ts",
    level: "partial",
    notes: "支持交互与 -m 单条；上游用 prompt_toolkit、会话键 channel:chat_id、Markdown 渲染等，此处为简化 readline",
  },
  {
    upstream: "cli/commands.py — gateway",
    tsModule: "nanobot/gateway/runtime.ts",
    level: "stub",
    notes: "上游拉起 MessageBus + 全通道 + AgentLoop + Cron + Heartbeat；此处仅占位说明启动顺序",
  },
  {
    upstream: "cli/commands.py — status",
    tsModule: "nanobot/cli/cmdStatus.ts",
    level: "partial",
    notes: "打印配置路径与 provider 是否具备密钥（含环境变量），非上游完整 PROVIDERS 注册表扫描",
  },
  {
    upstream: "cli/commands.py — channels weixin (weixin.py)",
    tsModule: "nanobot/channels/weixin/* + cli/cmdWeixin.ts",
    level: "partial",
    notes: "iLink 扫码登录 + 长轮询 + 文本收发 + Agent；图片/语音 CDN AES 等未移植",
  },
  {
    upstream: "cli/commands.py — channels *（非 weixin）",
    tsModule: "nanobot/channels/registry.ts + cli/cmdChannels.ts",
    level: "stub",
    notes: "Telegram/Slack/飞书/Matrix 等需各 SDK + 长连接",
  },
  {
    upstream: "cli/commands.py — cron *",
    tsModule: "nanobot/cron/service.ts + cli/cmdCron.ts",
    level: "stub",
    notes: "上游 croniter + jobs.json + 投递到通道；此处可后续接 node-cron + 同一 Agent 入口",
  },
  {
    upstream: "cron/* + heartbeat/*",
    tsModule: "nanobot/heartbeat/service.ts",
    level: "stub",
    notes: "上游周期性唤醒 Agent；需与 session/memory 联动",
  },
  {
    upstream: "bus/*",
    tsModule: "nanobot/bus/messageBus.ts",
    level: "stub",
    notes: "上游事件总线协调多通道与 Agent；TS 可 EventEmitter 或 Redis 视部署而定",
  },
  {
    upstream: "agent/loop.py + tools/*",
    tsModule: "agent.ts + tools/*",
    level: "partial",
    notes: "已实现 OpenAI 兼容 tools 子集；上游另有 web、mcp、cron、message、spawn 等工具",
  },
  {
    upstream: "agent/mcp.py + mcp SDK",
    tsModule: "(未建独立文件)",
    level: "stub",
    notes: "需 @modelcontextprotocol/sdk 或自研 JSON-RPC 与 stdio/sse 传输",
  },
  {
    upstream: "agent/memory.py",
    tsModule: "nanobot/memory/memoryStore.ts",
    level: "partial",
    notes: "MEMORY.md 分块 + 按 session 的 JSON  transcript 持久化并注入 system；无向量压缩/摘要",
  },
  {
    upstream: "agent/skills.py",
    tsModule: "nanobot/skills/skillsLoader.ts",
    level: "stub",
    notes: "上游从 skills 目录加载 SKILL.md；可把技能说明注入 system 或 tool 列表",
  },
  {
    upstream: "agent/subagent.py",
    tsModule: "nanobot/agent/subagentRunner.ts",
    level: "stub",
    notes: "子代理需独立消息预算与工具白名单",
  },
  {
    upstream: "command/router.py + builtin.py",
    tsModule: "nanobot/command/slashRouter.ts",
    level: "partial",
    notes: "REPL 内 /status、/new 等；/restart 在单进程 CLI 中与上游多进程语义不同",
  },
  {
    upstream: "security/*",
    tsModule: "nanobot/security/sandbox.ts",
    level: "stub",
    notes: "上游沙箱与策略；此处仅工具路径限制 + allowShell 开关",
  },
  {
    upstream: "session/*",
    tsModule: "nanobot/session/sessionStore.ts",
    level: "stub",
    notes: "上游多会话与 channel:id；当前 CLI 单会话内存",
  },
  {
    upstream: "providers/* (Anthropic, OAuth, …)",
    tsModule: "providers/openai-compat.ts",
    level: "partial",
    notes: "当前统一 OpenAI 兼容客户端；Anthropic Messages API 需另分支",
  },
  {
    upstream: "cli/commands.py — provider login",
    tsModule: "nanobot/cli/cmdProvider.ts",
    level: "stub",
    notes: "OAuth 设备码流程（Codex/Copilot 等）可接 oauth-cli-kit 思路的 TS 实现",
  },
];

export function printParitySummary(): void {
  console.log("HKUDS/nanobot → TS 对照（详见 src/nanobot/PARITY.ts PARITY_MATRIX）\n");
  for (const row of PARITY_MATRIX) {
    console.log(`[${row.level.toUpperCase().padEnd(8)}] ${row.upstream}`);
    console.log(`         → ${row.tsModule}`);
    console.log(`           ${row.notes}\n`);
  }
}
