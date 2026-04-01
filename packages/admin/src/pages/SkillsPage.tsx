import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  List,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
  message,
  Empty,
  Tooltip,
  Descriptions,
  Popconfirm,
  Switch,
} from "antd";
import {
  DownloadOutlined,
  ReloadOutlined,
  DeleteOutlined,
  GithubOutlined,
  BookOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  getSkills,
  getSkillDetail,
  importSkillFromGitHub,
  deleteSkill,
  reloadSkills,
  searchGitHubSkills,
} from "../api";
import type { SkillManifest, GitHubSkillInfo } from "../types";

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  
  // 详情弹窗
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<SkillManifest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // GitHub 导入
  const [importOpen, setImportOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GitHubSkillInfo[]>([]);
  const [searching, setSearching] = useState(false);
  /** true：不限定 nanobot-skill 主题，搜索任意 GitHub 仓库 */
  const [broadGitHubSearch, setBroadGitHubSearch] = useState(false);

  const loadSkills = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await getSkills();
      setSkills(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSkills();
  }, []);

  const handleShowDetail = async (name: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await getSkillDetail(name);
      setDetailSkill(detail);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "获取详情失败");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleImport = async (urlOverride?: string) => {
    const u = (urlOverride ?? githubUrl).trim();
    if (!u) {
      message.warning("请输入 GitHub 仓库地址");
      return;
    }
    setImporting(true);
    try {
      await importSkillFromGitHub(u);
      message.success("技能导入成功");
      setImportOpen(false);
      setGithubUrl("");
      void loadSkills();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteSkill(name);
      message.success(`已删除技能: ${name}`);
      void loadSkills();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleReload = async () => {
    try {
      await reloadSkills();
      message.success("技能已重新加载");
      void loadSkills();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "重载失败");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchGitHubSkills(searchQuery.trim(), broadGitHubSearch);
      setSearchResults(results);
      if (results.length === 0) {
        message.info("无结果，可尝试开启「扩大搜索」或换关键词");
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (err) {
    return (
      <Alert
        type="error"
        showIcon
        title="加载技能列表失败"
        description={err}
        action={
          <Button onClick={() => void loadSkills()}>重试</Button>
        }
      />
    );
  }

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        技能管理
      </Typography.Title>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="技能系统说明"
        description={
          <>
            技能来自工作区 <Typography.Text code>skills/&lt;名称&gt;/SKILL.md</Typography.Text>（与{" "}
            <Typography.Text code>nanobot.config.json</Typography.Text> 里{" "}
            <Typography.Text code>tools.workspaceRoot</Typography.Text> 一致）。
            可从 GitHub 克隆仓库到该目录；社区仓库若打了 <Typography.Text code>nanobot-skill</Typography.Text>{" "}
            主题更易被「标准搜索」发现。扩大搜索可浏览任意仓库，导入前请自行审查源码。
          </>
        }
      />

      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            <span>已安装技能 ({skills.length})</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void handleReload()}
            >
              重载
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => setImportOpen(true)}
            >
              从 GitHub 导入
            </Button>
          </Space>
        }
      >
        {skills.length === 0 ? (
          <Empty
            description="暂无安装的技能"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => setImportOpen(true)}
            >
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
                    onClick={() => void handleShowDetail(skill.name)}
                  >
                    详情
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="确认删除"
                    description={`确定要删除技能 "${skill.name}" 吗？`}
                    onConfirm={() => void handleDelete(skill.name)}
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
                      <Typography.Text type="secondary">
                        {skill.description || "暂无描述"}
                      </Typography.Text>
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

      {/* 技能详情弹窗 */}
      <Modal
        title="技能详情"
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setDetailSkill(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {detailLoading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin />
          </div>
        ) : detailSkill ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="名称">{detailSkill.name}</Descriptions.Item>
            <Descriptions.Item label="版本">{detailSkill.version || "-"}</Descriptions.Item>
            <Descriptions.Item label="描述">{detailSkill.description || "-"}</Descriptions.Item>
            <Descriptions.Item label="来源">
              {detailSkill.source === "github" ? (
                <Space>
                  <GithubOutlined />
                  <span>GitHub</span>
                  {detailSkill.sourceUrl && (
                    <Typography.Link href={detailSkill.sourceUrl} target="_blank">
                      查看仓库
                    </Typography.Link>
                  )}
                </Space>
              ) : (
                "本地"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="触发词">
              {detailSkill.triggers?.length ? (
                <Space wrap>
                  {detailSkill.triggers.map((t: string) => (
                    <Tag key={t} color="blue">
                      {t}
                    </Tag>
                  ))}
                </Space>
              ) : (
                "-"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="作者">{detailSkill.author || "-"}</Descriptions.Item>
            <Descriptions.Item label="许可证">{detailSkill.license || "-"}</Descriptions.Item>
            {detailSkill.readme && (
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
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {detailSkill.readme}
                  </pre>
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        ) : null}
      </Modal>

      {/* GitHub 导入弹窗 */}
      <Modal
        title="从 GitHub 导入技能"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false);
          setGithubUrl("");
          setSearchQuery("");
          setSearchResults([]);
        }}
        footer={null}
        width={700}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Typography.Text strong>直接导入</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
              输入 GitHub 仓库地址，格式：
              <code>https://github.com/username/repo</code> 或{" "}
              <code>username/repo</code>
            </Typography.Paragraph>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="https://github.com/username/nanobot-skill-example"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                onPressEnter={() => void handleImport()}
              />
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                loading={importing}
                onClick={() => void handleImport(undefined)}
              >
                导入
              </Button>
            </Space.Compact>
          </div>

          <div>
            <Typography.Text strong>搜索社区技能</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
              默认仅搜索带 <Typography.Text code>nanobot-skill</Typography.Text> 主题的仓库；开启扩大搜索可匹配任意公开仓库（结果需自行判断是否含有效 SKILL.md）。
            </Typography.Paragraph>
            <div style={{ marginBottom: 8 }}>
              <Space>
                <span>扩大搜索（社区任意仓库）</span>
                <Switch checked={broadGitHubSearch} onChange={setBroadGitHubSearch} />
              </Space>
            </div>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="搜索关键词，如: code-review"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onPressEnter={() => void handleSearch()}
              />
              <Button
                icon={<GithubOutlined />}
                loading={searching}
                onClick={() => void handleSearch()}
              >
                搜索
              </Button>
            </Space.Compact>

            {searchResults.length > 0 && (
              <List
                style={{ marginTop: 16 }}
                size="small"
                bordered
                dataSource={searchResults}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        key="import"
                        type="link"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => void handleImport(item.url)}
                      >
                        导入
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Typography.Link href={item.url} target="_blank">
                            {item.fullName}
                          </Typography.Link>
                          <Tag>★ {item.stars}</Tag>
                        </Space>
                      }
                      description={item.description}
                    />
                  </List.Item>
                )}
              />
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
    </div>
  );
}
