import { Button, Card, Empty, List, Popconfirm, Space, Tag, Tooltip, Typography } from "antd";
import {
  BookOutlined,
  DeleteOutlined,
  DownloadOutlined,
  GithubOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { SkillManifest } from "@/shared/types";

type Props = {
  skills: SkillManifest[];
  onReload: () => void;
  onOpenImport: () => void;
  onShowDetail: (name: string) => void;
  onDelete: (name: string) => void;
};

export function InstalledSkillsCard({
  skills,
  onReload,
  onOpenImport,
  onShowDetail,
  onDelete,
}: Props) {
  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined />
          <span>已安装技能 ({skills.length})</span>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={onReload}>
            重载
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={onOpenImport}>
            从 GitHub 导入
          </Button>
        </Space>
      }
    >
      {skills.length === 0 ? (
        <Empty description="暂无安装的技能" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button type="primary" icon={<DownloadOutlined />} onClick={onOpenImport}>
            导入第一个技能
          </Button>
        </Empty>
      ) : (
        <List
          dataSource={skills}
          renderItem={(skill) => (
            <List.Item
              actions={[
                <Button
                  key="view"
                  type="link"
                  icon={<BookOutlined />}
                  onClick={() => onShowDetail(skill.name)}
                >
                  详情
                </Button>,
                <Popconfirm
                  key="delete"
                  title="确认删除"
                  description={`确定要删除技能 "${skill.name}" 吗？`}
                  onConfirm={() => onDelete(skill.name)}
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="link" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space wrap size="middle" align="center">
                    <span style={{ fontWeight: 500 }}>{skill.name}</span>
                    {skill.version ? <Tag color="blue">v{skill.version}</Tag> : null}
                    {skill.source === "github" ? (
                      <Tooltip title="从 GitHub 导入">
                        <GithubOutlined style={{ color: "#8c8c8c", fontSize: 16 }} />
                      </Tooltip>
                    ) : null}
                  </Space>
                }
                description={
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Typography.Text type="secondary">{skill.description || "暂无描述"}</Typography.Text>
                    {skill.triggers && skill.triggers.length > 0 ? (
                      <Space wrap size={[8, 8]}>
                        {skill.triggers.map((t: string) => (
                          <Tag key={t} color="cyan" style={{ margin: 0 }}>
                            {t}
                          </Tag>
                        ))}
                      </Space>
                    ) : null}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
