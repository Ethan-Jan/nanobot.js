import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type OpenAI from "openai";
import { McpPool } from "./nanobot/mcp/pool.js";
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
  /**
   * 若设置，则对模型补全使用流式 API，并按 token/片段多次回调（用于管理端 SSE）。
   * 与 runAgentWithHistory 内部累积 `out` 的回调并行触发。
   */
  onStreamDelta?: (text: string) => void;
}

function resolveWorkspace(cfg: NanobotConfig, opts?: AgentRunOptions): string {
  const fromEnv = process.env.NANOBOT_WORKSPACE?.trim();
  if (fromEnv) return fromEnv;
  return opts?.workspaceRoot ?? cfg.tools.workspaceRoot ?? process.cwd();
}

/** 连接配置的 MCP stdio servers，合并工具列表；务必在 finally 中调用 closeMcp */
async function prepareAgentTools(
  cfg: NanobotConfig,
  opts?: AgentRunOptions,
): Promise<{
  tools: OpenAI.Chat.ChatCompletionTool[];
  policy: ToolPolicy;
  closeMcp: () => Promise<void>;
}> {
  const pool = await McpPool.connect(cfg);
  const mcpTools = pool?.getOpenAiTools() ?? [];
  const policy: ToolPolicy = {
    allowShell: opts?.allowShell ?? cfg.tools.allowShell,
    allowWrite: cfg.tools.allowWrite !== false,
    workspaceRoot: resolveWorkspace(cfg, opts),
    mcpDispatch: pool ? (name, args) => pool.dispatch(name, args) : undefined,
  };
  const tools = toolDefinitions(policy.allowShell ?? false, policy.allowWrite !== false, mcpTools);
  return {
    tools,
    policy,
    closeMcp: async () => {
      await pool?.close();
    },
  };
}

type ToolCallAcc = { id: string; name: string; arguments: string };

function mergeStreamToolCalls(
  acc: Map<number, { id: string; name: string; arguments: string }>,
  delta: { tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> },
): void {
  if (!delta.tool_calls?.length) return;
  for (const tc of delta.tool_calls) {
    const i = tc.index;
    if (!acc.has(i)) {
      acc.set(i, { id: "", name: "", arguments: "" });
    }
    const t = acc.get(i)!;
    if (tc.id) t.id = tc.id;
    if (tc.function?.name) t.name = tc.function.name;
    if (tc.function?.arguments) t.arguments += tc.function.arguments;
  }
}

function accToToolCallArray(acc: Map<number, ToolCallAcc>): OpenAI.Chat.ChatCompletionMessageToolCall[] {
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, t]) => ({
      id: t.id,
      type: "function" as const,
      function: { name: t.name, arguments: t.arguments },
    }));
}

type AssistantWithReasoning = OpenAI.Chat.ChatCompletionAssistantMessageParam & {
  reasoning_content?: string;
};

/**
 * Kimi / Moonshot：开启 thinking 时，多轮 tools 的 assistant 须带回 reasoning_content；流式里需自行拼上。
 * 有增量则原样使用；无则回退为单空格，避免 400（与部分客户端 / Kimi 文档约定一致）。
 */
function pushAssistantWithToolCallsMoonshot(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  content: string | null,
  toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
  reasoningBuf: string,
): void {
  const msg: AssistantWithReasoning = {
    role: "assistant",
    content,
    tool_calls: toolCalls,
    reasoning_content: reasoningBuf.trim() ? reasoningBuf : " ",
  };
  messages.push(msg);
}

/**
 * 未设环境变量时**不传** `thinking`，由接口默认；设为 enabled/disabled 时显式覆盖。
 * `NANOBOT_MOONSHOT_THINKING`：`0|off|false|disabled` / `1|on|true|enabled` / 空=默认
 */
function moonshotRequestExtras(): Record<string, unknown> {
  const v = process.env.NANOBOT_MOONSHOT_THINKING?.trim().toLowerCase();
  if (v === "0" || v === "off" || v === "false" || v === "disabled") {
    return { thinking: { type: "disabled" as const } };
  }
  if (v === "1" || v === "on" || v === "true" || v === "enabled") {
    return { thinking: { type: "enabled" as const } };
  }
  return {};
}

/**
 * 执行一轮「模型 + 工具」循环，直到模型不再调用工具或达到轮数上限。
 * 与上游 AgentLoop 的核心相似，但无 memory / channel / hook 等外围逻辑。
 * @param useStream 为 true 时使用流式补全，并对可显示的文本分片多次调用 onAssistantText。
 */
