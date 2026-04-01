import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type OpenAI from "openai";
import { createClient, effectiveChatModel } from "./providers/openai-compat.js";
import { explainChatApiError } from "./providers/apiErrors.js";
import type { NanobotConfig, ToolPolicy } from "./config.js";
import { configPath } from "./config.js";
import { toolDefinitions } from "./tools/definitions.js";
import { runTool } from "./tools/run.js";
import { handleSlashLine } from "./nanobot/command/slashRouter.js";
import { WeixinIlinkBridge } from "./nanobot/channels/weixin/weixinIlinkBridge.js";
import {
  appendSessionTranscript,
  buildFullSystemPrompt,
  clearSessionMemory,
  isMemoryEnabled,
  memoryPersistLimit,
} from "./nanobot/memory/memoryStore.js";

const MAX_MODEL_ROUNDS = 48;

function lastAssistantPlainText(messages: OpenAI.Chat.ChatCompletionMessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const c = m.content;
    if (typeof c === "string" && c.trim()) return c;
  }
  return "";
}

export interface AgentRunOptions {
  /** Override config workspace root（上游 global --workspace 由 NANOBOT_WORKSPACE / 此字段传入） */
  workspaceRoot?: string;
  allowShell?: boolean;
  /**
   * 上游：`nanobot agent -s cli:direct`
   * 当前：仅用于 /status 展示与后续多会话扩展
   */
  sessionKey?: string;
}

function resolveWorkspace(cfg: NanobotConfig, opts?: AgentRunOptions): string {
  const fromEnv = process.env.NANOBOT_WORKSPACE?.trim();
  if (fromEnv) return fromEnv;
  return opts?.workspaceRoot ?? cfg.tools.workspaceRoot ?? process.cwd();
}

/**
 * 执行一轮「模型 + 工具」循环，直到模型不再调用工具或达到轮数上限。
 * 与上游 AgentLoop 的核心相似，但无 memory / channel / hook 等外围逻辑。
 */
async function runModelToolRounds(
  client: OpenAI,
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  tools: OpenAI.Chat.ChatCompletionTool[],
  policy: ToolPolicy,
  onAssistantText: (text: string) => void,
  diag: { providerName: string; baseURL: string },
): Promise<void> {
  let turnComplete = false;
  for (let round = 0; round < MAX_MODEL_ROUNDS; round++) {
    let completion: OpenAI.Chat.ChatCompletion;
    try {
      /** Kimi 部分模型（如 kimi-k2.5）仅允许 temperature=1，否则 400 */
      const temperature = diag.providerName === "moonshot" ? 1 : 0.2;
      completion = await client.chat.completions.create({
        model,
        messages,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? "auto" : undefined,
        temperature,
      });
    } catch (e) {
      onAssistantText(
        "\n" +
          explainChatApiError(e, {
            providerName: diag.providerName,
            model,
            baseURL: diag.baseURL,
          }) +
          "\n",
      );
      turnComplete = true;
      break;
    }

    const choice = completion.choices[0];
    if (!choice?.message) {
      messages.push({ role: "assistant", content: "(no response)" });
      turnComplete = true;
      break;
    }

    const msg = choice.message;
    messages.push(msg);

    const calls = msg.tool_calls;
    if (!calls?.length) {
      const text = typeof msg.content === "string" ? msg.content : "";
      if (text) onAssistantText(text);
      turnComplete = true;
      break;
    }

    for (const call of calls) {
      if (call.type !== "function") continue;
      const fn = call.function;
      let args: unknown = {};
      try {
        args = fn.arguments ? JSON.parse(fn.arguments) : {};
      } catch {
        args = {};
      }
      const result = await runTool(fn.name, args, policy);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
  }
  if (!turnComplete) {
    onAssistantText("\n[Stopped: reached max model/tool rounds for this message.]\n");
  }
}

/**
 * 单条消息模式，对应上游 `nanobot agent -m "..."`：无历史、无 REPL。
 */
export async function runAgentMessage(
  cfg: NanobotConfig,
  userMessage: string,
  opts?: AgentRunOptions,
): Promise<string> {
  const { client, providerName, baseURL } = createClient(cfg);
  const model = effectiveChatModel(cfg, providerName);
  const policy: ToolPolicy = {
    allowShell: opts?.allowShell ?? cfg.tools.allowShell,
    allowWrite: cfg.tools.allowWrite !== false,
    workspaceRoot: resolveWorkspace(cfg, opts),
  };
  const tools = toolDefinitions(policy.allowShell ?? false, policy.allowWrite !== false);
  const sessionKey = opts?.sessionKey ?? "cli:direct";
  const systemContent = await buildFullSystemPrompt(cfg, policy.workspaceRoot ?? process.cwd(), sessionKey);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    { role: "user", content: userMessage },
  ];
  let out = "";
  await runModelToolRounds(
    client,
    model,
    messages,
    tools,
    policy,
    (t) => {
      out += t;
    },
    { providerName, baseURL },
  );
  const replyText = lastAssistantPlainText(messages);
  if (isMemoryEnabled(cfg) && replyText) {
    await appendSessionTranscript(sessionKey, userMessage, replyText, memoryPersistLimit(cfg));
  }
  return out.trim() || "(empty reply)";
}

