export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function postChat(messages: ChatTurn[], sessionId?: string): Promise<string> {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, sessionId }),
  });
  let data: { reply?: string; error?: string };
  try {
    data = (await r.json()) as { reply?: string; error?: string };
  } catch {
    throw new Error(await r.text());
  }
  if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
  if (typeof data.reply !== "string") throw new Error("invalid response");
  return data.reply;
}

export type PostChatStreamOptions = {
  /** 中止时 fetch/body 会取消；已读到的分片会保留在累计结果中 */
  signal?: AbortSignal;
};

/**
 * 流式对话：SSE 帧为 `data: { "text"?: "…" }` 分片，最后 `data: { "done": true }`，或 `data: { "error": "…" }`。
 * `signal` 中止时抛出 `DOMException`（`name === "AbortError"`），调用方用已展示的部分即可。
 */
export async function postChatStream(
  messages: ChatTurn[],
  sessionId: string | undefined,
  onDelta: (chunk: string) => void,
  options?: PostChatStreamOptions,
): Promise<string> {
  const signal = options?.signal;
  let r: Response;
  try {
    r = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ messages, sessionId }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
      throw new DOMException("aborted", "AbortError");
    }
    throw e;
  }
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const j = (await r.json()) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      const t = await r.text();
      if (t) msg = t;
    }
    throw new Error(msg);
  }
  if (!r.body) throw new Error("no response body");
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        throw new DOMException("aborted", "AbortError");
      }
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of block.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          let payload: { text?: string; done?: boolean; error?: string };
          try {
            payload = JSON.parse(line.slice(6)) as { text?: string; done?: boolean; error?: string };
          } catch {
            continue;
          }
          if (payload.error) throw new Error(payload.error);
          if (payload.done) return full;
          if (typeof payload.text === "string") {
            full += payload.text;
            onDelta(payload.text);
          }
        }
      }
    }
  } catch (e) {
    if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
      throw new DOMException("aborted", "AbortError");
    }
    throw e;
  }
  return full;
}
