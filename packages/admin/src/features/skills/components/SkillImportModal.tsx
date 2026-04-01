import { Alert, Button, Flex, Input, Modal, Space, Switch, Tag, Typography } from "antd";
import { DownloadOutlined, GithubOutlined } from "@ant-design/icons";
import type { GitHubSkillInfo } from "@/shared/types";

const BORDER = "1px solid var(--ant-color-border-secondary, #f0f0f0)";

type Props = {
  open: boolean;
  githubUrl: string;
  onGithubUrlChange: (v: string) => void;
  importing: boolean;
  onImport: (urlOverride?: string) => void;
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  broadGitHubSearch: boolean;
  onBroadChange: (v: boolean) => void;
  searching: boolean;
  onSearch: () => void;
  searchResults: GitHubSkillInfo[];
  onClose: () => void;
};

export function SkillImportModal({
  open,
  githubUrl,
  onGithubUrlChange,
  importing,
  onImport,
  searchQuery,
  onSearchQueryChange,
  broadGitHubSearch,
  onBroadChange,
  searching,
  onSearch,
  searchResults,
  onClose,
}: Props) {
  return (
    <Modal title="从 GitHub 导入技能" open={open} onCancel={onClose} footer={null} width={700}>
      <Space orientation="vertical" style={{ width: "100%" }} size="large">
        <div>
          <Typography.Text strong>直接导入</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            输入 GitHub 仓库地址，格式：
            <code>https://github.com/username/repo</code> 或 <code>username/repo</code>
          </Typography.Paragraph>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              placeholder="https://github.com/username/nanobot-skill-example"
              value={githubUrl}
              onChange={(e) => onGithubUrlChange(e.target.value)}
              onPressEnter={() => onImport(undefined)}
            />
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={importing}
              onClick={() => onImport(undefined)}
            >
              导入
            </Button>
          </Space.Compact>
        </div>

        <div>
          <Typography.Text strong>搜索社区技能</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            默认仅搜索带 <Typography.Text code>nanobot-skill</Typography.Text> 主题的仓库；开启扩大搜索可匹配任意公开仓库（结果需自行判断是否含有效
            SKILL.md）。
          </Typography.Paragraph>
          <div style={{ marginBottom: 8 }}>
            <Space>
              <span>扩大搜索（社区任意仓库）</span>
              <Switch checked={broadGitHubSearch} onChange={onBroadChange} />
            </Space>
          </div>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              placeholder="搜索关键词，如: code-review"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onPressEnter={onSearch}
            />
            <Button icon={<GithubOutlined />} loading={searching} onClick={onSearch}>
              搜索
            </Button>
          </Space.Compact>

          {searchResults.length > 0 && (
            <div
              style={{
                marginTop: 16,
                border: BORDER,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {searchResults.map((item, i) => (
                <Flex
                  key={`${item.fullName}-${i}`}
                  align="flex-start"
                  justify="space-between"
                  gap={12}
                  style={{
                    padding: "8px 12px",
                    borderTop: i > 0 ? BORDER : undefined,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Space wrap>
                      <Typography.Link href={item.url} target="_blank">
                        {item.fullName}
                      </Typography.Link>
                      <Tag>★ {item.stars}</Tag>
                    </Space>
                    {item.description ? (
                      <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
                        {item.description}
                      </Typography.Paragraph>
                    ) : null}
                  </div>
                  <Button
                    type="link"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => onImport(item.url)}
                  >
                    导入
                  </Button>
                </Flex>
              ))}
            </div>
          )}
        </div>

        <Alert
          type="warning"
          showIcon
          title="安全提示"
          description="从 GitHub 导入的技能会在本地工作区落盘，请确保来源可信。导入前建议查看仓库源码与 SKILL.md。"
        />
      </Space>
    </Modal>
  );
}
