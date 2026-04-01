import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  message,
  Space,
  Spin,
  Typography,
} from "antd";
import { getConfig, putConfig } from "../api";
import type { NanobotConfigDTO } from "../types";

export default function ConfigPage() {
  const [cfg, setCfg] = useState<NanobotConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{
    tools: NanobotConfigDTO["tools"];
    memory: NonNullable<NanobotConfigDTO["agents"]["memory"]>;
    weixin: NonNullable<NanobotConfigDTO["channels"]>["weixin"];
  }>();

  const load = async () => {
    setLoading(true);
    try {
      const c = await getConfig();
      setCfg(c);
      const wx = { ...(c.channels?.weixin ?? {}), token: "" };
      form.setFieldsValue({
        tools: {
          allowShell: c.tools.allowShell,
          allowWrite: c.tools.allowWrite ?? true,
          workspaceRoot: c.tools.workspaceRoot,
        },
        memory: {
          enabled: c.agents.memory?.enabled ?? true,
          maxPersistedMessages: c.agents.memory?.maxPersistedMessages ?? 40,
        },
        weixin: wx,
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
    tools: NanobotConfigDTO["tools"];
    memory: NonNullable<NanobotConfigDTO["agents"]["memory"]>;
    weixin: NonNullable<NanobotConfigDTO["channels"]>["weixin"];
  }) => {
    if (!cfg) return;
    setSaving(true);
    try {
      const weixinPatch: Record<string, unknown> = { ...values.weixin };
      const t = typeof values.weixin?.token === "string" ? values.weixin.token.trim() : "";
      if (t) weixinPatch.token = t;
      else delete weixinPatch.token;

      const patch = {
        tools: values.tools,
        agents: {
          memory: {
            enabled: values.memory.enabled,
            maxPersistedMessages: values.memory.maxPersistedMessages,
          },
        },
        channels: {
          weixin: weixinPatch,
        },
      };

      const updated = await putConfig(patch);
      setCfg(updated);
      message.success("已保存");
      const weixinFields = { ...(updated.channels?.weixin ?? {}), token: "" };
      form.setFieldsValue({
        tools: {
          allowShell: updated.tools.allowShell,
          allowWrite: updated.tools.allowWrite ?? true,
          workspaceRoot: updated.tools.workspaceRoot,
        },
        memory: {
          enabled: updated.agents.memory?.enabled ?? true,
          maxPersistedMessages: updated.agents.memory?.maxPersistedMessages ?? 40,
        },
        weixin: weixinFields,
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
