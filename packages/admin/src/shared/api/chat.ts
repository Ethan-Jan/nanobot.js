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
