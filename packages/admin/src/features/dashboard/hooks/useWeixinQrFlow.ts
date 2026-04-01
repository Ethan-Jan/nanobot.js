import { useEffect, useRef, useState } from "react";
import { App } from "antd";
import { getWeixinLoginPoll, postWeixinLoginQr, type WeixinQrStartResponse } from "@/shared/api";
import { MSG_KEY_WEIXIN_QR } from "../constants";

type Options = {
  onLoginConfirmed: () => void | Promise<void>;
};

export function useWeixinQrFlow({ onLoginConfirmed }: Options) {
  const { message, modal } = App.useApp();
  const messageRef = useRef(message);
  messageRef.current = message;

  const [qrOpen, setQrOpen] = useState(false);
  const [qrSession, setQrSession] = useState<WeixinQrStartResponse | null>(null);
  const [qrHint, setQrHint] = useState("请使用微信扫描下方二维码");
  const [qrLoading, setQrLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollHandledRef = useRef(false);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!qrOpen || !qrSession) {
      stopPoll();
      return;
    }
    pollHandledRef.current = false;
    messageRef.current.destroy(MSG_KEY_WEIXIN_QR);

    const tick = () => {
      if (pollHandledRef.current) return;
      void (async () => {
        if (pollHandledRef.current) return;
        try {
          const s = await getWeixinLoginPoll(qrSession.qrcode);
          if (pollHandledRef.current) return;

          if (s.status === "scaned") {
            setQrHint("已扫码，请在手机上确认登录");
            return;
          }
          if (s.status === "expired") {
            pollHandledRef.current = true;
            stopPoll();
            messageRef.current.warning({
              content: "二维码已过期，请关闭后重新获取",
              key: MSG_KEY_WEIXIN_QR,
            });
            return;
          }
          if (s.status === "confirmed") {
            pollHandledRef.current = true;
            stopPoll();
            messageRef.current.success({
              content: "已关联微信，token 已写入本机 .nanobot-runtime/weixin/account.json",
              key: MSG_KEY_WEIXIN_QR,
            });
            setQrOpen(false);
            setQrSession(null);
            await onLoginConfirmed();
          }
        } catch (e) {
          if (pollHandledRef.current) return;
          pollHandledRef.current = true;
          stopPoll();
          messageRef.current.error({
            content: e instanceof Error ? e.message : String(e),
            key: MSG_KEY_WEIXIN_QR,
          });
        }
      })();
    };

    tick();
    pollRef.current = setInterval(tick, 1500);
    return () => {
      stopPoll();
    };
  }, [qrOpen, qrSession, onLoginConfirmed]);

  const closeModal = () => {
    stopPoll();
    setQrOpen(false);
    setQrSession(null);
  };

  const startQr = async (force: boolean) => {
    setQrLoading(true);
    try {
      const r = await postWeixinLoginQr(force);
      setQrSession(r);
      setQrHint("请使用微信扫描下方二维码");
      setQrOpen(true);
    } catch (e) {
      const errObj = e as Error & { status?: number };
      if (errObj.status === 409) {
        modal.confirm({
          title: "已有登录态",
          content: "将删除本机 account.json 并重新扫码，是否继续？",
          okText: "重新扫码",
          cancelText: "取消",
          onOk: () => startQr(true),
        });
      } else {
        message.error(errObj.message || String(e));
      }
    } finally {
      setQrLoading(false);
    }
  };

  return {
    qrOpen,
    qrSession,
    qrHint,
    qrLoading,
    startQr,
    closeModal,
  };
}
