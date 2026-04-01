/**
 * B 端 / HTTP 用的微信扫码登录：拉二维码、轮询状态、写入 account.json。
 */

import QRCode from "qrcode";
import type { NanobotConfig } from "../../../config.js";
import {
  accountJsonPath,
  defaultStateDir,
  loadAccountState,
  saveAccountState,
} from "./accountState.js";
import { buildHeaders, ilinkGet } from "./ilinkHttp.js";
import { mergedWeixinConfig } from "./weixinMerge.js";
import { unlink } from "node:fs/promises";

const QR_TIMEOUT_MS = 60_000;

export async function weixinHasPersistedToken(cfg: NanobotConfig): Promise<boolean> {
  const wx = mergedWeixinConfig(cfg);
  if (wx.token.trim()) return true;
  const st = await loadAccountState(defaultStateDir(wx));
  return Boolean(st?.token?.trim());
}

export type WeixinQrStartResult = {
  qrcode: string;
  /** 用于生成二维码的内容（与终端 login 一致） */
  scanPayload: string;
  /** PNG data URL，管理端可直接 <img src=…> */
  qrDataUrl: string;
};

export async function startWeixinQrSession(
  cfg: NanobotConfig,
  opts: { force?: boolean } = {},
): Promise<WeixinQrStartResult> {
  const wx = mergedWeixinConfig(cfg);
  const stateDir = defaultStateDir(wx);
  if (opts.force) {
    try {
      await unlink(accountJsonPath(stateDir));
    } catch {
      /* 不存在则忽略 */
    }
  } else {
    if (wx.token.trim()) {
      throw new Error("已在 nanobot.config.json 中配置 channels.weixin.token；重新扫码请传 force: true");
    }
    const disk = await loadAccountState(stateDir);
    if (disk?.token?.trim()) {
      throw new Error("已有本机登录态（account.json）；重新扫码请传 force: true");
    }
  }

  const baseUrl = wx.base_url;
  const data = (await ilinkGet(
    baseUrl,
    "ilink/bot/get_bot_qrcode",
    { bot_type: "3" },
    QR_TIMEOUT_MS,
    buildHeaders("", { auth: false, routeTag: wx.route_tag }),
  )) as Record<string, unknown>;

  const qrcode = String(data.qrcode ?? "");
  const img = String(data.qrcode_img_content ?? "");
  const scanPayload = (img || qrcode).trim();
  if (!qrcode) throw new Error(`get_bot_qrcode 异常：${JSON.stringify(data)}`);

  let qrDataUrl: string;
  try {
    qrDataUrl = await QRCode.toDataURL(scanPayload, { margin: 2, width: 280, errorCorrectionLevel: "M" });
  } catch {
    qrDataUrl = await QRCode.toDataURL(qrcode, { margin: 2, width: 280, errorCorrectionLevel: "M" });
  }

  return { qrcode, scanPayload, qrDataUrl };
}

export type WeixinQrPollResult =
  | { status: "waiting" | "scaned" | "expired" }
  | { status: "confirmed"; saved: true };

export async function pollWeixinQrAndMaybeSave(
  cfg: NanobotConfig,
  qrcodeId: string,
): Promise<WeixinQrPollResult> {
  const wx = mergedWeixinConfig(cfg);
  const baseUrl = wx.base_url;

  const statusData = (await ilinkGet(
    baseUrl,
    "ilink/bot/get_qrcode_status",
    { qrcode: qrcodeId },
    QR_TIMEOUT_MS,
    buildHeaders("", { auth: false, routeTag: wx.route_tag, extra: { "iLink-App-ClientVersion": "1" } }),
  )) as Record<string, unknown>;

  const status = String(statusData.status ?? "");
  if (status === "confirmed") {
    const tok = String(statusData.bot_token ?? "");
    const bu = String(statusData.baseurl ?? "").trim();
    if (!tok) throw new Error("已确认但未返回 bot_token");

    const stateDir = defaultStateDir(wx);
    await saveAccountState(stateDir, {
      token: tok,
      get_updates_buf: "",
      context_tokens: {},
      base_url: bu || undefined,
    });
    return { status: "confirmed", saved: true };
  }
  if (status === "scaned") return { status: "scaned" };
  if (status === "expired") return { status: "expired" };
  return { status: "waiting" };
}
