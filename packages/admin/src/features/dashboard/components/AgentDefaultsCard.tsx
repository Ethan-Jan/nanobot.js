import { Card, Descriptions } from "antd";
import type { StatusPayload } from "@/shared/api";

type Props = { data: StatusPayload };

export function AgentDefaultsCard({ data }: Props) {
  return (
    <Card title="默认 Agent">
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="配置文件">{data.configPath}</Descriptions.Item>
        <Descriptions.Item label="默认供应商">{data.defaultProvider}</Descriptions.Item>
        <Descriptions.Item label="默认模型">{data.defaultModel}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
