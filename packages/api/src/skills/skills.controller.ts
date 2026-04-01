import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { SkillsService } from "./skills.service";

/**
 * 路由顺序：静态路径（search/github、import/github、reload）必须在 :name 之前注册，
 * 否则「search」会被当成技能名。
 */
@Controller("skills")
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  async getSkills() {
    try {
      const skills = await this.skillsService.getSkills();
      return { skills };
    } catch (e) {
      throw new HttpException(
        e instanceof Error ? e.message : "获取技能列表失败",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("search/github")
  async searchGitHub(@Query("q") query: string, @Query("broad") broad?: string) {
    if (!query || typeof query !== "string") {
      throw new HttpException("请提供搜索关键词 q", HttpStatus.BAD_REQUEST);
    }
    const isBroad = broad === "1" || broad === "true";
    try {
      const results = await this.skillsService.searchGitHub(query.trim(), isBroad);
      return { results };
    } catch (e) {
      throw new HttpException(
        e instanceof Error ? e.message : "搜索失败",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post("import/github")
  async importFromGitHub(@Body() body: { url?: string }) {
    if (!body?.url || typeof body.url !== "string") {
      throw new HttpException("请提供有效的 GitHub URL", HttpStatus.BAD_REQUEST);
    }
    try {
      const skill = await this.skillsService.importFromGitHub(body.url.trim());
      return { success: true, skill };
    } catch (e) {
      throw new HttpException(e instanceof Error ? e.message : "导入失败", HttpStatus.BAD_REQUEST);
    }
  }

  @Post("reload")
  async reloadSkills() {
    try {
      await this.skillsService.reloadSkills();
      return { success: true };
    } catch (e) {
      throw new HttpException(
        e instanceof Error ? e.message : "重载失败",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(":name")
  async getSkillDetail(@Param("name") name: string) {
    try {
      return await this.skillsService.getSkillDetail(decodeURIComponent(name));
    } catch (e) {
      if (e instanceof Error && e.message.includes("不存在")) {
        throw new HttpException(e.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        e instanceof Error ? e.message : "获取技能详情失败",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(":name")
  async deleteSkill(@Param("name") name: string) {
    try {
      await this.skillsService.deleteSkill(decodeURIComponent(name));
      return { success: true };
    } catch (e) {
      if (e instanceof Error && e.message.includes("不存在")) {
        throw new HttpException(e.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        e instanceof Error ? e.message : "删除失败",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
