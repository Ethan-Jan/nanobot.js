/** 与 `nanobot` 包磁盘 JSON / mergeAndSave 对齐的最小类型（避免 Nest 编译进 nanobot 源码树） */
declare module "nanobot/api-lib" {
  export interface NanobotConfig {
    providers: Record<string, { apiKey?: string; baseUrl?: string }>;
    agents: {
      defaults: { model: string; provider: string };
      memory?: { enabled?: boolean; maxPersistedMessages?: number };
      displayName?: string;
      askNicknameOnStart?: boolean;
    };
    tools: { allowShell: boolean; workspaceRoot?: string; allowWrite?: boolean };
    channels?: { weixin?: { token?: string; [k: string]: unknown } };
  }

  export function loadConfig(): Promise<NanobotConfig>;
  export function configPath(): string;
  export function mergeAndSave(patch: Partial<NanobotConfig>): Promise<NanobotConfig>;
  export function runAgentWithHistory(
    cfg: NanobotConfig,
    prior: { role: "user" | "assistant"; content: string }[],
    userMessage: string,
    opts?: { sessionKey?: string; allowShell?: boolean },
  ): Promise<string>;

  export function weixinHasPersistedToken(cfg: NanobotConfig): Promise<boolean>;
  export function startWeixinQrSession(
    cfg: NanobotConfig,
    opts?: { force?: boolean },
  ): Promise<{ qrcode: string; scanPayload: string; qrDataUrl: string }>;
  export function pollWeixinQrAndMaybeSave(
    cfg: NanobotConfig,
    qrcodeId: string,
  ): Promise<
    | { status: "waiting" | "scaned" | "expired" }
    | { status: "confirmed"; saved: true }
  >;
}
