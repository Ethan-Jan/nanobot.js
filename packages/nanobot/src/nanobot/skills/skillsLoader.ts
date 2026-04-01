/**
 * 技能加载器 - 扫描并加载工作区的技能定义
 * 
 * 技能目录结构约定：
 * workspace/
 *   skills/
 *     my-skill/
 *       SKILL.md        # 技能描述（front matter + 说明）
 *       examples/       # 示例文件（可选）
 *       templates/      # 模板文件（可选）
 */

import { readdir, readFile } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { generateProjectReport } from "./codeAnalyzer.js";

const SKILLS_DIR = "skills";

export interface SkillManifest {
  name: string;
  description: string;
  version?: string;
  triggers?: string[];
  promptFragment?: string;
}

/**
 * 解析 SKILL.md 的 front matter
 */
function parseFrontMatter(content: string): { meta: Record<string, unknown>; body: string } {
  const meta: Record<string, unknown> = {};
  let body = content;
  
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (fmMatch) {
    const fmLines = fmMatch[1].split("\n");
    for (const line of fmLines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let value: unknown = line.slice(colonIdx + 1).trim();
        // Try parse as array
        if ((value as string).startsWith("[") && (value as string).endsWith("]")) {
          try {
            value = JSON.parse(value as string);
          } catch {
            // Keep as string
          }
        }
        meta[key] = value;
      }
    }
    body = fmMatch[2].trim();
  }
  
  return { meta, body };
}

/**
 * 加载单个技能
 */
async function loadSkill(skillPath: string): Promise<SkillManifest | null> {
  const skillMdPath = join(skillPath, "SKILL.md");
  
  try {
    const content = await readFile(skillMdPath, "utf8");
    const { meta, body } = parseFrontMatter(content);
    
    const name = (meta.name as string) || relative(skillPath, skillPath).split("/").pop() || "unnamed";
    
    return {
      name,
      description: (meta.description as string) || body.slice(0, 100).replace(/\n/g, " "),
      version: meta.version as string,
      triggers: Array.isArray(meta.triggers) ? meta.triggers : undefined,
      promptFragment: body
    };
  } catch {
    return null;
  }
}

/**
 * 扫描并加载所有技能
 */
export async function loadAllSkills(workspaceRoot: string): Promise<SkillManifest[]> {
  const skillsPath = resolve(workspaceRoot, SKILLS_DIR);
  const skills: SkillManifest[] = [];
  
  try {
    const entries = await readdir(skillsPath, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const skillPath = join(skillsPath, e.name);
        const skill = await loadSkill(skillPath);
        if (skill) skills.push(skill);
      }
    }
  } catch {
    // skills directory doesn't exist
  }
  
  return skills;
}

/**
 * 加载技能提示片段（用于注入到 system prompt）
 */
export async function loadSkillPromptFragments(workspaceRoot: string): Promise<string[]> {
  const fragments: string[] = [];
  
  // 加载用户自定义技能
  const skills = await loadAllSkills(workspaceRoot);
  for (const skill of skills) {
    if (skill.promptFragment) {
      fragments.push(`## Skill: ${skill.name}\n${skill.promptFragment}`);
    }
  }
  
  // 如果没有技能，提供代码分析能力作为默认技能
  if (fragments.length === 0) {
    fragments.push(`## Skill: Code Analysis
You can analyze the codebase structure and provide insights about:
- Project overview (languages, file counts, entry points)
- Code complexity and organization
- Dependency patterns

Use available tools to explore and understand the code before making suggestions.`);
  }
  
  return fragments;
}

/**
 * 获取代码分析报告（技能工具）
 */
export async function getCodeAnalysisReport(workspaceRoot: string): Promise<string> {
  return await generateProjectReport(workspaceRoot);
}

/**
 * 列出可用的技能
 */
export async function listAvailableSkills(workspaceRoot: string): Promise<string> {
  const skills = await loadAllSkills(workspaceRoot);
  
  if (skills.length === 0) {
    return `No custom skills found in ${SKILLS_DIR}/ directory.\n\nBuilt-in capabilities:\n  • Code analysis and project overview\n  • Git integration (status, diff)\n  • File statistics and search`;
  }
  
  const lines: string[] = [];
  lines.push(`Found ${skills.length} skill(s):\n`);
  
  for (const skill of skills) {
    lines.push(`📦 ${skill.name}${skill.version ? ` v${skill.version}` : ""}`);
    lines.push(`   ${skill.description}`);
    if (skill.triggers) {
      lines.push(`   Triggers: ${skill.triggers.join(", ")}`);
    }
    lines.push("");
  }
  
  return lines.join("\n");
}
