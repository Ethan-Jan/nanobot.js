import type { NanobotConfigDTO } from "@/shared/types";

export async function getConfig(): Promise<NanobotConfigDTO> {
  const r = await fetch("/api/config");
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<NanobotConfigDTO>;
}

export async function putConfig(patch: Record<string, unknown>): Promise<NanobotConfigDTO> {
  const r = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<NanobotConfigDTO>;
}
