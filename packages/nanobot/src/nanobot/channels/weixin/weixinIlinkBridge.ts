/**
 * 个人微信 iLink 桥接：扫码登录、长轮询 getUpdates、文本入站 → LLM → sendmessage。
 *
 * 协议与上游 `nanobot/channels/weixin.py` 一致（ilinkai.weixin.qq.com）。
 * 当前实现：**文本消息**端到端；图片/语音/文件等会跳过或仅提示（未做 CDN AES 解密）。
 */

import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { type NanobotConfig } from "../../../config.js";
import { runAgentMessage } from "../../../agent.js";
import {
  loadAccountState,
  saveAccountState,
  defaultStateDir,
  type WeixinAccountState,
} from "./accountState.js";
import {
  BASE_INFO,
  ERRCODE_SESSION_EXPIRED,
  ITEM_TEXT,
  MESSAGE_TYPE_BOT,
  MESSAGE_STATE_FINISH,
  MESSAGE_TYPE_USER,
  SESSION_PAUSE_MS,
  WEIXIN_MAX_MESSAGE_LEN,
  DEFAULT_LONG_POLL_TIMEOUT_S,
  MAX_QR_REFRESH,
} from "./constants.js";
import { buildHeaders, ilinkGet, ilinkPost } from "./ilinkHttp.js";
import { mergedWeixinConfig, type MergedWeixinChannelConfig } from "./weixinMerge.js";

export type { MergedWeixinChannelConfig };
export { mergedWeixinConfig } from "./weixinMerge.js";

/** 轮询错误、收消息等详细日志；默认关闭，仅启动时一条 channel 状态 */
function weixinVerbose(): boolean {
  const v = process.env.NANOBOT_WEIXIN_VERBOSE?.trim();
  return v === "1" || /^true$/i.test(v ?? "");
}

function splitMessage(text: string, maxLen: number): string[] {
  const chars = [...text];
  const chunks: string[] = [];
  for (let i = 0; i < chars.length; i += maxLen) {
    chunks.push(chars.slice(i, i + maxLen).join(""));
  }
  return chunks.length ? chunks : [""];
}

export class WeixinIlinkBridge {
  private readonly wx: MergedWeixinChannelConfig;
  private readonly stateDir: string;
  private token = "";
  private getUpdatesBuf = "";
  private contextTokens: Record<string, string> = {};
  private baseUrl: string;
  private nextPollTimeoutS = DEFAULT_LONG_POLL_TIMEOUT_S;
  private sessionPauseUntil = 0;
  private readonly processedIds = new Map<string, true>();
  private running = false;
  /** 微信侧触发的 Agent 是否允许 shell（默认关，更安全） */
  private agentAllowShell = false;

  constructor(private readonly appConfig: NanobotConfig) {
    this.wx = mergedWeixinConfig(appConfig);
    this.stateDir = defaultStateDir(this.wx);
    this.baseUrl = this.wx.base_url;
  }

  /** 终端打印二维码：数据为可扫码的 URL 或上游返回的标识串 */
  private async printQrToTerminal(data: string): Promise<void> {
    const payload = data.trim();
    try {
      const ascii = await QRCode.toString(payload, { type: "utf8" });
      console.log(ascii);
    } catch {
      console.log("\n[weixin] 无法用终端绘制二维码，原始数据：\n", payload, "\n");
    }
  }

  private headers(auth: boolean, extra?: Record<string, string>): Record<string, string> {
    return buildHeaders(this.token, {
      auth,
      routeTag: this.wx.route_tag,
      extra,
    });
  }

  private async loadFromDisk(): Promise<boolean> {
    const st = await loadAccountState(this.stateDir);
    if (!st) return false;
    this.token = st.token;
    this.getUpdatesBuf = st.get_updates_buf;
    this.contextTokens = { ...st.context_tokens };
    if (st.base_url) this.baseUrl = st.base_url;
    return true;
  }

  private async persist(): Promise<void> {
    const st: WeixinAccountState = {
      token: this.token,
      get_updates_buf: this.getUpdatesBuf,
      context_tokens: this.contextTokens,
      base_url: this.baseUrl,
    };
    await saveAccountState(this.stateDir, st);
  }

