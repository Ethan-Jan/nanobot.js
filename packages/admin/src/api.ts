import type { NanobotConfigDTO } from "./types";

export type StatusPayload = {
  configPath: string;
  defaultProvider: string;
  defaultModel: string;
  providers: Record<
    string,
    {
      baseUrl?: string;
      hasKey: boolean;
      keyFromFile: boolean;
      keyFromEnv: boolean;
    }
  >;
};

export async function getStatus(): Promise<StatusPayload> {
  const r = await fetch("/api/status");
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<StatusPayload>;
}

export async function getConfig(): Promise<NanobotConfigDTO> {
  const r = await fetch("/api/config");
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<NanobotConfigDTO>;
}

export async function putConfig(patch: Record<string, unknown>): Promise<NanobotConfigDTO> {
  const r = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<NanobotConfigDTO>;
}

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
