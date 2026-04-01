import { Controller, Get, InternalServerErrorException } from "@nestjs/common";
import { NanobotConfigService } from "../config/nanobot-config.service";

@Controller()
export class StatusController {
  constructor(private readonly nanobot: NanobotConfigService) {}

  @Get("status")
  async status() {
    try {
      const cfg = await this.nanobot.loadConfig();
      const pathStr = this.nanobot.configPath();
      const providers: Record<
        string,
        { baseUrl?: string; hasKey: boolean; keyFromFile: boolean; keyFromEnv: boolean }
      > = {};
      for (const [id, p] of Object.entries(cfg.providers)) {
        const keyFromFile = Boolean(p.apiKey?.trim());
        const envKey = this.nanobot.hasEnvKey(id);
        providers[id] = {
          baseUrl: p.baseUrl,
          hasKey: keyFromFile || envKey,
          keyFromFile,
          keyFromEnv: envKey,
        };
      }
      return {
        configPath: pathStr,
        defaultProvider: cfg.agents.defaults.provider,
        defaultModel: cfg.agents.defaults.model,
        providers,
      };
    } catch (e) {
      throw new InternalServerErrorException(e instanceof Error ? e.message : String(e));
    }
  }
}
