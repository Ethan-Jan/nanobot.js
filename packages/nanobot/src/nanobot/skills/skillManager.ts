/**
 * 技能管理器 - 支持从 GitHub 导入、删除、搜索技能
 */

import { readdir, readFile, writeFile, mkdir, rm, access } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { execSync } from "node:child_process";
import type { SkillManifest } from "./skillsLoader.js";

const SKILLS_DIR = "skills";
const SKILL_METADATA_FILE = "skill.json";

/** GitHub 搜索结果 */
export interface GitHubSkillInfo {
  fullName: string;
  url: string;
  description?: string;
  stars: number;
}

/** 技能详情（包含完整 README） */
export interface SkillDetail extends SkillManifest {
  readme?: string;
  author?: string;
  license?: string;
  source: "local" | "github";
  sourceUrl?: string;
}

/**
 * 解析 GitHub URL，支持多种格式：
 * - https://github.com/user/repo
 * - github.com/user/repo
 * - user/repo
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // 移除协议和域名前缀
  let cleaned = url.trim();
  cleaned = cleaned.replace(/^https?:\/\//, "");
  cleaned = cleaned.replace(/^github\.com\//, "");
  
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}

/**
 * 从 GitHub 导入技能
 */
export async function importSkillFromGitHub(
  url: string,
  workspaceRoot: string
): Promise<SkillDetail> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    throw new Error(`无效的 GitHub URL: ${url}`);
  }

  const { owner, repo } = parsed;
  const skillName = repo.replace(/^nanobot-skill-/, "").replace(/-skill$/, "");
  const targetDir = resolve(workspaceRoot, SKILLS_DIR, skillName);

  // 检查是否已存在
  try {
    await access(targetDir);
    throw new Error(`技能 "${skillName}" 已存在，请先删除或重命名`);
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      throw e;
    }
  }

  // 创建目录并克隆
  try {
    await mkdir(targetDir, { recursive: true });
    
    // 使用 shallow clone
    const cloneUrl = `https://github.com/${owner}/${repo}.git`;
    execSync(`git clone --depth 1 "${cloneUrl}" "${targetDir}"`, {
      stdio: "pipe",
      timeout: 60000,
    });

    // 删除 .git 目录（减小体积）
    const gitDir = join(targetDir, ".git");
    try {
      await rm(gitDir, { recursive: true, force: true });
    } catch {
      // 忽略删除 .git 失败
    }

    // 读取技能信息
    const detail = await getSkillDetail(skillName, workspaceRoot);
    
    // 保存元数据
    const metadata = {
      source: "github" as const,
      sourceUrl: `https://github.com/${owner}/${repo}`,
      importedAt: new Date().toISOString(),
    };
    await writeFile(
      join(targetDir, SKILL_METADATA_FILE),
      JSON.stringify(metadata, null, 2),
      "utf8"
    );

    return { ...detail, ...metadata };
  } catch (e) {
    // 清理失败的目录
    try {
      await rm(targetDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
    throw e;
  }
}

/**
 * 删除技能
 */
export async function deleteSkill(
  name: string,
  workspaceRoot: string
): Promise<void> {
  const skillDir = resolve(workspaceRoot, SKILLS_DIR, name);
  
  try {
    await access(skillDir);
  } catch {
    throw new Error(`技能 "${name}" 不存在`);
  }

  await rm(skillDir, { recursive: true, force: true });
}

/**
 * 获取技能详情
 */
export async function getSkillDetail(
  name: string,
  workspaceRoot: string
): Promise<SkillDetail> {
  const skillDir = resolve(workspaceRoot, SKILLS_DIR, name);
  
  try {
    await access(skillDir);
  } catch {
    throw new Error(`技能 "${name}" 不存在`);
  }

  // 读取 SKILL.md
  const skillMdPath = join(skillDir, "SKILL.md");
  let manifest: Partial<SkillManifest> = {};
  let readme = "";
  
  try {
    const content = await readFile(skillMdPath, "utf8");
    const { meta, body } = parseFrontMatter(content);
    manifest = {
      name: (meta.name as string) || name,
      description: (meta.description as string) || body.slice(0, 100).replace(/\n/g, " "),
      version: meta.version as string,
      triggers: Array.isArray(meta.triggers) ? meta.triggers : undefined,
    };
    readme = body;
  } catch {
    manifest = { name, description: "暂无描述" };
  }

  // 读取元数据
  const metadataPath = join(skillDir, SKILL_METADATA_FILE);
  let metadata: Partial<SkillDetail> = { source: "local" as const };
  
  try {
    const metaContent = await readFile(metadataPath, "utf8");
    const savedMeta = JSON.parse(metaContent) as Partial<SkillDetail>;
    metadata = { ...metadata, ...savedMeta };
  } catch {
    // 无元数据文件，视为本地技能
  }

  // 尝试读取 LICENSE
  const licensePath = join(skillDir, "LICENSE");
  let license: string | undefined;
  try {
    const licenseContent = await readFile(licensePath, "utf8");
    license = licenseContent.split("\n")[0]?.trim();
  } catch {
    // 无 LICENSE 文件
  }

  return {
    ...manifest,
    ...metadata,
    name: manifest.name || name,
    readme,
    license,
  } as SkillDetail;
}

/**
 * 搜索 GitHub 仓库（社区技能）
 * @param topicOnly true（默认）：带 `topic:nanobot-skill`，对齐社区约定；false：关键词搜索任意仓库（需自行辨别是否含 SKILL.md）
 */
export async function searchGitHubSkills(
  query: string,
  opts?: { topicOnly?: boolean },
): Promise<GitHubSkillInfo[]> {
  const topicOnly = opts?.topicOnly !== false;
  const q = topicOnly
    ? `${query} topic:nanobot-skill in:name,description`
    : `${query} in:name,description`;
  const searchQuery = encodeURIComponent(q);
  const url = `https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=20`;
  
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "nanobot-skill-manager",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API 错误: ${response.status}`);
    }

    const data = await response.json() as {
      items: Array<{
        full_name: string;
        html_url: string;
        description: string | null;
        stargazers_count: number;
      }>;
    };

    return data.items.map((item) => ({
      fullName: item.full_name,
      url: item.html_url,
      description: item.description || undefined,
      stars: item.stargazers_count,
    }));
  } catch (e) {
    if (e instanceof Error && e.message.includes("fetch")) {
      throw new Error("无法连接到 GitHub API，请检查网络");
    }
    throw e;
  }
}

/**
 * 解析 front matter（复用 skillsLoader 的逻辑）
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
 * 获取所有已安装技能（带元数据）
 */
export async function getAllSkillsWithMetadata(
  workspaceRoot: string
): Promise<SkillDetail[]> {
  const skillsPath = resolve(workspaceRoot, SKILLS_DIR);
  const skills: SkillDetail[] = [];
  
  try {
    const entries = await readdir(skillsPath, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        try {
          const detail = await getSkillDetail(e.name, workspaceRoot);
          skills.push(detail);
        } catch {
          // 跳过无效技能
        }
      }
    }
  } catch {
    // skills directory doesn't exist
  }
  
  return skills;
}
