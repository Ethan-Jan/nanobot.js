import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  PayloadTooLargeException,
  Put,
} from "@nestjs/common";
import * as core from "nanobot/api-lib";
import type { UserContextData } from "nanobot/api-lib";
import { NanobotConfigService } from "../config/nanobot-config.service";

@Controller("user-context")
export class UserContextController {
  constructor(private readonly nanobot: NanobotConfigService) {}

  @Get()
  async get() {
    try {
      const cfg = await this.nanobot.loadConfig();
      const root = cfg.tools?.workspaceRoot?.trim() || process.cwd();
      return (await core.loadUserContext(root)) ?? core.emptyUserContextForEditor();
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new InternalServerErrorException(e instanceof Error ? e.message : String(e));
    }
  }

  @Put()
  async put(@Body() body: unknown) {
    const raw = JSON.stringify(body ?? {});
    if (raw.length > 64_000) {
      throw new PayloadTooLargeException("user-context body too large");
    }
    try {
      const cfg = await this.nanobot.loadConfig();
      const root = cfg.tools?.workspaceRoot?.trim() || process.cwd();
      const data = body as UserContextData;
      if (data?.version !== 1) {
        throw new BadRequestException("version must be 1");
      }
      await core.saveUserContext(root, {
        version: 1,
        updatedAt: new Date().toISOString(),
        profile: data.profile,
        intent: data.intent
          ? { ...data.intent, updatedAt: data.intent.updatedAt ?? new Date().toISOString() }
          : undefined,
        preferences: data.preferences,
      });
      return (await core.loadUserContext(root)) ?? core.emptyUserContextForEditor();
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new InternalServerErrorException(e instanceof Error ? e.message : String(e));
    }
  }
}
