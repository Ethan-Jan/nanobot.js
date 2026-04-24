---
name: find-skill
description: 帮用户发现、搜索并安装 nanobot 社区技能（GitHub / 管理端导入）；在用户问「有没有现成技能」「找一个做 X 的技能」「怎么装技能」时使用。
triggers: ["find skill", "find-skill", "找技能", "搜技能", "安装技能", "nanobot-skill", "技能库", "有没有技能"]
version: "1.0.0"
---

# Find Skill（发现与安装技能）

本仓库的 Agent 从工作区 `<workspaceRoot>/skills/<技能名>/SKILL.md` 加载技能。本技能说明**如何为当前工作区找到并接入**社区技能。

## 何时适用

- 用户想用现成功能（如 PR 审查、部署、某语言最佳实践），不想从零写提示词。
- 用户问「有没有处理 X 的技能」「怎么从 GitHub 装技能」。
- 用户想浏览与 **topic `nanobot-skill`** 相关的仓库。

## 在本项目中的三种方式

### 1. Web 管理端（推荐）

1. 打开管理端，侧栏 **技能管理**。
2. **从 GitHub 导入**：
   - 在搜索框用关键词搜索（默认可限定 `topic:nanobot-skill`；也可扩大搜索需自行鉴别是否含 `SKILL.md`）。
   - 或在「直接导入」中填入 `owner/repo` 或 `https://github.com/owner/repo`。
3. 导入后技能会出现在「已安装技能」列表，Agent 的 system 提示中也会带上技能摘要；需要细节时用 `read_file` 读 `skills/<名>/SKILL.md`。

### 2. 本地已有路径

- 若用户克隆了带 `SKILL.md` 的目录，可放到 `<workspaceRoot>/skills/<技能目录名>/`，与 `example-code-review`、`find-skill` 同级结构。

### 3. 命令行 / API（开发者）

- 实现上与「导入」一致：在配置的 `tools.workspaceRoot` 下使用 `skills/` 子目录。CI 或脚本可 `git clone` 某仓库到 `skills/<name>/` 并删除 `.git`（与后端导入逻辑类似）。

## 搜索建议

- 在管理端搜索时用**具体英文或中文关键词** + 业务域，例如 `review`、`weixin`、`mcp`。
- 社区约定：很多仓库会打 **GitHub topic `nanobot-skill`**；默认搜索会带该条件。
- 查看星星数与最近提交；优先选择有清晰 `SKILL.md` 与 `README` 的仓库。

## 不要混淆

- 本仓库是 **TypeScript** nanobot 变体，技能形态为 **工作区下 `SKILL.md`**。其它生态里的 `npx skills` / skills.sh 与这里**无直接等价**；**以本项目的导入路径为准**。

## 若未找到合适技能

1. 说明已按关键词在 GitHub 上检索，可建议用户改关键词或自行新建目录参照 `skills/example-code-review/SKILL.md` 的 front matter 与正文结构写一个新技能。
