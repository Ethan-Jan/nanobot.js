import { Button, Card, List, Popconfirm, Typography } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ChatThread } from "../types";

type Props = {
  threads: ChatThread[];
  activeId: string;
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRemove: (id: string) => void;
};

export function ChatThreadSidebar({
  threads,
  activeId,
  loading,
  onSelect,
  onCreate,
  onRemove,
}: Props) {
  return (
    <Card
      size="small"
      title="历史会话"
      style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column" }}
      styles={{ body: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: 8 } }}
      extra={
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onCreate}>
          新建
        </Button>
      }
    >
      <List
        size="small"
        style={{ flex: 1, overflowY: "auto" }}
        dataSource={threads}
        locale={{ emptyText: "暂无" }}
        renderItem={(t) => (
          <List.Item
            style={{
              cursor: loading ? "not-allowed" : "pointer",
              padding: "8px 10px",
              borderRadius: 6,
              marginBottom: 4,
              background: t.id === activeId ? "var(--ant-color-primary-bg, #e6f4ff)" : undefined,
            }}
            onClick={() => onSelect(t.id)}
            actions={[
              <Popconfirm
                key="del"
                title="删除此会话？"
                description="将移除侧边栏条目并删除本机保存的该对话内容。服务端该会话 ID 对应的记忆文件仍可能留在磁盘上。"
                okText="删除"
                cancelText="取消"
                onConfirm={() => onRemove(t.id)}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={loading}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={
                <Typography.Text ellipsis style={{ maxWidth: 160 }}>
                  {t.title}
                </Typography.Text>
              }
              description={
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {new Date(t.updatedAt).toLocaleString()}
                </Typography.Text>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
