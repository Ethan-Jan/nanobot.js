import type { NanobotConfigDTO, SkillManifest, GitHubSkillInfo } from "./types";

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
  channels?: {
    weixin?: {
      enabled: boolean;
      hasToken: boolean;
      baseUrl?: string;
      allowFromCount: number;
      stateDir?: string;
      pollTimeout?: number;
    };
  };
};

export async function getStatus(): Promise<StatusPayload> {
  const r = await fetch("/api/status");
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<StatusPayload>;
}

export type WeixinQrStartResponse = { qrcode: string; scanPayload: string; qrDataUrl: string };

export type WeixinLoginPollResponse =
  | { status: "waiting" | "scaned" | "expired" }
  | { status: "confirmed"; saved: boolean };

export async function postWeixinLoginQr(force = false): Promise<WeixinQrStartResponse> {
  const r = await fetch("/api/weixin/login/qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
  if (!r.ok) {
    const raw = await r.text();
    let msg = raw;
    try {
      const j = JSON.parse(raw) as { message?: string | string[] };
      msg = Array.isArray(j.message) ? j.message.join(", ") : (j.message ?? raw);
    } catch {
      /* 保持 raw */
    }
    const err = new Error(msg) as Error & { status: number };
    err.status = r.status;
    throw err;
  }
  return r.json() as Promise<WeixinQrStartResponse>;
}

export async function getWeixinLoginPoll(qrcode: string): Promise<WeixinLoginPollResponse> {
  const r = await fetch(`/api/weixin/login/status?qrcode=${encodeURIComponent(qrcode)}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<WeixinLoginPollResponse>;
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

// ==================== 技能管理 API ====================

/** 获取已安装的技能列表 */
export async function getSkills(): Promise<SkillManifest[]> {
  const r = await fetch("/api/skills");
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `HTTP ${r.status}`);
  }
  const data = (await r.json()) as { skills: SkillManifest[] };
  return data.skills;
}

/** 获取单个技能详情 */
export async function getSkillDetail(name: string): Promise<SkillManifest> {
  const r = await fetch(`/api/skills/${encodeURIComponent(name)}`);
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `HTTP ${r.status}`);
  }
  return r.json() as Promise<SkillManifest>;
}

/** 从 GitHub 导入技能 */
export async function importSkillFromGitHub(url: string): Promise<void> {
  const r = await fetch("/api/skills/import/github", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!r.ok) {
    const text = await r.text();
    let msg = text;
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      msg = Array.isArray(j.message) ? j.message.join(", ") : (j.message ?? text);
    } catch {
      /* keep */
    }
    throw new Error(msg || `HTTP ${r.status}`);
  }
}

/** 删除技能 */
export async function deleteSkill(name: string): Promise<void> {
  const r = await fetch(`/api/skills/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `HTTP ${r.status}`);
  }
}

/** 重新加载所有技能 */
export async function reloadSkills(): Promise<void> {
  const r = await fetch("/api/skills/reload", {
    method: "POST",
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `HTTP ${r.status}`);
  }
}

/** 搜索 GitHub 上的技能；broad=true 时不限 topic:nanobot-skill（任意仓库，需自行辨别） */
export async function searchGitHubSkills(query: string, broad = false): Promise<GitHubSkillInfo[]> {
  const q = new URLSearchParams({ q: query });
  if (broad) q.set("broad", "1");
  const r = await fetch(`/api/skills/search/github?${q.toString()}`);
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `HTTP ${r.status}`);
  }
  const data = (await r.json()) as { results: GitHubSkillInfo[] };
  return data.results;
}
