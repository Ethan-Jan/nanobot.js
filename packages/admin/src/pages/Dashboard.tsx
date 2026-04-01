import { useEffect, useState } from "react";
import { Card, Col, Descriptions, Row, Spin, Tag, Typography, Alert } from "antd";
import { getStatus } from "../api";
import type { StatusPayload } from "../api";

export default function Dashboard() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      </Row>
    </div>
  );
}
