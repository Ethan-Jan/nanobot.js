import { useCallback } from "react";
import { Alert, Card, Col, Row, Typography } from "antd";
import { PageSpinner } from "@/shared/ui/PageSpinner";
import { AgentDefaultsCard } from "./components/AgentDefaultsCard";
import { ProvidersStatusCard } from "./components/ProvidersStatusCard";
import { WeixinChannelDescriptions } from "./components/WeixinChannelDescriptions";
import { WeixinLongPollHint } from "./components/WeixinLongPollHint";
import { WeixinQrModal } from "./components/WeixinQrModal";
import { useDashboardStatus } from "./hooks/useDashboardStatus";
import { useWeixinQrFlow } from "./hooks/useWeixinQrFlow";

export function DashboardPage() {
  const { data, err, loading, refresh } = useDashboardStatus();

  const onLoginConfirmed = useCallback(async () => {
    try {
      await refresh();
    } catch {
      /* ignore */
    }
  }, [refresh]);

  const { qrOpen, qrSession, qrHint, qrLoading, startQr, closeModal } = useWeixinQrFlow({
    onLoginConfirmed,
  });

  if (loading) {
    return <PageSpinner />;
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
          <AgentDefaultsCard data={data} />
        </Col>
        <Col xs={24} lg={12}>
          <ProvidersStatusCard data={data} />
        </Col>
        <Col xs={24}>
          <Card title="通道 (Channels)">
            {data.channels?.weixin ? <WeixinLongPollHint /> : null}
            <WeixinChannelDescriptions
              data={data}
              qrLoading={qrLoading}
              onStartQr={() => void startQr(false)}
            />
          </Card>
        </Col>
      </Row>

      <WeixinQrModal open={qrOpen} hint={qrHint} session={qrSession} onClose={closeModal} />
    </div>
  );
}
