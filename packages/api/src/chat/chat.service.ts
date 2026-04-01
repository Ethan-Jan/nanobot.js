import { BadRequestException, Injectable, PayloadTooLargeException } from "@nestjs/common";
import * as core from "nanobot/api-lib";
import { NanobotConfigService } from "../config/nanobot-config.service";

@Injectable()
export class ChatService {
  constructor(private readonly nanobot: NanobotConfigService) {}

  async chat(body: unknown): Promise<{ reply: string }> {
    const raw = JSON.stringify(body ?? {});
    if (raw.length > 512_000) {
      throw new PayloadTooLargeException("Request body too large");
    }
    const parsed = body as { messages?: unknown };
    const msgs = parsed.messages;
    if (!Array.isArray(msgs) || msgs.length === 0) {
      throw new BadRequestException("messages must be a non-empty array");
    }
    const last = msgs[msgs.length - 1] as { role?: string; content?: string };
    if (last?.role !== "user" || typeof last.content !== "string" || !last.content.trim()) {
      throw new BadRequestException("last message must be role=user with non-empty content");
    }
    const prior: { role: "user" | "assistant"; content: string }[] = [];
    for (let i = 0; i < msgs.length - 1; i++) {
      const m = msgs[i] as { role?: string; content?: string };
      if ((m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
        throw new BadRequestException(`messages[${i}] must be user|assistant with string content`);
      }
      prior.push({ role: m.role, content: m.content });
    }
    const sidRaw = (parsed as { sessionId?: unknown }).sessionId;
    let sessionKey = "admin:web";
    if (typeof sidRaw === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(sidRaw)) {
      sessionKey = `admin:web:${sidRaw}`;
    }

    const cfg = await this.nanobot.loadConfig();
    const reply = await core.runAgentWithHistory(cfg, prior, last.content.trim(), {
      sessionKey,
      allowShell: false,
    });
    return { reply };
  }
}
