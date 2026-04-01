/** 与 `nanobot.config.json` / 后端 API 对齐的展示类型（不含 Node 依赖） */

export type ProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
};

export type NanobotConfigDTO = {
  providers: Record<string, ProviderConfig>;
  agents: {
    defaults: { model: string; provider: string };
    memory?: { enabled?: boolean; maxPersistedMessages?: number };
  };
  tools: {
    allowShell: boolean;
    workspaceRoot?: string;
    allowWrite?: boolean;
  };
  channels?: {
    weixin?: {
      enabled?: boolean;
      allow_from?: string[];
      base_url?: string;
      cdn_base_url?: string;
      route_tag?: string | number | null;
      token?: string;
      state_dir?: string;
      poll_timeout?: number;
    };
  };
};
