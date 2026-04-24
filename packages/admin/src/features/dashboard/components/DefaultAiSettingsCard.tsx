import { useEffect, useState } from "react";
import { App, Button, Card, Form, Input, Select, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { putConfig } from "@/shared/api";
import type { StatusPayload } from "@/shared/api";

type FormValues = { provider: string; model: string };

type Props = {
  data: StatusPayload;
  onSaved: () => void | Promise<void>;
};

export function DefaultAiSettingsCard({ data, onSaved }: Props) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      provider: data.defaultProvider,
      model: data.defaultModel,
    });
  }, [data.defaultProvider, data.defaultModel, form]);

  const providerOptions = Object.keys(data.providers)
    .sort()
    .map((id) => ({ label: id, value: id }));

  const onFinish = async (values: FormValues) => {
    const provider = values.provider.trim();
    const model = values.model.trim();
    if (!provider || !model) return;
    setSaving(true);
    try {
      await putConfig({
        agents: {
          defaults: {
            provider,
            model,
          },
        },
      });
      message.success("默认 AI 已保存");
      await onSaved();
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="默认 AI">
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        全局默认供应商与模型（<Typography.Text code>agents.defaults</Typography.Text>），对话页与 CLI 共用。
        配置文件：<Typography.Text code>{data.configPath}</Typography.Text>
      </Typography.Paragraph>
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 560 }}>
        <Space wrap size="middle" style={{ width: "100%" }}>
          <Form.Item
            label="默认供应商"
            name="provider"
            rules={[{ required: true, message: "请选择或填写供应商 id" }]}
            style={{ minWidth: 220, marginBottom: 0 }}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={providerOptions}
              placeholder="选择 providers 中的 id"
              popupMatchSelectWidth={false}
            />
          </Form.Item>
          <Form.Item
            label="默认模型"
            name="model"
            rules={[{ required: true, message: "请输入模型 id" }]}
            style={{ minWidth: 280, flex: 1, marginBottom: 0 }}
          >
            <Input placeholder="例如 kimi-k2.5、glm-4-flash" allowClear />
          </Form.Item>
        </Space>
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存默认 AI
          </Button>
          <Button type="link" onClick={() => navigate("/providers")} style={{ paddingInline: 0 }}>
            去配置密钥与 baseUrl →
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
