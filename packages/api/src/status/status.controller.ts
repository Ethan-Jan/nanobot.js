import { Controller, Get, InternalServerErrorException } from "@nestjs/common";
import * as core from "nanobot/api-lib";
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
      const wx = cfg.channels?.weixin;
      const baseUrl =
        typeof wx?.base_url === "string" ? wx.base_url.trim() || undefined : undefined;
      const allowFrom = wx?.allow_from;
      const allowFromCount = Array.isArray(allowFrom) ? allowFrom.length : 0;
      const stateDir =
        typeof wx?.state_dir === "string" ? wx.state_dir.trim() || undefined : undefined;
      const hasToken = await core.weixinHasPersistedToken(cfg);
      const channels = {
        weixin: wx
          ? {
              enabled: Boolean(wx.enabled),
              hasToken,
              baseUrl,
              allowFromCount,
              stateDir,
              pollTimeout: typeof wx.poll_timeout === "number" ? wx.poll_timeout : undefined,
            }
          : undefined,
      };
      return {
        configPath: pathStr,
        defaultProvider: cfg.agents.defaults.provider,
        defaultModel: cfg.agents.defaults.model,
        providers,
        channels,
      };
    } catch (e) {
      throw new InternalServerErrorException(e instanceof Error ? e.message : String(e));
    }
  }
}
