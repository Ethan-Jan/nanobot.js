import { Form, Input, Space, Table, Typography } from "antd";
import type { NanobotConfigDTO } from "@/shared/types";

type Row = { id: string; key: string };

type Props = {
  cfg: NanobotConfigDTO;
};

export function ProvidersTable({ cfg }: Props) {
  const columns = [
    { title: "供应商 ID", dataIndex: "id", key: "id", width: 120 },
    {
      title: "Base URL",
      key: "baseUrl",
      render: (_: unknown, r: Row) => (
        <Form.Item name={["providers", r.id, "baseUrl"]} noStyle>
          <Input placeholder="https://..." />
        </Form.Item>
      ),
    },
    {
      title: "API Key",
      key: "apiKey",
      render: (_: unknown, r: Row) => (
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

  const rows: Row[] = Object.keys(cfg.providers).map((id) => ({ id, key: id }));

  return (
    <Table
      size="small"
      pagination={false}
      columns={columns}
      dataSource={rows}
      style={{ marginBottom: 16 }}
    />
  );
}
