import { Alert, Typography } from "antd";

export function SkillsIntroAlert() {
  return (
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
  );
}
