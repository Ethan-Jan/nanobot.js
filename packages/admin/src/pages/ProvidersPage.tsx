import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Space,
  Spin,
  Table,
  Typography,
} from "antd";
import { getConfig, putConfig } from "../api";
import type { NanobotConfigDTO } from "../types";

export default function ProvidersPage() {
  const [cfg, setCfg] = useState<NanobotConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{
    defaults: { model: string; provider: string };
    providers: Record<string, { baseUrl?: string; apiKey?: string }>;
  }>();

  const load = async () => {
    setLoading(true);
    try {
      const c = await getConfig();
      setCfg(c);
      const providers: Record<string, { baseUrl?: string; apiKey?: string }> = {};
      for (const [id, p] of Object.entries(c.providers)) {
        providers[id] = { baseUrl: p.baseUrl, apiKey: "" };
      }
      form.setFieldsValue({
        defaults: { ...c.agents.defaults },
        providers,
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onFinish = async (values: {
    defaults: { model: string; provider: string };
    providers: Record<string, { baseUrl?: string; apiKey?: string }>;
  }) => {
    if (!cfg) return;
    setSaving(true);
    try {
      const nextProviders: Record<string, { apiKey?: string; baseUrl?: string }> = {};
      for (const id of Object.keys(cfg.providers)) {
        const prev = cfg.providers[id];
        const row = values.providers[id] ?? {};
        const baseUrl = row.baseUrl !== undefined ? row.baseUrl : prev.baseUrl;
        const entry: { apiKey?: string; baseUrl?: string } = { baseUrl };
        if (row.apiKey !== undefined && row.apiKey.trim() !== "") {
          entry.apiKey = row.apiKey.trim();
        }
        nextProviders[id] = entry;
      }

      const patch = {
        agents: { defaults: values.defaults },
        providers: nextProviders,
      };

      const updated = await putConfig(patch);
      setCfg(updated);
      message.success("已保存");
      const providers: Record<string, { baseUrl?: string; apiKey?: string }> = {};
      for (const [id, p] of Object.entries(updated.providers)) {
        providers[id] = { baseUrl: p.baseUrl, apiKey: "" };
      }
      form.setFieldsValue({
        defaults: { ...updated.agents.defaults },
        providers,
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !cfg) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const columns = [
    { title: "供应商 ID", dataIndex: "id", key: "id", width: 120 },
    {
      title: "Base URL",
      key: "baseUrl",
      render: (_: unknown, r: { id: string }) => (
        <Form.Item name={["providers", r.id, "baseUrl"]} noStyle>
          <Input placeholder="https://..." />
        </Form.Item>
      ),
    },
    {
      title: "API Key",
      key: "apiKey",
      render: (_: unknown, r: { id: string }) => (
        <Space orientation="vertical" size={0} style={{ width: "100%" }}>
          {cfg.providers[r.id]?.apiKey ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              已配置（输入新密钥以覆盖）
            </Typography.Text>
          ) : null}
          <Form.Item name={["providers", r.id, "apiKey"]} noStyle>
            <Input.Password placeholder="留空则不修改" autoComplete="off" />
          </Form.Item>
        </Space>
      ),
    },
  ];

  const rows = Object.keys(cfg.providers).map((id) => ({ id, key: id }));

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        模型与供应商
      </Typography.Title>
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Typography.Title level={5}>默认 Agent</Typography.Title>
          <Space wrap size="large" style={{ marginBottom: 16 }}>
            <Form.Item
              label="默认供应商"
              name={["defaults", "provider"]}
              rules={[{ required: true, message: "必填" }]}
            >
              <Input style={{ width: 200 }} />
            </Form.Item>
            <Form.Item
              label="默认模型"
              name={["defaults", "model"]}
              rules={[{ required: true, message: "必填" }]}
            >
              <Input style={{ width: 280 }} />
            </Form.Item>
          </Space>
          <Table
            size="small"
            pagination={false}
            columns={columns}
            dataSource={rows}
            style={{ marginBottom: 16 }}
          />
          <Button type="primary" htmlType="submit" loading={saving}>
            保存
          </Button>
        </Form>
      </Card>
    </div>
  );
}
