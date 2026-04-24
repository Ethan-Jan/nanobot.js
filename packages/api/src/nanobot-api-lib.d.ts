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

  export type UserProfile = {
    summary?: string;
    role?: string;
    domain?: string;
    techStack?: string[];
    timezoneOrSchedule?: string;
    notes?: string;
  };
  export type UserIntent = {
    summary?: string;
    shortTerm?: string;
    updatedAt?: string;
  };
  export type UserPreferences = {
    responseLanguage?: string;
    detailLevel?: "brief" | "normal" | "detailed";
    codeAndDocsStyle?: string;
    extra?: string;
  };
  export type UserContextData = {
    version: 1;
    updatedAt: string;
    profile?: UserProfile;
    intent?: UserIntent;
    preferences?: UserPreferences;
  };

  export function loadUserContext(workspaceRoot: string): Promise<UserContextData | null>;
  export function saveUserContext(workspaceRoot: string, data: UserContextData): Promise<void>;
  export function emptyUserContextForEditor(): UserContextData;

  export type AgentChatHistoryItem = { role: "user" | "assistant"; content: string };

  export function runAgentWithHistory(
    cfg: NanobotConfig,
    prior: AgentChatHistoryItem[],
    userMessage: string,
    opts?: {
      sessionKey?: string;
      allowShell?: boolean;
      workspaceRoot?: string;
      onStreamDelta?: (text: string) => void;
    },
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

  // ===== 技能系统 =====
  export interface SkillManifest {
    name: string;
    description?: string;
    version?: string;
    triggers?: string[];
  }

  export interface SkillDetail extends SkillManifest {
    readme?: string;
    author?: string;
    license?: string;
    source: "local" | "github";
    sourceUrl?: string;
  }

  export interface GitHubSkillInfo {
    fullName: string;
    url: string;
    description?: string;
    stars: number;
  }

  export function loadAllSkills(workspaceRoot: string): Promise<SkillManifest[]>;
  export function loadSkillPromptFragments(workspaceRoot: string): Promise<string[]>;
  export function getCodeAnalysisReport(workspaceRoot: string): Promise<string>;
  export function listAvailableSkills(workspaceRoot: string): Promise<string>;

  export function importSkillFromGitHub(
    url: string,
    workspaceRoot: string
  ): Promise<SkillDetail>;
  export function deleteSkill(name: string, workspaceRoot: string): Promise<void>;
  export function getSkillDetail(name: string, workspaceRoot: string): Promise<SkillDetail>;
  export function searchGitHubSkills(
    query: string,
    opts?: { topicOnly?: boolean },
  ): Promise<GitHubSkillInfo[]>;
  export function getAllSkillsWithMetadata(workspaceRoot: string): Promise<SkillDetail[]>;
}
