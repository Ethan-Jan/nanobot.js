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
    /** 全局助手称呼；不填则默认「nanobot（小纳）」或各会话 /alias */
    displayName?: string;
    /** 需开启记忆：本会话尚无称呼且无持久化对话时，首轮引导模型询问昵称 */
    askNicknameOnStart?: boolean;
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

/** 技能清单 */
export interface SkillManifest {
  name: string;
  description?: string;
  version?: string;
  triggers?: string[];
  source?: "local" | "github";
  sourceUrl?: string;
  author?: string;
  license?: string;
  readme?: string;
}

/** GitHub 搜索结果 */
export interface GitHubSkillInfo {
  fullName: string;
  url: string;
  description?: string;
  stars: number;
}
