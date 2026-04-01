/**
 * write_file 安全：禁止覆盖常见密钥/会话路径（与路径穿越检查独立）。
 */

export function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\/+/, "").trim();
}

/** true = 拒绝写入 */
export function isWritePathBlocked(relPath: string): boolean {
  const p = normalizeRelPath(relPath).toLowerCase();
  if (!p) return true;

  const segs = p.split("/").filter(Boolean);
  for (const s of segs) {
    if (s === ".env") return true;
    if (s.startsWith(".env.") && s !== ".env.example") return true;
  }

  const base = segs[segs.length - 1] ?? "";
  if (base === "id_rsa" || base === "id_ecdsa" || base === "id_ed25519") return true;

  if (p.includes(".nanobot-runtime/weixin/account.json")) return true;

  if (/\.(pem|p12|pfx)$/i.test(base)) return true;

  return false;
}
