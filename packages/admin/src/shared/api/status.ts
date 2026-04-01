export type StatusPayload = {
  configPath: string;
  defaultProvider: string;
  defaultModel: string;
  providers: Record<
    string,
    {
      baseUrl?: string;
      hasKey: boolean;
      keyFromFile: boolean;
      keyFromEnv: boolean;
    }
  >;
  channels?: {
    weixin?: {
      enabled: boolean;
      hasToken: boolean;
      baseUrl?: string;
      allowFromCount: number;
      stateDir?: string;
      pollTimeout?: number;
    };
  };
};

export async function getStatus(): Promise<StatusPayload> {
  const r = await fetch("/api/status");
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<StatusPayload>;
}
