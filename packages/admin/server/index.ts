/**
 * 管理 API + 生产环境静态资源（dist-web）。
 * 开发时仅起 API；前端由 Vite 代理 /api。
 */
import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NanobotConfig } from "../../nanobot/src/config";
import {
  configPath,
  loadConfig,
  mergeAndSave,
} from "../../nanobot/src/config";
import { runAgentWithHistory } from "../../nanobot/src/agent";

const ENV_FOR: Record<string, string[]> = {
  openrouter: ["OPENROUTER_API_KEY", "NANOBOT_OPENROUTER_API_KEY"],
  openai: ["OPENAI_API_KEY", "NANOBOT_OPENAI_API_KEY"],
  moonshot: ["MOONSHOT_API_KEY", "KIMI_API_KEY", "NANOBOT_MOONSHOT_API_KEY"],
};

function hasEnvKey(providerId: string): boolean {
  for (const v of ENV_FOR[providerId] ?? []) {
    if (process.env[v]?.trim()) return true;
  }
  return false;
}

function maskSecret(s: string | undefined): string {
  const t = s?.trim() ?? "";
  if (!t) return "";
  if (t.length <= 4) return "****";
  return `****${t.slice(-4)}`;
}

function sanitizeConfig(cfg: NanobotConfig): NanobotConfig {
  const out = structuredClone(cfg);
  for (const p of Object.values(out.providers)) {
    if (p.apiKey?.trim()) p.apiKey = maskSecret(p.apiKey);
  }
  if (out.channels?.weixin?.token?.trim()) {
    out.channels.weixin.token = maskSecret(out.channels.weixin.token);
  }
  return out;
}

function stripMaskedSecretsFromPatch(patch: Partial<NanobotConfig>): Partial<NanobotConfig> {
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

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const ch of req) chunks.push(ch as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function json(res: ServerResponse, code: number, body: unknown): void {
  const s = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(s),
  });
  res.end(s);
}

function text(res: ServerResponse, code: number, msg: string): void {
  res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(msg);
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function webRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "../dist-web");
}

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const root = webRoot();
  if (!existsSync(root)) return false;
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const file = join(root, pathname.replace(/^\/+/, ""));
  if (!file.startsWith(root)) return false;
  try {
    const st = await stat(file);
    if (st.isFile()) {
      const ext = extname(file);
      res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
      createReadStream(file).pipe(res);
      return true;
    }
  } catch {
    // fall through to SPA
  }
  try {
    const idx = join(root, "index.html");
    const html = await readFile(idx);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return true;
  } catch {
    return false;
  }
}

async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;

  if (path === "/api/health" && req.method === "GET") {
    json(res, 200, { ok: true });
    return true;
  }

  if (path === "/api/status" && req.method === "GET") {
    try {
      const cfg = await loadConfig();
      const pathStr = configPath();
      const providers: Record<
        string,
        { baseUrl?: string; hasKey: boolean; keyFromFile: boolean; keyFromEnv: boolean }
      > = {};
      for (const [id, p] of Object.entries(cfg.providers)) {
        const keyFromFile = Boolean(p.apiKey?.trim());
        const envKey = hasEnvKey(id);
        providers[id] = {
          baseUrl: p.baseUrl,
          hasKey: keyFromFile || envKey,
          keyFromFile,
          keyFromEnv: envKey,
        };
      }
      json(res, 200, {
        configPath: pathStr,
        defaultProvider: cfg.agents.defaults.provider,
        defaultModel: cfg.agents.defaults.model,
        providers,
      });
    } catch (e) {
      json(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }

  if (path === "/api/config" && req.method === "GET") {
    try {
      const cfg = await loadConfig();
      json(res, 200, sanitizeConfig(cfg));
    } catch (e) {
      json(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }

  if (path === "/api/config" && req.method === "PUT") {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as Partial<NanobotConfig>;
      const cleaned = stripMaskedSecretsFromPatch(parsed);
      const next = await mergeAndSave(cleaned);
      json(res, 200, sanitizeConfig(next));
    } catch (e) {
      json(res, 400, { error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }

  if (path === "/api/chat" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      if (raw.length > 512_000) {
        json(res, 413, { error: "Request body too large" });
        return true;
      }
      const body = JSON.parse(raw) as { messages?: unknown };
      const msgs = body.messages;
      if (!Array.isArray(msgs) || msgs.length === 0) {
        json(res, 400, { error: "messages must be a non-empty array" });
        return true;
      }
      const last = msgs[msgs.length - 1] as { role?: string; content?: string };
      if (last?.role !== "user" || typeof last.content !== "string" || !last.content.trim()) {
        json(res, 400, { error: "last message must be role=user with non-empty content" });
        return true;
      }
      const prior: { role: "user" | "assistant"; content: string }[] = [];
      for (let i = 0; i < msgs.length - 1; i++) {
        const m = msgs[i] as { role?: string; content?: string };
        if ((m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
          json(res, 400, { error: `messages[${i}] must be user|assistant with string content` });
          return true;
        }
        prior.push({ role: m.role, content: m.content });
      }
      const cfg = await loadConfig();
      const reply = await runAgentWithHistory(cfg, prior, last.content.trim(), {
        sessionKey: "admin:web",
        allowShell: false,
      });
      json(res, 200, { reply });
    } catch (e) {
      json(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }

  return false;
}

const port = Number(process.env.ADMIN_PORT ?? process.env.PORT ?? "18791");

const server = createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api")) {
      const done = await handleApi(req, res);
      if (done) return;
      text(res, 404, "Not found");
      return;
    }
    if (req.method === "GET") {
      const ok = await serveStatic(req, res);
      if (ok) return;
    }
    text(res, 404, "Not found");
  } catch (e) {
    text(res, 500, e instanceof Error ? e.message : String(e));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.error(`[nanobot-admin] API + static listening on http://127.0.0.1:${port}`);
});