  /**
   * 扫码登录。成功后将 token 写入 `account.json`。
   */
  async login(opts: { force?: boolean } = {}): Promise<boolean> {
    if (opts.force) {
      this.token = "";
      this.getUpdatesBuf = "";
      this.contextTokens = {};
    }

    if (!opts.force && this.wx.token) {
      this.token = this.wx.token;
      this.baseUrl = this.wx.base_url;
      await this.persist();
      console.log("[weixin] 已使用 nanobot.config.json 中的 channels.weixin.token");
      return true;
    }

    if (!opts.force && (await this.loadFromDisk())) {
      console.log(`[weixin] 已加载已保存登录态：${this.stateDir}`);
      return true;
    }

    const timeoutMs = 60_000;
    let refresh = 0;
    let qrcodeId = "";
    let scanPayload = "";

    const fetchQr = async (): Promise<void> => {
      const data = (await ilinkGet(
        this.baseUrl,
        "ilink/bot/get_bot_qrcode",
        { bot_type: "3" },
        timeoutMs,
        this.headers(false),
      )) as Record<string, unknown>;
      qrcodeId = String(data.qrcode ?? "");
      const img = String(data.qrcode_img_content ?? "");
      scanPayload = img || qrcodeId;
      if (!qrcodeId) throw new Error(`get_bot_qrcode 异常：${JSON.stringify(data)}`);
      console.log("[weixin] 请使用微信扫描下方二维码（个人微信通道）\n");
      await this.printQrToTerminal(scanPayload);
    };

    await fetchQr();
    console.log("[weixin] 等待扫码确认…\n");

    for (;;) {
      await new Promise((r) => setTimeout(r, 1000));
      let statusData: Record<string, unknown>;
      try {
        statusData = (await ilinkGet(
          this.baseUrl,
          "ilink/bot/get_qrcode_status",
          { qrcode: qrcodeId },
          timeoutMs,
          this.headers(false, { "iLink-App-ClientVersion": "1" }),
        )) as Record<string, unknown>;
      } catch {
        continue;
      }

      const status = String(statusData.status ?? "");
      if (status === "confirmed") {
        const tok = String(statusData.bot_token ?? "");
        const bu = String(statusData.baseurl ?? "");
        if (!tok) {
          console.error("[weixin] 已确认但未返回 bot_token");
          return false;
        }
        this.token = tok;
        if (bu) this.baseUrl = bu;
        await this.persist();
        console.log("[weixin] 登录成功，状态已写入", this.stateDir);
        return true;
      }
      if (status === "scaned") {
        console.log("[weixin] 已扫码，等待确认…");
      }
      if (status === "expired") {
        refresh += 1;
        if (refresh > MAX_QR_REFRESH) {
          console.error("[weixin] 二维码多次过期，放弃");
          return false;
        }
        console.log("[weixin] 二维码过期，刷新…");
        await fetchQr();
      }
    }
  }

  private pauseSession(): void {
    this.sessionPauseUntil = Date.now() + SESSION_PAUSE_MS;
  }

  private sessionPauseRemainingMs(): number {
    return Math.max(0, this.sessionPauseUntil - Date.now());
  }

  private rememberProcessed(id: string): boolean {
    if (this.processedIds.has(id)) return false;
    this.processedIds.set(id, true);
    while (this.processedIds.size > 1000) {
      const first = this.processedIds.keys().next().value as string | undefined;
      if (first === undefined) break;
      this.processedIds.delete(first);
    }
    return true;
  }

