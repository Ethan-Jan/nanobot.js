import { useEffect, useState } from "react";
import { App, Button, Card, Form, Input, Space, Typography } from "antd";
import { getConfig, putConfig } from "@/shared/api";
import type { NanobotConfigDTO } from "@/shared/types";
import { PageSpinner } from "@/shared/ui/PageSpinner";
import { ProvidersTable } from "./ProvidersTable";
import {
  buildProvidersPutPayload,
  configToProvidersForm,
  type ProvidersFormShape,
} from "./providersSubmit";

export function ProvidersPage() {
  const { message } = App.useApp();
  const [cfg, setCfg] = useState<NanobotConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<ProvidersFormShape>();

  const load = async () => {
    setLoading(true);
    try {
      const c = await getConfig();
      setCfg(c);
      form.setFieldsValue(configToProvidersForm(c));
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onFinish = async (values: ProvidersFormShape) => {
    if (!cfg) return;
    setSaving(true);
    try {
      const updated = await putConfig(buildProvidersPutPayload(cfg, values));
      setCfg(updated);
      message.success("已保存");
      form.setFieldsValue(configToProvidersForm(updated));
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !cfg) {
    return <PageSpinner />;
  }

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
          <ProvidersTable cfg={cfg} />
          <Button type="primary" htmlType="submit" loading={saving}>
            保存
          </Button>
        </Form>
      </Card>
    </div>
  );
}
