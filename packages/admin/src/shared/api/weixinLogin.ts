export type WeixinQrStartResponse = { qrcode: string; scanPayload: string; qrDataUrl: string };

export type WeixinLoginPollResponse =
  | { status: "waiting" | "scaned" | "expired" }
  | { status: "confirmed"; saved: boolean };

export async function postWeixinLoginQr(force = false): Promise<WeixinQrStartResponse> {
  const r = await fetch("/api/weixin/login/qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
  if (!r.ok) {
    const raw = await r.text();
    let msg = raw;
    try {
      const j = JSON.parse(raw) as { message?: string | string[] };
      msg = Array.isArray(j.message) ? j.message.join(", ") : (j.message ?? raw);
    } catch {
      /* 保持 raw */
    }
    const err = new Error(msg) as Error & { status: number };
    err.status = r.status;
    throw err;
  }
  return r.json() as Promise<WeixinQrStartResponse>;
}

export async function getWeixinLoginPoll(qrcode: string): Promise<WeixinLoginPollResponse> {
  const r = await fetch(`/api/weixin/login/status?qrcode=${encodeURIComponent(qrcode)}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<WeixinLoginPollResponse>;
}
