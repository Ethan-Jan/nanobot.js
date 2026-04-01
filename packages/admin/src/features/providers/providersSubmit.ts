import type { NanobotConfigDTO } from "@/shared/types";

export type ProvidersFormShape = {
  defaults: { model: string; provider: string };
  providers: Record<string, { baseUrl?: string; apiKey?: string }>;
};

export function buildProvidersPutPayload(
  cfg: NanobotConfigDTO,
  values: ProvidersFormShape,
): Record<string, unknown> {
  const nextProviders: Record<string, { apiKey?: string; baseUrl?: string }> = {};
  for (const id of Object.keys(cfg.providers)) {
    const prev = cfg.providers[id];
    const row = values.providers[id] ?? {};
    const baseUrl = row.baseUrl !== undefined ? row.baseUrl : prev.baseUrl;
    const entry: { apiKey?: string; baseUrl?: string } = { baseUrl };
    if (row.apiKey !== undefined && row.apiKey.trim() !== "") {
      entry.apiKey = row.apiKey.trim();
    }
    nextProviders[id] = entry;
  }
  return {
    agents: { defaults: values.defaults },
    providers: nextProviders,
  };
}

export function configToProvidersForm(c: NanobotConfigDTO): ProvidersFormShape {
  const providers: Record<string, { baseUrl?: string; apiKey?: string }> = {};
  for (const [id, p] of Object.entries(c.providers)) {
    providers[id] = { baseUrl: p.baseUrl, apiKey: "" };
  }
  return {
    defaults: { ...c.agents.defaults },
    providers,
  };
}
