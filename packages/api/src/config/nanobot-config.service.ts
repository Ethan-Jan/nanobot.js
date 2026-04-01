import { Injectable } from "@nestjs/common";
import type { NanobotConfig } from "nanobot/api-lib";
import * as core from "nanobot/api-lib";

const ENV_FOR: Record<string, string[]> = {
  openrouter: ["OPENROUTER_API_KEY", "NANOBOT_OPENROUTER_API_KEY"],
  openai: ["OPENAI_API_KEY", "NANOBOT_OPENAI_API_KEY"],
  moonshot: ["MOONSHOT_API_KEY", "KIMI_API_KEY", "NANOBOT_MOONSHOT_API_KEY"],
};

function maskSecret(s: string | undefined): string {
  const t = s?.trim() ?? "";
  if (!t) return "";
  if (t.length <= 4) return "****";
  return `****${t.slice(-4)}`;
}

@Injectable()
export class NanobotConfigService {
  loadConfig(): Promise<NanobotConfig> {
    return core.loadConfig();
  }

  configPath(): string {
    return core.configPath();
  }

  mergeAndSave(patch: Partial<NanobotConfig>): Promise<NanobotConfig> {
    return core.mergeAndSave(patch);
  }

  hasEnvKey(providerId: string): boolean {
    for (const v of ENV_FOR[providerId] ?? []) {
      if (process.env[v]?.trim()) return true;
    }
    return false;
  }

  sanitizeConfig(cfg: NanobotConfig): NanobotConfig {
    const out = structuredClone(cfg);
    for (const p of Object.values(out.providers)) {
      if (p.apiKey?.trim()) p.apiKey = maskSecret(p.apiKey);
    }
    if (out.channels?.weixin?.token?.trim()) {
      out.channels.weixin.token = maskSecret(out.channels.weixin.token);
    }
    return out;
  }

  stripMaskedSecretsFromPatch(patch: Partial<NanobotConfig>): Partial<NanobotConfig> {
    const p = structuredClone(patch) as Partial<NanobotConfig>;
    if (p.providers) {
      for (const [id, pc] of Object.entries(p.providers)) {
        if (!pc) continue;
        const k = pc.apiKey?.trim();
        if (k?.startsWith("****")) delete (p.providers as Record<string, { apiKey?: string }>)[id]!.apiKey;
      }
    }
    const tok = p.channels?.weixin?.token?.trim();
    if (tok?.startsWith("****") && p.channels?.weixin) {
      delete p.channels.weixin.token;
    }
    return p;
  }
}
