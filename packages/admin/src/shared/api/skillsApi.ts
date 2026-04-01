import type { SkillManifest, GitHubSkillInfo } from "@/shared/types";

export async function getSkills(): Promise<SkillManifest[]> {
  const r = await fetch("/api/skills");
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `HTTP ${r.status}`);
  }
  const data = (await r.json()) as { skills: SkillManifest[] };
  return data.skills;
}

export async function getSkillDetail(name: string): Promise<SkillManifest> {
  const r = await fetch(`/api/skills/${encodeURIComponent(name)}`);
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `HTTP ${r.status}`);
  }
  return r.json() as Promise<SkillManifest>;
}

export async function importSkillFromGitHub(url: string): Promise<void> {
  const r = await fetch("/api/skills/import/github", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!r.ok) {
    const text = await r.text();
    let msg = text;
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      msg = Array.isArray(j.message) ? j.message.join(", ") : (j.message ?? text);
    } catch {
      /* keep */
    }
    throw new Error(msg || `HTTP ${r.status}`);
  }
}

export async function deleteSkill(name: string): Promise<void> {
  const r = await fetch(`/api/skills/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `HTTP ${r.status}`);
  }
}

export async function reloadSkills(): Promise<void> {
  const r = await fetch("/api/skills/reload", {
    method: "POST",
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `HTTP ${r.status}`);
  }
}

/** broad=true 时不限 topic:nanobot-skill（任意仓库，需自行辨别） */
export async function searchGitHubSkills(query: string, broad = false): Promise<GitHubSkillInfo[]> {
  const q = new URLSearchParams({ q: query });
  if (broad) q.set("broad", "1");
  const r = await fetch(`/api/skills/search/github?${q.toString()}`);
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `HTTP ${r.status}`);
  }
  const data = (await r.json()) as { results: GitHubSkillInfo[] };
  return data.results;
}
