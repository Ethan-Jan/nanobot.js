import { useEffect, useState } from "react";
import { App, Alert, Button, Card, Form, Input, Space, Switch, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { getConfig, putConfig } from "@/shared/api";
import type { NanobotConfigDTO } from "@/shared/types";
import { PageSpinner } from "@/shared/ui/PageSpinner";

const SERVER_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

type McpServerDTO = NonNullable<NonNullable<NanobotConfigDTO["mcp"]>["servers"]>[string];

type RowValues = {
  serverKey: string;
  disabled?: boolean;
  command: string;
  argsText: string;
  cwd: string;
  envText: string;
};

function rowsFromConfig(c: NanobotConfigDTO): RowValues[] {
  const entries = Object.entries(c.mcp?.servers ?? {});
  const rows = entries.map(([serverKey, s]) => ({
    serverKey,
    disabled: s.disabled === true,
    command: s.command ?? "",
    argsText: (s.args ?? []).join("\n"),
    cwd: s.cwd ?? "",
    envText: s.env ? Object.entries(s.env).map(([k, v]) => `${k}=${v}`).join("\n") : "",
  }));
  return rows.length > 0
    ? rows
    : [{ serverKey: "", disabled: false, command: "", argsText: "", cwd: "", envText: "" }];
}

function serversFromRows(rows: RowValues[]): Record<string, McpServerDTO> {
  const servers: Record<string, McpServerDTO> = {};
  for (const r of rows) {
    const k = r.serverKey?.trim();
    if (!k) continue;
    const args = (r.argsText ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const env: Record<string, string> = {};
    for (const line of (r.envText ?? "").split("\n")) {
      const t = line.trim();
      if (!t || !t.includes("=")) continue;
      const eq = t.indexOf("=");
      const ek = t.slice(0, eq).trim();
      if (ek) env[ek] = t.slice(eq + 1).trim();
    }
    servers[k] = {
      disabled: r.disabled === true,
      command: r.command.trim(),
      ...(args.length ? { args } : {}),
      ...(r.cwd?.trim() ? { cwd: r.cwd.trim() } : {}),
      ...(Object.keys(env).length ? { env } : {}),
    };
  }
  return servers;
}

export function McpPage() {
  const { message } = App.useApp();
  const [cfg, setCfg] = useState<NanobotConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ rows: RowValues[] }>();

  const load = async () => {
    setLoading(true);
    try {
      const c = await getConfig();
      setCfg(c);
      form.setFieldsValue({ rows: rowsFromConfig(c) });
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onFinish = async (values: { rows: RowValues[] }) => {
    setSaving(true);
    try {
      const servers = serversFromRows(values.rows ?? []);
      const updated = await putConfig({
        mcp: Object.keys(servers).length > 0 ? { servers } : { servers: {} },
      });
      setCfg(updated);
      form.setFieldsValue({ rows: rowsFromConfig(updated) });
      message.success("已保存；新配置在下次对话 / CLI 请求时生效（当前长连接需重开）。");
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
        MCP 服务（stdio）
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="说明"
        description={
          <>
            每个条目会启动一个子进程（<Typography.Text code>command</Typography.Text> +{" "}
            <Typography.Text code>args</Typography.Text>），通过 Model Context Protocol 暴露工具；与 CLI / 管理端对话时合并进模型
            function calling。工具名形如{" "}
            <Typography.Text code>mcp__&lt;标识&gt;__&lt;工具名&gt;</Typography.Text>。
            参数一行一个；环境变量一行 <Typography.Text code>KEY=value</Typography.Text>。禁用开关仅跳过连接。
          </>
        }
      />
      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ rows: rowsFromConfig(cfg) }}>
        <Form.List name="rows">
          {(fields, { add, remove }) => (
            <Space orientation="vertical" style={{ width: "100%" }} size="middle">
              {fields.map((field) => (
                <Card
                  key={field.key}
                  size="small"
                  title={`服务器 #${field.name + 1}`}
                  extra={
                    fields.length > 1 ? (
                      <Button type="link" danger size="small" onClick={() => remove(field.name)}>
                        删除
                      </Button>
                    ) : null
                  }
                >
                  <Form.Item
                    label="标识（字母开头，仅字母数字下划线）"
                    name={[field.name, "serverKey"]}
                    rules={[
                      { required: true, message: "必填" },
                      {
                        pattern: SERVER_KEY_RE,
                        message: "须以字母开头，仅含字母、数字、下划线、短横线",
                      },
                    ]}
                  >
                    <Input placeholder="例如 filesystem、git" allowClear />
                  </Form.Item>
                  <Space wrap size="large">
                    <Form.Item label="禁用" name={[field.name, "disabled"]} valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Space>
                  <Form.Item
                    label="命令"
                    name={[field.name, "command"]}
                    rules={[{ required: true, message: "必填" }]}
                  >
                    <Input placeholder="例如 npx、node、uvx" />
                  </Form.Item>
                  <Form.Item label="参数（每行一个）" name={[field.name, "argsText"]}>
                    <Input.TextArea
                      placeholder={
                        "例如：-y\n@modelcontextprotocol/server-filesystem\nC:\\\\path\\\\to\\\\dir"
                      }
                      rows={4}
                    />
                  </Form.Item>
                  <Form.Item label="工作目录 cwd（可选）" name={[field.name, "cwd"]}>
                    <Input placeholder="子进程工作目录" allowClear />
                  </Form.Item>
                  <Form.Item label="环境变量（每行 KEY=value）" name={[field.name, "envText"]}>
                    <Input.TextArea placeholder={"PATH=...\nFOO=bar"} rows={3} />
                  </Form.Item>
                </Card>
              ))}
              <Button type="dashed" onClick={() => add(emptyRow())} block icon={<PlusOutlined />}>
                添加 MCP 服务器
              </Button>
            </Space>
          )}
        </Form.List>
        <Button type="primary" htmlType="submit" loading={saving} style={{ marginTop: 16 }}>
          保存
        </Button>
      </Form>
    </div>
  );
}

function emptyRow(): RowValues {
  return { serverKey: "", disabled: false, command: "", argsText: "", cwd: "", envText: "" };
}