async function runModelToolRounds(
  client: OpenAI,
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  tools: OpenAI.Chat.ChatCompletionTool[],
  policy: ToolPolicy,
  onAssistantText: (text: string) => void,
  diag: { providerName: string; baseURL: string },
  useStream: boolean,
): Promise<void> {
  let turnComplete = false;
  for (let round = 0; round < MAX_MODEL_ROUNDS; round++) {
    /** Kimi 部分模型（如 kimi-k2.5）仅允许 temperature=1，否则 400 */
    const temperature = diag.providerName === "moonshot" ? 1 : 0.2;

    const baseParams: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? "auto" as const : undefined,
      temperature,
    };
    const requestParams =
      diag.providerName === "moonshot"
        ? ({ ...baseParams, ...moonshotRequestExtras() } as OpenAI.ChatCompletionCreateParams)
        : (baseParams as OpenAI.ChatCompletionCreateParams);

    if (useStream) {
      let stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;
      try {
        stream = (await client.chat.completions.create({
          ...requestParams,
          stream: true,
        })) as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;
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
      const acc: Map<number, ToolCallAcc> = new Map();
      let textBuf = "";
      let reasoningBuf = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta) {
          const ext = delta as { reasoning_content?: string | null };
          if (ext.reasoning_content) reasoningBuf += ext.reasoning_content;
        }
        if (delta?.content) {
          textBuf += delta.content;
          onAssistantText(delta.content);
        }
        if (delta) mergeStreamToolCalls(acc, delta);
      }
      const toolCalls = accToToolCallArray(acc);
      if (toolCalls.length) {
        if (diag.providerName === "moonshot") {
          pushAssistantWithToolCallsMoonshot(messages, textBuf || null, toolCalls, reasoningBuf);
        } else {
          const m: AssistantWithReasoning = {
            role: "assistant",
            content: textBuf || null,
            tool_calls: toolCalls,
          };
          if (reasoningBuf.trim()) m.reasoning_content = reasoningBuf;
          messages.push(m);
        }
        for (const call of toolCalls) {
          if (call.type !== "function") continue;
          const fn = call.function;
          let args: unknown = {};
          try {
            args = fn.arguments ? JSON.parse(fn.arguments) : {};
          } catch {
            args = {};
          }
          const result = await runTool(fn.name, args, policy);
          messages.push({ role: "tool", tool_call_id: call.id, content: result });
        }
        continue;
      }
      if (!textBuf.trim() && !toolCalls.length) {
        messages.push({ role: "assistant", content: "(no response)" });
      } else {
        messages.push({ role: "assistant", content: textBuf || "" });
      }
      turnComplete = true;
      break;
    }

    let completion: OpenAI.Chat.ChatCompletion;
    try {
      completion = (await client.chat.completions.create({
        ...requestParams,
        stream: false,
      })) as OpenAI.Chat.ChatCompletion;
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
    messages.push(msg as OpenAI.Chat.ChatCompletionMessageParam);
    if (diag.providerName === "moonshot" && msg.tool_calls?.length) {
      const last = messages[messages.length - 1] as AssistantWithReasoning;
      if (last.role === "assistant" && !String(last.reasoning_content ?? "").trim()) {
        last.reasoning_content = " ";
      }
    }

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
  const { tools, policy, closeMcp } = await prepareAgentTools(cfg, opts);
  const sessionKey = opts?.sessionKey ?? "cli:direct";
  const systemContent = await buildFullSystemPrompt(cfg, policy.workspaceRoot ?? process.cwd(), sessionKey);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    { role: "user", content: userMessage },
  ];
  let out = "";
  try {
    await runModelToolRounds(
      client,
      model,
      messages,
      tools,
      policy,
      (t) => {
        out += t;
        opts?.onStreamDelta?.(t);
      },
      { providerName, baseURL },
      Boolean(opts?.onStreamDelta),
    );
  } finally {
    await closeMcp();
  }
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
  const { tools, policy, closeMcp } = await prepareAgentTools(cfg, opts);
  const sessionKey = opts?.sessionKey ?? "admin:web";
  const systemContent = await buildFullSystemPrompt(cfg, policy.workspaceRoot ?? process.cwd(), sessionKey);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...prior.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];
  let out = "";
  try {
    await runModelToolRounds(
      client,
      model,
      messages,
      tools,
      policy,
      (t) => {
        out += t;
        opts?.onStreamDelta?.(t);
      },
      { providerName, baseURL },
      Boolean(opts?.onStreamDelta),
    );
  } finally {
    await closeMcp();
  }
  const replyText = lastAssistantPlainText(messages);
  if (isMemoryEnabled(cfg) && replyText) {
    await appendSessionTranscript(sessionKey, userMessage, replyText, memoryPersistLimit(cfg));
  }
  return out.trim() || "(empty reply)";
}

export async function runAgentLoop(cfg: NanobotConfig, opts?: AgentRunOptions): Promise<void> {
  const { client, providerName, baseURL } = createClient(cfg);
  const model = effectiveChatModel(cfg, providerName);
  const { tools, policy, closeMcp } = await prepareAgentTools(cfg, opts);

  try {
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

        await runModelToolRounds(
          client,
          model,
          messages,
          tools,
          policy,
          (t) => output.write(`\n${t}\n`),
          { providerName, baseURL },
          false,
        );

        const replyText = lastAssistantPlainText(messages);
        if (isMemoryEnabled(cfg) && replyText) {
          await appendSessionTranscript(sessionKey, user, replyText, memoryPersistLimit(cfg));
        }
      }
    } finally {
      weixinBridge?.stop();
      rl.close();
    }
  } finally {
    await closeMcp();
  }
}