export type AgentChatHistoryItem = { role: "user" | "assistant"; content: string };

/**
 * 多轮对话（无 REPL）：`prior` 为不含 system 的 user/assistant 消息；`userMessage` 为本轮用户输入。
 * 与 `runAgentMessage` 相同工具与记忆策略；`sessionKey` 默认 `admin:web` 可与 CLI 会话隔离。
 */
export async function runAgentWithHistory(
  cfg: NanobotConfig,
  prior: AgentChatHistoryItem[],
  userMessage: string,
  opts?: AgentRunOptions,
): Promise<string> {
  const { client, providerName, baseURL } = createClient(cfg);
  const model = effectiveChatModel(cfg, providerName);
  const policy: ToolPolicy = {
    allowShell: opts?.allowShell ?? cfg.tools.allowShell,
    allowWrite: cfg.tools.allowWrite !== false,
    workspaceRoot: resolveWorkspace(cfg, opts),
  };
  const tools = toolDefinitions(policy.allowShell ?? false, policy.allowWrite !== false);
  const sessionKey = opts?.sessionKey ?? "admin:web";
  const systemContent = await buildFullSystemPrompt(cfg, policy.workspaceRoot ?? process.cwd(), sessionKey);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...prior.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];
  let out = "";
  await runModelToolRounds(
    client,
    model,
    messages,
    tools,
    policy,
    (t) => {
      out += t;
    },
    { providerName, baseURL },
  );
  const replyText = lastAssistantPlainText(messages);
  if (isMemoryEnabled(cfg) && replyText) {
    await appendSessionTranscript(sessionKey, userMessage, replyText, memoryPersistLimit(cfg));
  }
  return out.trim() || "(empty reply)";
}

export async function runAgentLoop(cfg: NanobotConfig, opts?: AgentRunOptions): Promise<void> {
  const { client, providerName, baseURL } = createClient(cfg);
  const model = effectiveChatModel(cfg, providerName);
  const policy: ToolPolicy = {
    allowShell: opts?.allowShell ?? cfg.tools.allowShell,
    allowWrite: cfg.tools.allowWrite !== false,
    workspaceRoot: resolveWorkspace(cfg, opts),
  };
  const tools = toolDefinitions(policy.allowShell ?? false, policy.allowWrite !== false);

  const sessionKey = opts?.sessionKey ?? "cli:direct";
  const workspace = policy.workspaceRoot ?? process.cwd();
  const systemContent = await buildFullSystemPrompt(cfg, workspace, sessionKey);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: systemContent }];

  let weixinBridge: WeixinIlinkBridge | undefined;
  const weixinParallel = cfg.channels?.weixin?.enabled === true;
  if (weixinParallel) {
    weixinBridge = new WeixinIlinkBridge(cfg);
    void weixinBridge
      .runLoop({ allowShell: opts?.allowShell === true, embedded: true })
      .catch((e) => {
        console.error(
          "[weixin] 并联启动失败：",
          e instanceof Error ? e.message : e,
          "\n可先执行：node dist/cli.js channels weixin login",
        );
      });
  }

  const rl = readline.createInterface({ input, output });
  output.write('nanobot — type "exit" or Ctrl+C or quit. Slash: /help /new /alias /memory /status\n');
  output.write(`Workspace: ${policy.workspaceRoot}\n`);

  const resetConversation = async (): Promise<void> => {
    if (isMemoryEnabled(cfg)) await clearSessionMemory(sessionKey);
    messages.length = 0;
    const next = await buildFullSystemPrompt(cfg, workspace, sessionKey);
    messages.push({ role: "system", content: next });
  };

  try {
    for (;;) {
      const user = (await rl.question("\n> ")).trim();
      if (!user) continue;

      const slash = await handleSlashLine(
        user,
        {
          configPath: configPath(),
          sessionKey,
          resetConversation,
          workspaceRoot: policy.workspaceRoot ?? process.cwd(),
          cfg,
        },
        (s) => output.write(s),
      );
      if (slash === "exit") break;
      if (slash === "consumed") continue;

      const freshSystem = await buildFullSystemPrompt(cfg, workspace, sessionKey);
      messages[0] = { role: "system", content: freshSystem };
      messages.push({ role: "user", content: user });

      await runModelToolRounds(client, model, messages, tools, policy, (t) => output.write(`\n${t}\n`), {
        providerName,
        baseURL,
      });

      const replyText = lastAssistantPlainText(messages);
      if (isMemoryEnabled(cfg) && replyText) {
        await appendSessionTranscript(sessionKey, user, replyText, memoryPersistLimit(cfg));
      }
    }
  } finally {
    weixinBridge?.stop();
    rl.close();
  }
}
