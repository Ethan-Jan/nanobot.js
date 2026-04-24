import { BadRequestException, Injectable, PayloadTooLargeException } from "@nestjs/common";
import type { Response } from "express";
import * as core from "nanobot/api-lib";
import type { AgentChatHistoryItem } from "nanobot/api-lib";
import { NanobotConfigService } from "../config/nanobot-config.service";

type ParsedChatBody = {
  prior: AgentChatHistoryItem[];
  userMessage: string;
  sessionKey: string;
};

@Injectable()
export class ChatService {
  constructor(private readonly nanobot: NanobotConfigService) {}

  private parseChatBody(body: unknown): ParsedChatBody {
    const raw = JSON.stringify(body ?? {});
    if (raw.length > 512_000) {
      throw new PayloadTooLargeException("Request body too large");
    }
    const parsed = body as { messages?: unknown; sessionId?: unknown };
    const msgs = parsed.messages;
    if (!Array.isArray(msgs) || msgs.length === 0) {
      throw new BadRequestException("messages must be a non-empty array");
    }
    const last = msgs[msgs.length - 1] as { role?: string; content?: string };
    if (last?.role !== "user" || typeof last.content !== "string" || !last.content.trim()) {
      throw new BadRequestException("last message must be role=user with non-empty content");
    }
    const prior: AgentChatHistoryItem[] = [];
    for (let i = 0; i < msgs.length - 1; i++) {
      const m = msgs[i] as { role?: string; content?: string };
      if ((m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
        throw new BadRequestException(`messages[${i}] must be user|assistant with string content`);
      }
      prior.push({ role: m.role, content: m.content });
    }
    const sidRaw = parsed.sessionId;
    let sessionKey = "admin:web";
    if (typeof sidRaw === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(sidRaw)) {
      sessionKey = `admin:web:${sidRaw}`;
    }
    return { prior, userMessage: last.content.trim(), sessionKey };
  }

  async chat(body: unknown): Promise<{ reply: string }> {
    const { prior, userMessage, sessionKey } = this.parseChatBody(body);
    const cfg = await this.nanobot.loadConfig();
    const reply = await core.runAgentWithHistory(cfg, prior, userMessage, {
      sessionKey,
      allowShell: false,
    });
    return { reply };
  }

  /**
   * SSE：每条 `data: { "text": "…" }` 为模型分片；最后一条 `data: { "done": true }`；错误为 `data: { "error": "…" }`。
   */
  async chatStream(body: unknown, res: Response): Promise<void> {
    const { prior, userMessage, sessionKey } = this.parseChatBody(body);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const send = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const cfg = await this.nanobot.loadConfig();
    try {
      await core.runAgentWithHistory(cfg, prior, userMessage, {
        sessionKey,
        allowShell: false,
        onStreamDelta: (t) => send({ text: t }),
      });
      send({ done: true });
    } catch (e) {
      send({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      res.end();
    }
  }
}
