import { Card, Descriptions, Tag, Typography } from "antd";
import type { StatusPayload } from "@/shared/api";

type Props = { data: StatusPayload };

export function ProvidersStatusCard({ data }: Props) {
  return (
    <Card title="供应商密钥状态">
      <Descriptions column={1} size="small" bordered>
        {Object.entries(data.providers).map(([id, p]) => (
          <Descriptions.Item key={id} label={id}>
            <Tag color={p.hasKey ? "success" : "default"}>{p.hasKey ? "已配置" : "缺少密钥"}</Tag>
            {p.keyFromFile ? <Tag>文件</Tag> : null}
            {p.keyFromEnv ? <Tag>环境变量</Tag> : null}
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              {p.baseUrl ?? ""}
            </Typography.Text>
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  );
}
