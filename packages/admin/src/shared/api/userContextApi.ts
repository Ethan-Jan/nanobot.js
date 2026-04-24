import type { UserContextDTO } from "@/shared/types/userContext";

export async function getUserContext(): Promise<UserContextDTO> {
  const r = await fetch("/api/user-context");
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<UserContextDTO>;
}

export async function putUserContext(data: UserContextDTO): Promise<UserContextDTO> {
  const r = await fetch("/api/user-context", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<UserContextDTO>;
}
