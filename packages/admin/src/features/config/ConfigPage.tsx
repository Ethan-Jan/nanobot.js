import { useEffect, useState } from "react";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Space,
  Typography,
} from "antd";
import { getConfig, putConfig } from "@/shared/api";
import type { NanobotConfigDTO } from "@/shared/types";
import { PageSpinner } from "@/shared/ui/PageSpinner";
import { configToFormValues, formValuesToPatch, type ConfigFormValues } from "./configForm";

export function ConfigPage() {
  const { message } = App.useApp();
  const [cfg, setCfg] = useState<NanobotConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<ConfigFormValues>();

  const load = async () => {
    setLoading(true);
    try {
      const c = await getConfig();
      setCfg(c);
      form.setFieldsValue(configToFormValues(c));
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onFinish = async (values: ConfigFormValues) => {
    if (!cfg) return;
    setSaving(true);
    try {
      const updated = await putConfig(formValuesToPatch(values));
      setCfg(updated);
      message.success("已保存");
      form.setFieldsValue(configToFormValues(updated));
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
        高级配置
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        工具策略、记忆与微信通道。密钥类字段显示为掩码时不修改原值。
      </Typography.Paragraph>
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Typography.Title level={5}>工具</Typography.Title>
          <Space wrap size="large">
            <Form.Item label="允许 Shell" name={["tools", "allowShell"]} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="允许写入文件" name={["tools", "allowWrite"]} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item label="工作区根目录" name={["tools", "workspaceRoot"]}>
            <Input placeholder="绝对路径或相对 cwd" />
          </Form.Item>

          <Typography.Title level={5}>记忆</Typography.Title>
          <Space wrap size="large">
            <Form.Item label="启用" name={["memory", "enabled"]} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="每会话最多保留条数" name={["memory", "maxPersistedMessages"]}>
              <InputNumber min={1} max={500} />
            </Form.Item>
          </Space>

          <Typography.Title level={5}>助手称呼</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            此处为<strong>全局</strong>称呼（优先）；留空时用语义默认「nanobot（小纳）」或各会话在终端执行的{" "}
            <Typography.Text code>/alias 昵称</Typography.Text>（写入会话 JSON）。
          </Typography.Paragraph>
          <Form.Item label="全局显示名（留空则用默认 nanobot（小纳）或会话 /alias）" name={["persona", "displayName"]}>
            <Input placeholder="例如：小智、CodeBuddy" allowClear />
          </Form.Item>
          <Form.Item
            label="首轮询问昵称"
            name={["persona", "askNicknameOnStart"]}
            valuePropName="checked"
            extra="仅当记忆启用、本会话尚无称呼且无已持久化对话时，在 system 中引导模型先问用户想起什么称呼。"
          >
            <Switch />
          </Form.Item>

          <Typography.Title level={5}>微信通道</Typography.Title>
          <Space wrap size="large">
            <Form.Item label="启用" name={["weixin", "enabled"]} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="轮询超时 (秒)" name={["weixin", "poll_timeout"]}>
              <InputNumber min={5} max={120} />
            </Form.Item>
          </Space>
          <Form.Item label="Base URL" name={["weixin", "base_url"]}>
            <Input />
          </Form.Item>
          <Form.Item label="CDN Base URL" name={["weixin", "cdn_base_url"]}>
            <Input />
          </Form.Item>
          {cfg.channels?.weixin?.token ? (
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              当前已配置 Token；留空保存则不修改。
            </Typography.Text>
          ) : null}
          <Form.Item label="Token" name={["weixin", "token"]}>
            <Input.Password placeholder="留空则不修改" autoComplete="off" />
          </Form.Item>
          <Form.Item label="状态目录" name={["weixin", "state_dir"]}>
            <Input placeholder="可选" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={saving}>
            保存
          </Button>
        </Form>
      </Card>
    </div>
  );
}
