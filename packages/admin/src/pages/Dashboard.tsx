import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Image,
  Modal,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { getStatus, getWeixinLoginPoll, postWeixinLoginQr } from "../api";
import type { StatusPayload, WeixinQrStartResponse } from "../api";

const MSG_KEY_WEIXIN_QR = "weixin-qr-flow";

export default function Dashboard() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSession, setQrSession] = useState<WeixinQrStartResponse | null>(null);
  const [qrHint, setQrHint] = useState("请使用微信扫描下方二维码");
  const [qrLoading, setQrLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** 避免多路并发轮询在 confirmed 后仍各自弹 message */
  const pollHandledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getStatus();
        if (!cancelled) setData(s);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    message.destroy(MSG_KEY_WEIXIN_QR);

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
            message.warning({
              content: "二维码已过期，请关闭后重新获取",
              key: MSG_KEY_WEIXIN_QR,
            });
            return;
          }
          if (s.status === "confirmed") {
            pollHandledRef.current = true;
            stopPoll();
            message.success({
              content: "已关联微信，token 已写入本机 .nanobot-runtime/weixin/account.json",
              key: MSG_KEY_WEIXIN_QR,
            });
            setQrOpen(false);
            setQrSession(null);
            try {
              const s2 = await getStatus();
              setData(s2);
            } catch {
              /* ignore */
            }
          }
        } catch (e) {
          if (pollHandledRef.current) return;
          pollHandledRef.current = true;
          stopPoll();
          message.error({
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
  }, [qrOpen, qrSession]);

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
        Modal.confirm({
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

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (err) {
    return (
      <Alert
        type="error"
        showIcon
        title="无法连接管理 API"
        description={
          <>
            <Typography.Paragraph>{err}</Typography.Paragraph>
            <Typography.Text type="secondary">
              请先在本目录执行 <code>pnpm dev</code>，并确保 API 监听 18791（Vite 会将 /api 代理到该端口）。
            </Typography.Text>
          </>
        }
      />
    );
  }

  if (!data) return null;

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        运行概览
      </Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="默认 Agent">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="配置文件">{data.configPath}</Descriptions.Item>
              <Descriptions.Item label="默认供应商">{data.defaultProvider}</Descriptions.Item>
              <Descriptions.Item label="默认模型">{data.defaultModel}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="供应商密钥状态">
            <Descriptions column={1} size="small" bordered>
              {Object.entries(data.providers).map(([id, p]) => (
                <Descriptions.Item key={id} label={id}>
                  <Tag color={p.hasKey ? "success" : "default"}>
                    {p.hasKey ? "已配置" : "缺少密钥"}
                  </Tag>
                  {p.keyFromFile ? <Tag>文件</Tag> : null}
                  {p.keyFromEnv ? <Tag>环境变量</Tag> : null}
                  <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                    {p.baseUrl ?? ""}
                  </Typography.Text>
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24}>
          <Card title="通道 (Channels)">
            {data.channels?.weixin ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                title="微信要能自动回复，终端里必须有长轮询进程"
                description={
                  <>
                    「已启用 / 已配置 token」只说明配置和本机登录文件就绪，不等于正在收消息。请在本机运行{" "}
                    <Typography.Text code>pnpm dev:all</Typography.Text> 或{" "}
                    <Typography.Text code>pnpm nanobot channels weixin start</Typography.Text>
                    ，并在输出中看到{" "}
                    <Typography.Text code>[weixin] channel: long-poll ready</Typography.Text>
                    。若先启动后扫码，请等待约 8 秒自动重试或重启 dev:all。仅纯文本会走 Agent；配置了{" "}
                    <Typography.Text code>allow_from</Typography.Text> 时需在白名单内。调试可设{" "}
                    <Typography.Text code>NANOBOT_WEIXIN_VERBOSE=1</Typography.Text>。
                  </>
                }
              />
            ) : null}
            <Descriptions column={1} size="small" bordered>
              {data.channels?.weixin ? (
                <>
                  <Descriptions.Item label="微信 (Weixin)">
                    <Space wrap align="center">
                      <Tag color={data.channels.weixin.enabled ? "processing" : "default"}>
                        {data.channels.weixin.enabled ? "已启用" : "未启用"}
                      </Tag>
                      <Tag color={data.channels.weixin.hasToken ? "success" : "warning"}>
                        {data.channels.weixin.hasToken ? "已配置 token" : "未配置 token"}
                      </Tag>
                      <Button
                        type="link"
                        size="small"
                        loading={qrLoading}
                        onClick={() => void startQr(false)}
                      >
                        {data.channels.weixin.hasToken ? "重新扫码关联" : "扫码关联微信"}
                      </Button>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="iLink base">
                    {data.channels.weixin.baseUrl ?? (
                      <Typography.Text type="secondary">默认</Typography.Text>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="白名单 from">
                    {data.channels.weixin.allowFromCount === 0 ? (
                      <Typography.Text type="secondary">未限制（空列表表示全部）</Typography.Text>
                    ) : (
                      `${data.channels.weixin.allowFromCount} 个 ID`
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态目录">
                    {data.channels.weixin.stateDir ?? (
                      <Typography.Text type="secondary">默认 .nanobot-runtime/weixin</Typography.Text>
                    )}
                  </Descriptions.Item>
                  {data.channels.weixin.pollTimeout != null ? (
                    <Descriptions.Item label="轮询超时 (秒)">
                      {data.channels.weixin.pollTimeout}
                    </Descriptions.Item>
                  ) : null}
                </>
              ) : (
                <Descriptions.Item label="微信 (Weixin)">
                  <Space wrap align="center">
                    <Typography.Text type="secondary">配置摘要中无微信段（若已合并默认配置仍可能可用）</Typography.Text>
                    <Button type="link" size="small" loading={qrLoading} onClick={() => void startQr(false)}>
                      扫码关联微信
                    </Button>
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Modal
        title="微信扫码登录（iLink）"
        open={qrOpen}
        onCancel={() => {
          stopPoll();
          setQrOpen(false);
          setQrSession(null);
        }}
        footer={null}
        destroyOnHidden
        width={400}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {qrHint}
        </Typography.Paragraph>
        {qrSession ? (
          <div style={{ textAlign: "center" }}>
            <Image src={qrSession.qrDataUrl} alt="微信登录二维码" preview={false} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
