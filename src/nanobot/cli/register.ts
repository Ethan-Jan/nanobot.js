/**
 * 集中注册与 HKUDS/nanobot（Python）Typer CLI 对齐的子命令。
 * 上游单文件：`nanobot/cli/commands.py`；此处按功能拆分为 `cmd*.ts` 便于维护。
 */

import type { Command } from "commander";
import { loadConfig } from "../../config.js";
import { runOnboardCommand, runOnboardRefresh } from "./cmdOnboard.js";
import { runAgentCommand } from "./cmdAgent.js";
import { formatStatus } from "./cmdStatus.js";
import { runGatewayCommand } from "./cmdGateway.js";
import { runChannelsLogin, runChannelsStatus } from "./cmdChannels.js";
import { runWeixinLogin, runWeixinStart } from "./cmdWeixin.js";
import { runCronAdd, runCronList } from "./cmdCron.js";
import { runProviderLogin } from "./cmdProvider.js";
import { runParityCommand } from "./cmdParity.js";

export function registerNanobotCli(program: Command): void {
  program
    .option("-c, --config <path>", "Path to nanobot.config.json（写入 NANOBOT_CONFIG）")
    .option("-w, --workspace <path>", "Override workspace（写入 NANOBOT_WORKSPACE）");

  program.hook("preAction", () => {
    const o = program.opts() as { config?: string; workspace?: string };
    if (o.config) process.env.NANOBOT_CONFIG = o.config;
    if (o.workspace) process.env.NANOBOT_WORKSPACE = o.workspace;
  });

  program
    .command("parity")
    .description("Print HKUDS/nanobot vs this TS port capability matrix（扩展命令）")
    .action(() => {
      runParityCommand();
    });

  program
    .command("onboard")
    .description("Create / refresh nanobot.config.json（对齐上游 onboard）")
    .option("--wizard", "Interactive prompts")
    .option("--provider <name>", "Provider id for wizard", "moonshot")
    .option("--sync-templates", "Write stub AGENTS.md / MEMORY.md / HEARTBEAT.md into workspace")
    .option("--refresh-only", "Load config if exists and save again（简化版 refresh）")
    .action(async (opts: { wizard?: boolean; provider: string; syncTemplates?: boolean; refreshOnly?: boolean }) => {
      if (opts.refreshOnly) {
        await runOnboardRefresh();
        return;
      }
      await runOnboardCommand({
        wizard: opts.wizard,
        provider: opts.provider,
        syncTemplates: opts.syncTemplates === true,
      });
    });

  program
    .command("agent", { isDefault: true })
    .description("Terminal agent: interactive REPL or single message（对齐上游 agent）")
    .option("-m, --message <text>", "Single message then exit（对齐上游 -m）")
    .option("-s, --session <key>", 'Session key e.g. cli:direct（对齐上游 -s，当前仅展示）', "cli:direct")
    .option("-w, --workspace <dir>", "Workspace for tools")
    .option("--allow-shell", "Enable run_shell tool")
    .action(async (opts: { message?: string; session?: string; workspace?: string; allowShell?: boolean }) => {
      if (opts.workspace) process.env.NANOBOT_WORKSPACE = opts.workspace;
      await runAgentCommand({
        message: opts.message,
        session: opts.session,
        workspace: opts.workspace,
        allowShell: opts.allowShell,
      });
    });

  program
    .command("gateway")
    .description("Start full runtime（上游 gateway；此处为 stub 演示启动顺序）")
    .option("-p, --port <n>", "HTTP port（stub 仅打印）", "18790")
    .option("--verbose", "Verbose（预留）")
    .action(async (opts: { port?: string; verbose?: boolean }) => {
      await runGatewayCommand({ port: opts.port, verbose: opts.verbose });
    });

  program
    .command("status")
    .description("Show config path and provider readiness（对齐上游 status）")
    .action(async () => {
      const cfg = await loadConfig();
      console.log(formatStatus(cfg));
    });

  const channels = program.command("channels").description("Channel adapters（上游 channels 子应用）");

  channels
    .command("status")
    .description("Show channel stub status")
    .action(() => {
      runChannelsStatus();
    });

  channels
    .command("login")
    .description("Channel OAuth / QR（上游 login；此处 stub）")
    .action(() => {
      runChannelsLogin();
    });

  const weixin = channels
    .command("weixin")
    .description("个人微信 iLink 通道（对齐 upstream weixin.py：ilinkai.weixin.qq.com）");

  weixin
    .command("login")
    .description("扫码登录，token 写入 .nanobot-runtime/weixin/account.json")
    .option("--force", "清除旧状态重新扫码")
    .action(async (opts: { force?: boolean }) => {
      await runWeixinLogin({ force: opts.force });
    });

  weixin
    .command("start")
    .description("长轮询收消息，文本 → Agent → 回复（Ctrl+C 退出）")
    .option("--allow-shell", "允许 Agent 使用 run_shell 工具")
    .action(async (opts: { allowShell?: boolean }) => {
      await runWeixinStart({ allowShell: opts.allowShell });
    });

  const cron = program.command("cron").description("Scheduled jobs（上游 cron；持久化为 stub JSON）");

  cron
    .command("list")
    .description("List jobs from nanobot.cron.jobs.json if present")
    .action(async () => {
      await runCronList();
    });

  cron
    .command("add")
    .description("Add job（stub：不写入文件）")
    .option("-n, --name <name>", "Job name")
    .option("-m, --message <text>", "Message to agent")
    .option("-c, --cron <expr>", "Cron expression")
    .option("-e, --every <seconds>", "Interval seconds")
    .action((opts: { name?: string; message?: string; cron?: string; every?: string }) => {
      runCronAdd(opts);
    });

  const provider = program.command("provider").description("Provider auth（上游 provider 子应用）");

  provider
    .command("login")
    .argument("<name>", "Provider id e.g. openai-codex")
    .description("OAuth device login（stub）")
    .action((name: string) => {
      runProviderLogin(name);
    });
}
