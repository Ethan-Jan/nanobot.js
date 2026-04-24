/**
 * MCP Client：连接配置中的 stdio servers，将 tools 映射为 OpenAI function calling。
 */

import type OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { NanobotConfig, McpServerConfig } from "../../config.js";

type Route = { serverKey: string; mcpToolName: string };

function slugPart(s: string): string {
  const t = s.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  return (t || "x").slice(0, 48);
}

function openAiParametersFromMcp(inputSchema: {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: "object",
    properties: inputSchema.properties ?? {},
  };
  if (inputSchema.required?.length) out.required = inputSchema.required;
  return out;
}

function formatCallToolResult(result: {
  isError?: boolean;
  content?: Array<{ type: string; text?: string; mimeType?: string; data?: string }>;
  structuredContent?: Record<string, unknown>;
}): string {
  if (result.isError) {
    return `MCP tool reported error: ${JSON.stringify(result.structuredContent ?? result.content ?? result)}`;
  }
  const chunks: string[] = [];
  if (result.structuredContent && Object.keys(result.structuredContent).length > 0) {
    chunks.push(JSON.stringify(result.structuredContent, null, 2));
  }
  if (result.content?.length) {
    for (const c of result.content) {
      if (c.type === "text" && c.text != null) chunks.push(c.text);
      else if (c.type === "image" && c.data)
        chunks.push(`[image ${c.mimeType ?? "unknown"} base64 ${c.data.length} chars]`);
      else if (c.type === "audio" && c.data)
        chunks.push(`[audio ${c.mimeType ?? "unknown"} base64 ${c.data.length} chars]`);
      else chunks.push(`[${c.type}]`);
    }
  }
  return chunks.length ? chunks.join("\n\n") : "(empty MCP result)";
}

export class McpPool {
  private readonly clients = new Map<string, Client>();
  private readonly routes = new Map<string, Route>();
  private readonly openAiTools: OpenAI.Chat.ChatCompletionTool[] = [];

  private constructor() {}

  /** 无可用服务器或全部连接失败时返回 null */
  static async connect(cfg: NanobotConfig): Promise<McpPool | null> {
    const servers = cfg.mcp?.servers;
    if (!servers || Object.keys(servers).length === 0) return null;

    const pool = new McpPool();
    for (const [key, sc] of Object.entries(servers)) {
      if (sc.disabled || !sc.command?.trim()) continue;
      try {
        await pool.attachServer(key, sc);
      } catch (e) {
        console.error(`[mcp] server "${key}" (${sc.command}) failed:`, e instanceof Error ? e.message : e);
      }
    }

    if (pool.openAiTools.length === 0) {
      await pool.close();
      return null;
    }
    return pool;
  }

  private async attachServer(serverKey: string, sc: McpServerConfig): Promise<void> {
    const env =
      sc.env && Object.keys(sc.env).length > 0 ? { ...getDefaultEnvironment(), ...sc.env } : undefined;

    const transport = new StdioClientTransport({
      command: sc.command.trim(),
      args: sc.args ?? [],
      env,
      cwd: sc.cwd?.trim() || undefined,
      stderr: "inherit",
    });

    const client = new Client({ name: `nanobot-${serverKey}`, version: "0.1.0" });
    await client.connect(transport);
    this.clients.set(serverKey, client);

    let cursor: string | undefined;
    for (;;) {
      const page = await client.listTools(cursor ? { cursor } : undefined);
      for (const t of page.tools) {
        const mcpName = t.name;
        const openAiName = this.allocateOpenAiToolName(serverKey, mcpName);
        this.routes.set(openAiName, { serverKey, mcpToolName: mcpName });

        const desc = [t.description, `(MCP server "${serverKey}", tool "${mcpName}")`]
          .filter(Boolean)
          .join(" ");

        this.openAiTools.push({
          type: "function",
          function: {
            name: openAiName,
            description: desc.slice(0, 1024),
            parameters: openAiParametersFromMcp(t.inputSchema),
          },
        });
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  }

  private allocateOpenAiToolName(serverKey: string, mcpToolName: string): string {
    const sk = slugPart(serverKey);
    const tn = slugPart(mcpToolName);
    let base = `mcp__${sk}__${tn}`;
    if (base.length > 64) base = base.slice(0, 64);
    let name = base;
    let n = 2;
    while (this.routes.has(name)) {
      const suffix = `_${n++}`;
      name = (base.slice(0, 64 - suffix.length) + suffix).slice(0, 64);
    }
    return name;
  }

  getOpenAiTools(): OpenAI.Chat.ChatCompletionTool[] {
    return this.openAiTools;
  }

  async dispatch(openAiToolName: string, args: unknown): Promise<string | undefined> {
    const route = this.routes.get(openAiToolName);
    if (!route) return undefined;
    const client = this.clients.get(route.serverKey);
    if (!client) return `Error: MCP client not found for server "${route.serverKey}"`;

    const arguments_ =
      args && typeof args === "object" && !Array.isArray(args)
        ? (args as Record<string, unknown>)
        : {};

    try {
      const result = await client.callTool({
        name: route.mcpToolName,
        arguments: arguments_,
      });
      return formatCallToolResult(result as Parameters<typeof formatCallToolResult>[0]);
    } catch (e) {
      return `MCP callTool error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async close(): Promise<void> {
    for (const c of this.clients.values()) {
      try {
        await c.close();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
    this.routes.clear();
    this.openAiTools.length = 0;
  }
}
