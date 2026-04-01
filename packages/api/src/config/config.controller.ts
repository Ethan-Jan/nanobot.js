import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Put,
} from "@nestjs/common";
import type { NanobotConfig } from "nanobot/api-lib";
import { NanobotConfigService } from "./nanobot-config.service";

@Controller("config")
export class ConfigController {
  constructor(private readonly nanobot: NanobotConfigService) {}

  @Get()
  async get() {
    try {
      const cfg = await this.nanobot.loadConfig();
      return this.nanobot.sanitizeConfig(cfg);
    } catch (e) {
      throw new InternalServerErrorException(e instanceof Error ? e.message : String(e));
    }
  }

  @Put()
  async put(@Body() body: unknown) {
    try {
      const parsed = body as Partial<NanobotConfig>;
      const cleaned = this.nanobot.stripMaskedSecretsFromPatch(parsed);
      const next = await this.nanobot.mergeAndSave(cleaned);
      return this.nanobot.sanitizeConfig(next);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : String(e));
    }
  }
}
