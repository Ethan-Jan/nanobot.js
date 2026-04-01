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
