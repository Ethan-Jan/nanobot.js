import { Button, Descriptions, Modal, Spin, Space, Tag, Typography } from "antd";
import { GithubOutlined } from "@ant-design/icons";
import type { SkillManifest } from "@/shared/types";

type Props = {
  open: boolean;
  loading: boolean;
  skill: SkillManifest | null;
  onClose: () => void;
};

export function SkillDetailModal({ open, loading, skill, onClose }: Props) {
  return (
    <Modal
      title="技能详情"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={700}
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin />
        </div>
      ) : skill ? (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="名称">{skill.name}</Descriptions.Item>
          <Descriptions.Item label="版本">{skill.version || "-"}</Descriptions.Item>
          <Descriptions.Item label="描述">{skill.description || "-"}</Descriptions.Item>
          <Descriptions.Item label="来源">
            {skill.source === "github" ? (
              <Space>
                <GithubOutlined />
                <span>GitHub</span>
                {skill.sourceUrl && (
                  <Typography.Link href={skill.sourceUrl} target="_blank">
                    查看仓库
                  </Typography.Link>
                )}
              </Space>
            ) : (
              "本地"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="触发词">
            {skill.triggers?.length ? (
              <Space wrap>
                {skill.triggers.map((t: string) => (
                  <Tag key={t} color="blue">
                    {t}
                  </Tag>
                ))}
              </Space>
            ) : (
              "-"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="作者">{skill.author || "-"}</Descriptions.Item>
          <Descriptions.Item label="许可证">{skill.license || "-"}</Descriptions.Item>
          {skill.readme && (
            <Descriptions.Item label="说明文档">
              <div
                style={{
                  maxHeight: 300,
                  overflow: "auto",
                  background: "#f6ffed",
                  padding: 12,
                  borderRadius: 6,
                }}
              >
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{skill.readme}</pre>
              </div>
            </Descriptions.Item>
          )}
        </Descriptions>
      ) : null}
    </Modal>
  );
}
