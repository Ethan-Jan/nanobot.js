/**
 * 上游对应：`nanobot/agent/skills.py` + `nanobot/skills/**`
 *
 * 上游会扫描技能目录，读取 SKILL.md（front matter + 说明），在运行时注入为：
 * - 系统提示片段，和/或
 * - 动态工具定义
 *
 * 当前：空实现。可约定本仓库 `skills/` 目录镜像上游结构。
 */
export async function loadSkillPromptFragments(_workspaceRoot: string): Promise<string[]> {
  return [];
}