  /**
   * 解析入站消息中的纯文本（跳过非 text item）。
   */
  private extractTextContent(msg: Record<string, unknown>): string {
    const items = (msg.item_list as unknown[]) ?? [];
    const parts: string[] = [];
    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      const type = Number(item.type ?? 0);
      if (type === ITEM_TEXT) {
        const ti = (item.text_item as Record<string, unknown>) ?? {};
        const text = String(ti.text ?? "");
        if (text) parts.push(text);
      }
      /* 非文本 item 暂不送入 Agent（上游会下载 CDN + AES；见 weixin.py _download_media_item） */
    }
    return parts.join("\n").trim();
  }

  private async sendText(toUserId: string, text: string, contextToken: string): Promise<void> {
    const clientId = `nanobot-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const itemList = [{ type: ITEM_TEXT, text_item: { text } }];
    const weixinMsg: Record<string, unknown> = {
      from_user_id: "",
      to_user_id: toUserId,
      client_id: clientId,
      message_type: MESSAGE_TYPE_BOT,
      message_state: MESSAGE_STATE_FINISH,
      item_list: itemList,
      context_token: contextToken,
    };
    const data = (await ilinkPost(
      this.baseUrl,
      "ilink/bot/sendmessage",
      { msg: weixinMsg, base_info: BASE_INFO },
      (this.nextPollTimeoutS + 10) * 1000,
      this.headers(true),
    )) as Record<string, unknown>;
    const errcode = Number(data.errcode ?? 0);
    if (errcode !== 0 && weixinVerbose()) {
      console.error("[weixin] sendmessage err:", errcode, data.errmsg);
    }
  }

  private async handleInboundText(
    fromUserId: string,
    text: string,
    contextFromThisMessage?: string,
  ): Promise<void> {
    const allow = this.wx.allow_from;
    if (allow.length > 0 && !allow.includes(fromUserId)) {
      console.warn(`[weixin] 已忽略来自 ${fromUserId} 的消息（不在 channels.weixin.allow_from 白名单）`);
      return;
    }

    const ctx =
      (contextFromThisMessage?.trim() || this.contextTokens[fromUserId] || "").trim() || undefined;
    if (!ctx) {
      console.warn(
        `[weixin] 缺少 context_token，无法回复 from=${fromUserId}。调试请设 NANOBOT_WEIXIN_VERBOSE=1。`,
      );
      return;
    }

    if (weixinVerbose()) console.log(`[weixin] → Agent：from=${fromUserId} len=${text.length}`);
    let reply: string;
    try {
      reply = await runAgentMessage(this.appConfig, text, {
        allowShell: this.agentAllowShell,
        sessionKey: `weixin:${fromUserId}`,
      });
    } catch (e) {
      reply = `（Agent 出错）${e instanceof Error ? e.message : String(e)}`;
    }

    for (const chunk of splitMessage(reply, WEIXIN_MAX_MESSAGE_LEN)) {
      await this.sendText(fromUserId, chunk, ctx);
    }
  }

  private async processOneMessage(msg: Record<string, unknown>): Promise<void> {
    if (msg.message_type === MESSAGE_TYPE_BOT) return;

    const msgId = String(msg.message_id ?? msg.seq ?? "");
    const fromUser = String(msg.from_user_id ?? "");
    const idKey = msgId || `${fromUser}_${msg.create_time_ms ?? ""}`;
    if (!this.rememberProcessed(idKey)) return;
    if (!fromUser) return;

    const ctxTok = String(msg.context_token ?? "").trim();
    if (ctxTok) {
      this.contextTokens[fromUser] = ctxTok;
      await this.persist();
    }

    const content = this.extractTextContent(msg);
    if (!content) return;

    await this.handleInboundText(fromUser, content, ctxTok || undefined);
  }

  private async pollOnce(): Promise<void> {
    const waitMs = this.sessionPauseRemainingMs();
    if (waitMs > 0) {
      if (weixinVerbose()) {
        console.log(`[weixin] 会话冷却中，约 ${Math.ceil(waitMs / 60000)} 分钟后再轮询`);
      }
      await new Promise((r) => setTimeout(r, waitMs));
      return;
    }

    const timeoutMs = (this.nextPollTimeoutS + 10) * 1000;
    const data = (await ilinkPost(
      this.baseUrl,
      "ilink/bot/getupdates",
      { get_updates_buf: this.getUpdatesBuf, base_info: BASE_INFO },
      timeoutMs,
      this.headers(true),
    )) as Record<string, unknown>;

    const ret = data.ret;
    const errcode = Number(data.errcode ?? 0);
    const retNum = ret === undefined || ret === null ? 0 : Number(ret);
    const bad =
      (ret !== undefined && ret !== null && retNum !== 0) || (data.errcode !== undefined && errcode !== 0);
    if (bad) {
      if (errcode === ERRCODE_SESSION_EXPIRED || retNum === ERRCODE_SESSION_EXPIRED) {
        if (weixinVerbose()) console.warn("[weixin] 会话过期 err -14，进入冷却");
        this.pauseSession();
        return;
      }
      throw new Error(`getupdates failed ret=${ret} errcode=${errcode} errmsg=${data.errmsg}`);
    }

    const serverMs = data.longpolling_timeout_ms as number | undefined;
    if (serverMs && serverMs > 0) {
      this.nextPollTimeoutS = Math.max(Math.floor(serverMs / 1000), 5);
    }

    const newBuf = String(data.get_updates_buf ?? "");
    if (newBuf) {
      this.getUpdatesBuf = newBuf;
      await this.persist();
    }

    const msgs = (data.msgs as unknown[]) ?? [];
    for (const m of msgs) {
      try {
        await this.processOneMessage(m as Record<string, unknown>);
      } catch (e) {
        if (weixinVerbose()) console.error("[weixin] 处理消息失败:", e);
      }
    }
  }

  /** 结束长轮询（与 SIGINT、REPL exit 共用） */
  stop(): void {
    this.running = false;
  }

  /**
   * 长轮询直到 stop() 或 SIGINT。需已登录（config.token 或 account.json）。
   * `embedded`：与 `agent` REPL 同进程并联时少打重复提示。
   */
  async runLoop(opts: { allowShell?: boolean; embedded?: boolean } = {}): Promise<void> {
    this.agentAllowShell = opts.allowShell === true;

    if (this.wx.token) {
      this.token = this.wx.token;
    } else if (!(await this.loadFromDisk())) {
      throw new Error("未登录：先执行 nanobot channels weixin login");
    }

    this.running = true;
    const withRepl = opts.embedded ? "，与终端 REPL 并联（exit 停止轮询）" : "";
    console.log(
      `[weixin] channel: long-poll ready baseUrl=${this.baseUrl} timeout≈${this.nextPollTimeoutS}s${withRepl} | 详细日志: NANOBOT_WEIXIN_VERBOSE=1`,
    );

    const onSig = () => {
      this.stop();
      if (weixinVerbose()) console.log("\n[weixin] 停止中…");
    };
    process.on("SIGINT", onSig);

    try {
      while (this.running) {
        try {
          await this.pollOnce();
        } catch (e) {
          if (!this.running) break;
          if (weixinVerbose()) console.error("[weixin] poll 错误:", e);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } finally {
      process.off("SIGINT", onSig);
      await this.persist();
    }
  }
}
