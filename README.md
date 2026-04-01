# nanobot (TypeScript)

基于 **OpenAI 兼容 API** 的轻量本地 AI 助手：**终端 CLI** + **可选 Web 管理台** + **微信 iLink 文本通道**。实现为 **pnpm monorepo**（Node **≥ 20**），结构对齐上游 **[HKUDS/nanobot](https://github.com/HKUDS/nanobot)**（Python），**并非** 1:1 功能等价。

> 能力对照：构建后执行 `pnpm --filter nanobot start -- parity`，或查看 `packages/nanobot/src/nanobot/PARITY.ts`。

---

## 目录

- [功能概览](#功能概览)
- [Monorepo 结构](#monorepo-结构)
- [快速开始](#快速开始)
- [一键：Web + 微信](#一键web--微信)
- [管理端（Admin）](#管理端admin)
- [Kimi / Moonshot 区域](#kimi--moonshot-区域与模型参数)
- [环境变量](#环境变量摘要)
- [CLI 命令](#cli-命令)
- [配置要点](#配置项要点nanobotconfigjson)
- [工具与安全](#工具与安全)
- [开发与构建](#开发)
- [目录结构（节选）](#目录结构节选)
- [常见问题](#常见问题)
- [许可证与致谢](#许可证与致谢)

---

## 功能概览

| 能力 | 状态 |
|------|------|
| 终端 REPL / `-m` 单条消息 | ✅ |
| 记忆：`MEMORY.md` + 按 session 持久化（`.nanobot-runtime/memory/`） | ✅ |
| Kimi / OpenAI / OpenRouter 等兼容端点（OpenAI SDK） | ✅ |
| 工具：`read_file` / `list_dir` / `search_repo` / `write_file`；可选 `run_shell` | ✅ |
| 微信 iLink：扫码登录、长轮询、纯文本 ↔ Agent（无图片/语音 CDN 解密） | ✅ |
| Web 管理台：概览、对话、**技能管理**（列表 / GitHub 导入）、模型与供应商、高级配置 | ✅ |
| 配置项：`agents.displayName`、`askNicknameOnStart`；CLI `/alias` 会话称呼 | ✅ |
| Gateway / 多通道总线 / MCP / 完整 Cron | 多为 stub，见 PARITY |

---

## 环境要求

- **Node.js ≥ 20**、**pnpm**（建议 **pnpm@9**，见根目录 `packageManager`）
- 所选 LLM API 网络可达（国内 Kimi：`api.moonshot.cn`）
- 微信通道：可访问 `https://ilinkai.weixin.qq.com`（或配置中的 `base_url`）
- 从管理端 **GitHub 导入技能** 时本机需有 **`git`**

---

## Monorepo 结构

| 路径 | 说明 |
|------|------|
| **`packages/nanobot`** | CLI（`dist/cli.js`）、配置与 Agent、微信桥、`api-lib`（供 Nest 打包） |
| **`packages/api`** | **NestJS** 管理 API：`/api/config`、`/api/chat`、`/api/skills`、`/api/weixin/login` 等 |
| **`packages/admin`** | **Vite + React + Ant Design** 管理 UI；开发时通过代理访问 API |
| **根目录** | `nanobot.config.json`、脚本 `pnpm dev:admin`、`pnpm dev:all` 等 |

配置默认在**仓库根** `nanobot.config.json`（自 `packages/nanobot` 向上解析）。

---

## 快速开始

```bash
pnpm install
pnpm build
```

### 1. 密钥（推荐根目录 `.env`）

```env
MOONSHOT_API_KEY=sk-...
```

也可写在 `nanobot.config.json` 的 `providers.<name>.apiKey`（**勿提交 Git**）。

### 2. 配置文件

默认读取根目录 `nanobot.config.json`（可用 `NANOBOT_CONFIG` 覆盖路径）。若无配置：

```bash
pnpm --filter nanobot start -- onboard
```

按需编辑 `agents.defaults`、`providers`、`tools.workspaceRoot`、`channels.weixin` 等。

### 3. 终端助手

```bash
pnpm nanobot
```

Slash：`/help`、`/new`、`/memory`、`/status`、**`/alias <称呼>`**、`/exit` 等。

---

## 一键：Web + 微信

| 命令 | 说明 |
|------|------|
| **`pnpm dev:all`** | **管理端联调**（`pnpm dev:admin`）+ **微信长轮询**；后者由 `scripts/weixin-retry.mjs` 在退出后约 **8s 自动重试**（适合先启动再在 B 端扫码登录）。 |
| **`pnpm start:all`** | **生产形态**：`pnpm start:admin` + 同上微信重试（需先 `pnpm build`）。 |

仅开 API + 前端、不要微信：`pnpm dev:admin` 或 `pnpm start:admin`。

**重要**：概览里「已配置 token」只表示登录态文件就绪；**必须**在终端看到 **`[weixin] channel: long-poll ready`** 才会处理微信消息。仅 `pnpm start:admin` **不会**拉起长轮询。

---

## 管理端（Admin）

**开发**（API 热重载 + Vite HMR）：

```bash
pnpm dev
# 或
pnpm dev:admin
```

- 浏览器打开终端中的 **Vite 地址**（常见 **`http://127.0.0.1:5173`** 或 **`http://localhost:5173`**；以终端为准）。
- 页面 `/api` 由 Vite **代理**到 **`http://127.0.0.1:18791`**（须先起 API）。
- 开发模式下 API 进程若设置 `NANOBOT_API_DEV=1`，**不会**托管旧的 `dist-web`，避免误以为刷新即更新前端。

**生产**（先 `pnpm build`）：

```bash
pnpm start:admin
```

在 **`127.0.0.1:18791`**（`ADMIN_PORT` / `PORT` 可改）提供 API；若已构建 `packages/admin/dist-web`，可同时托管静态管理页。**勿在未认证场景暴露公网。**

**技能**：侧栏 **技能管理** — 列出 `<workspaceRoot>/skills/*/SKILL.md`；支持 **GitHub 克隆导入**、搜索（可选扩大至非 `nanobot-skill` 主题仓库）。工作区目录与 **`tools.workspaceRoot`** 一致。

**微信登录**：概览通道卡片可 **扫码关联**（写入 `.nanobot-runtime/weixin/account.json`），仍需单独长轮询进程（见上节）。

---

## Kimi / Moonshot 区域与模型参数

- **国内 Key**（[platform.moonshot.cn](https://platform.moonshot.cn)）→ `"baseUrl": "https://api.moonshot.cn/v1"`
- **国际 Key** → `https://api.moonshot.ai/v1`  
  混用易导致 **401**。
- 部分模型（如 `kimi-k2.5`）仅允许 **`temperature: 1`**，已对 `moonshot` provider 自动处理。

---

## 环境变量摘要

| 变量 | 作用 |
|------|------|
| `MOONSHOT_API_KEY` / `KIMI_API_KEY` | Moonshot |
| `OPENAI_API_KEY` | OpenAI |
| `OPENROUTER_API_KEY` | OpenRouter |
| `NANOBOT_CONFIG` | 配置文件路径 |
| `NANOBOT_WORKSPACE` | 工具默认工作区 |
| `NANOBOT_WEIXIN_VERBOSE` | `1` / `true` 时微信详细日志 |
| `NANOBOT_API_DEV` | API 开发模式（由 `start:dev` 注入；不托管 admin 静态包） |
| `ADMIN_PORT` / `PORT` | 管理 API 端口（默认 **18791**） |

`.env`：先加载仓库根 `.env`，再加载当前工作目录 `.env`（见 `packages/nanobot/src/load-env.ts`）。

---

## CLI 命令

全局选项：`-c, --config`、`-w, --workspace`（见 `pnpm --filter nanobot start -- --help`）。

在仓库根（需已 `pnpm build`）常用：

| 命令 | 说明 |
|------|------|
| `pnpm nanobot` | 默认进入 **agent** REPL；`-m "..."` 单条；`--allow-shell` |
| `pnpm --filter nanobot start -- status` | 配置与密钥就绪情况 |
| `pnpm --filter nanobot start -- onboard` | 写入默认配置 |
| `pnpm --filter nanobot start -- parity` | 与上游能力矩阵 |
| `pnpm --filter nanobot start -- channels weixin login` | 微信扫码登录 |
| `pnpm --filter nanobot start -- channels weixin start` | **仅**微信长轮询 |

示例：

```bash
pnpm --filter nanobot start -- status
pnpm --filter nanobot start -- -m "用一句话介绍本项目"
```

---

## 配置项要点（`nanobot.config.json`）

- **`agents.defaults`**：`provider`、`model`。
- **`agents.displayName` / `agents.askNicknameOnStart`**：全局助手称呼；开启记忆且首轮可引导询问昵称（管理端「高级配置」可改）。
- **`providers.*`**：`baseUrl`、`apiKey`（可留空走环境变量）。
- **`tools`**：`workspaceRoot`、`allowShell`、`allowWrite`。
- **`agents.memory`**：`enabled`、`maxPersistedMessages`；`MEMORY.md` 与 `sessions/*.json` 路径见代码注释。
- **`channels.weixin`**：`enabled`、`allow_from`、`base_url`、`token` 等（见 `packages/nanobot/src/config.ts`）。

磁盘 JSON 与 `defaultConfig()` **深度合并**，以 JSON 为准。

---

## 工具与安全

- 文件工具限制在 **`workspaceRoot`** 内，防路径穿越。
- **`write_file`** 拦截敏感路径（`.env`、私钥名、`weixin/account.json`、证书后缀等）。
- **`run_shell`** 仅在显式开启时使用，风险自负。

---

## 开发

### 根目录脚本

| 命令 | 作用 |
|------|------|
| `pnpm build` | 构建全部包（nanobot CLI + `api-lib` + Nest `dist` + admin `dist-web`） |
| `pnpm typecheck` | 全工作区 TS 检查 |
| `pnpm dev` / `pnpm dev:admin` | Admin：**API `start:dev`**（lib watch + nodemon）+ **Vite**（`wait-on` 健康检查后启动） |
| `pnpm dev:api` | 仅 Nest API 开发 |
| `pnpm dev:cli` | `vite-node --watch` 跑 CLI 源码 |
| `pnpm dev:all` | `dev:admin` + 微信长轮询重试脚本 |
| `pnpm nanobot` | 运行已构建 CLI |
| `pnpm start:admin` / `pnpm start:api` | 运行已构建 Nest（`node dist/main.js`） |
| `pnpm start:all` | `start:admin` + 微信长轮询重试 |

### `packages/nanobot`

```bash
cd packages/nanobot
pnpm dev              # vite-node --watch src/cli.ts
pnpm run build:lib    # 打 Nest 用的 lib/api-lib.cjs
pnpm run build
pnpm run typecheck
```

改 **`api-lib` 或 Nest 引用的 nanobot 源码** 后，在 `packages/api` 侧会随 **`start:dev`** 重编/重启；详见 `packages/api/package.json` 与 `nodemon.json`。

---

## 目录结构（节选）

```
packages/nanobot/src/
  cli.ts, config.ts, agent.ts, load-env.ts
  providers/          # OpenAI 兼容客户端
  tools/              # 工具定义与执行
  nanobot/
    cli/              # 子命令
    channels/weixin/  # iLink
    command/          # REPL slash
    skills/           # 技能加载、GitHub 导入、todo 等
    memory/           # MEMORY.md + session JSON
    PARITY.ts
packages/api/src/     # Nest：config/chat/skills/weixin 等控制器
packages/admin/src/   # React 管理页
scripts/weixin-retry.mjs
```

运行时数据：`.nanobot-runtime/`（建议 **勿提交**，已在 `.gitignore`）。

---

## 常见问题

1. **401 / Key** — Key 与 `baseUrl` 国内/国际一致；`pnpm --filter nanobot start -- status` 自检。
2. **管理端「无法连接 API」** — 使用 `pnpm dev:admin`，确认 **18791** 未被占用；浏览器用 **Vite 端口（如 5173）**，勿只用 API 端口当「前端开发地址」。
3. **微信不回消息** — 确认终端有 **`[weixin] channel: long-poll ready`**；使用 `pnpm dev:all` 或单独 `channels weixin start`；检查 `allow_from`、仅文本、可设 `NANOBOT_WEIXIN_VERBOSE=1`。
4. **微信 `fetch failed`** — 网络/代理；开详细日志排查。
5. **Moonshot 400 temperature** — 已按 provider 处理；仍报错时核对模型名与文档。

---

## 许可证与致谢

- 概念与协议对齐 **[HKUDS/nanobot](https://github.com/HKUDS/nanobot)**。  
- 本仓库许可证以根目录 **`LICENSE`** 为准（若未添加请自行补充）。

更细的设计说明见 **`packages/nanobot/docs/PRINCIPLES.md`**。
