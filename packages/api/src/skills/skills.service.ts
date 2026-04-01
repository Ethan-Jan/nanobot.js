import { Injectable } from "@nestjs/common";
import { join } from "node:path";
import * as core from "nanobot/api-lib";
import { NanobotConfigService } from "../config/nanobot-config.service";

export type SkillDetail = core.SkillDetail;
export type SkillManifest = core.SkillManifest;
export type GitHubSkillInfo = core.GitHubSkillInfo;

function isAbsolutePath(p: string): boolean {
  return p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p);
}

@Injectable()
export class SkillsService {
  constructor(private readonly nanobot: NanobotConfigService) {}

  private async resolveWorkspaceRoot(): Promise<string> {
    const cfg = await this.nanobot.loadConfig();
    const w = cfg.tools?.workspaceRoot?.trim();
    if (!w) return process.cwd();
    return isAbsolutePath(w) ? w : join(process.cwd(), w);
  }

  async getSkills(): Promise<SkillDetail[]> {
    const root = await this.resolveWorkspaceRoot();
    return core.getAllSkillsWithMetadata(root);
  }

  async getSkillDetail(name: string): Promise<SkillDetail> {
    const root = await this.resolveWorkspaceRoot();
    return core.getSkillDetail(name, root);
  }

  async importFromGitHub(url: string): Promise<SkillDetail> {
    const root = await this.resolveWorkspaceRoot();
    return core.importSkillFromGitHub(url, root);
  }

  async deleteSkill(name: string): Promise<void> {
    const root = await this.resolveWorkspaceRoot();
    return core.deleteSkill(name, root);
  }

  /** 技能为按需扫描，无服务端缓存；调用即可触发前端刷新列表 */
  async reloadSkills(): Promise<void> {
    return Promise.resolve();
  }

  async searchGitHub(query: string, broad = false): Promise<GitHubSkillInfo[]> {
    return core.searchGitHubSkills(query, { topicOnly: !broad });
  }
}
