/**
 * iLink HTTP 客户端：请求头、GET/POST 与上游 `_api_get` / `_api_post` 一致。
 */

import { randomBytes } from "node:crypto";
import { BASE_INFO } from "./constants.js";

/** 与 Python `_random_wechat_uin` 一致：随机 uint32 → 十进制字符串 → base64 */
export function randomWechatUin(): string {
  const u32 = randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(u32), "utf8").toString("base64");
}

export function buildHeaders(
  token: string,
  opts: { auth: boolean; routeTag?: string | number | null; extra?: Record<string, string> },
): Record<string, string> {
  const h: Record<string, string> = {
    "X-WECHAT-UIN": randomWechatUin(),
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
  };
  if (opts.auth && token) {
    h.Authorization = `Bearer ${token}`;
  }
  if (opts.routeTag !== undefined && opts.routeTag !== null && String(opts.routeTag).trim()) {
    h.SKRouteTag = String(opts.routeTag).trim();
  }
  if (opts.extra) Object.assign(h, opts.extra);
  return h;
}

export async function ilinkGet(
  baseUrl: string,
  path: string,
  params: Record<string, string>,
  timeoutMs: number,
  headers: Record<string, string>,
): Promise<unknown> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const u = new URL(path.replace(/^\//, ""), base);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  const res = await fetch(u.toString(), {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`iLink GET ${u.pathname} → ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<unknown>;
}

export async function ilinkPost(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  headers: Record<string, string>,
): Promise<unknown> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(path.replace(/^\//, ""), base);
  const payload = { ...body };
  if (!("base_info" in payload)) {
    (payload as Record<string, unknown>).base_info = BASE_INFO;
  }
  const res = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`iLink POST ${url.pathname} → ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<unknown>;
}
