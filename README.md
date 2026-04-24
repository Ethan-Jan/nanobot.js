# nanobot (TypeScript)

轻量本地 AI 助手，通过 **OpenAI 兼容 API** 调用模型；提供 **终端 CLI**、**Web 管理台**、**微信 iLink 文本通道**。本仓库为 **pnpm monorepo**（Node **≥ 20**），理念对齐上游 **[HKUDS/nanobot](https://github.com/HKUDS/nanobot)**（Python），**不是**功能 1:1 复刻。

与上游能力差异见：构建后执行 `pnpm --filter nanobot start -- parity`，或阅读 `packages/nanobot/src/nanobot/PARITY.ts`。

---

## 目录

- [功能概览](#功能概览)
- [环境要求](#环境要求)
- [Monorepo 结构](#monorepo-结构)
- [快速开始](#快速开始)
- [一键：Web + 微信](#一键web--微信)
- [管理端（Admin）](#管理端admin)
- [Kimi / Moonshot](#kimi--moonshot-区域与模型参数)
- [智谱 AI（zhipuai）](#智谱-aizhipuai)
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
| 多供应商：Kimi、智谱（`zhipuai` / `bigmodel`）、OpenAI、OpenRouter 等（OpenAI SDK） | ✅ |
| 工具：`read_file` / `list_dir` / `search_repo` / `write_file`；可选 `run_shell` | ✅ |
| 微信 iLink：扫码登录、长轮询、纯文本 ↔ Agent（无图片/语音 CDN 解密） | ✅ |
| Web 管理台 | ✅ 见下表 |
| 配置：`agents.displayName`、`askNicknameOnStart`；CLI `/alias` 会话称呼 | ✅ |
| Gateway / 多通道总线 / MCP 全量 / 完整 Cron | 多为 stub，见 PARITY |

**管理台页面一览**

| 模块 | 说明 |
|------|------|
| 概览 | 配置路径、默认模型、通道状态；可设**默认 AI** |
| 对话 | **SSE 流式**回复；历史存浏览器 localStorage |
| 技能管理 | `<workspaceRoot>/skills/*/SKILL.md`，支持 GitHub 导入与搜索 |
| 用户画像 | 画像 / 当前意图 / 偏好 → `.nanobot/user-context.json`，注入 Agent system |
| 模型与供应商 | `providers`、`agents.defaults` |
| MCP 服务 | 与 `nanobot.config.json` 的 `mcp.servers` 一致 |
| 高级配置 | 整份配置 JSON 编辑 |

---

## 环境要求

- **Node.js ≥ 20**、**pnpm**（建议 **pnpm@9**，见根目录 `packageManager`）
- 所选 LLM API 网络可达（国内 Kimi：`api.moonshot.cn`）
- 微信通道：可访问 `https://ilinkai.weixin.qq.com`（或配置中的 `base_url`）
- 从管理端 **GitHub 导入技能** 时本机需安装 **`git`**

---

## Monorepo 结构

| 路径 | 说明 |
|------|------|
| **`packages/nanobot`** | CLI（`dist/cli.js`）、配置与 Agent、微信桥、**`api-lib`**（打包为 `lib/api-lib.cjs` 供 Nest 使用） |
| **`packages/api`** | **NestJS**：`/api/config`、`/api/status`、`/api/chat`、**`/api/chat/stream`**（SSE）、`/api/skills/*`、`/api/user-context`、`/api/weixin/login` 等 |
| **`packages/admin`** | **Vite + React + Ant Design**；开发时 `/api` 代理到 API 端口 |
| **根目录** | `nanobot.config.json.example`、**`.env.example`**（本地复制为 `.env`）、脚本 `pnpm dev:admin`、`pnpm dev:all` 等 |

配置文件默认在**仓库根**的 `nanobot.config.json`（解析逻辑自 `packages/nanobot` 向上找工程根）。**真实密钥勿提交**：该文件名已列入 `.gitignore`，请本地复制 `nanobot.config.json.example` 后填写。

---

## 快速开始

```bash
pnpm install
pnpm build
```

### 1. 密钥

仓库里**没有**自带 `.env`（密钥不应进 Git）。请复制示例后自行创建：

```bash
cp .env.example .env
# Windows: copy .env.example .env
```

编辑 `.env`，例如：

```env
MOONSHOT_API_KEY=sk-...
```

也可把 Key 写在 `nanobot.config.json` 的 `providers.<name>.apiKey`（该文件同样勿提交真实密钥，见上文）。

### 2. 配置文件

```bash
cp nanobot.config.json.example nanobot.config.json
# Windows: copy nanobot.config.json.example nanobot.config.json
```

填写各 `providers.*.apiKey`，并按需设置 `agents.defaults`、`tools.workspaceRoot`、`channels.weixin` 等。也可用向导生成默认文件：

```bash
pnpm --filter nanobot start -- onboard
```

环境变量 **`NANOBOT_CONFIG`** 可覆盖配置文件路径。

### 3. 终端助手

```bash
pnpm nanobot
```

Slash 命令：`/help`、`/new`、`/memory`、`/status`、**`/alias <称呼>`**、`/exit` 等。

---

## 一键：Web + 微信

| 命令 | 说明 |
|------|------|
| **`pnpm dev:all`** | 管理端联调（`pnpm dev:admin`）+ 微信长轮询；长轮询退出后约 **8s** 由 `scripts/weixin-retry.mjs` 自动重试（适合先启动再扫码）。 |
| **`pnpm start:all`** | 生产形态：`pnpm start:admin` + 同上微信重试（需先 **`pnpm build`**）。 |

只要 **API + 管理端**、不要微信：`pnpm dev:admin` 或 `pnpm start:admin`。

**微信**：概览里「已配置 token」只表示登录态文件存在；终端需出现 **`[weixin] channel: long-poll ready`** 才会处理消息。仅执行 `pnpm start:admin` **不会**自动拉起长轮询。

---

## 管理端（Admin）

| 模式 | 命令 | 说明 |
|------|------|------|
| 开发 | `pnpm dev` 或 `pnpm dev:admin` | API（默认 **18791**）+ Vite HMR；浏览器用终端打印的 Vite 地址（常见 `http://127.0.0.1:5173`） |
| 生产 | `pnpm start:admin`（需先 `pnpm build`） | 同一端口提供 API；若存在 `packages/admin/dist-web` 可一并托管静态页 |

- 页面路径 **`/api/*`** 由 Vite **代理**到 `http://127.0.0.1:18791`；开发时须先起 API 进程。
- 设置 **`NANOBOT_API_DEV=1`** 时，API 不托管旧的 `dist-web`，避免误以为刷新即更新前端。
- **勿**在未做认证的情况下把管理端暴露到公网。

**技能**与 **`tools.workspaceRoot`** 一致，列 `skills/*/SKILL.md`。**用户画像**写入工作区 **`.nanobot/user-context.json`**，见上文「管理台页面一览」。

---

## Kimi / Moonshot 区域与模型参数

- **国内 Key**（[platform.moonshot.cn](https://platform.moonshot.cn)）→ `baseUrl`：`https://api.moonshot.cn/v1`
- **国际 Key** → `https://api.moonshot.ai/v1`；与国内混用易 **401**。
- 部分模型（如 `kimi-k2.5`）仅允许 **`temperature: 1`**，已对 `moonshot` provider 自动处理。

---

## 智谱 AI（zhipuai）

- `agents.defaults.provider` 可设为 **`zhipuai`** 或 **`bigmodel`**（同一 [OpenAI 兼容](https://docs.bigmodel.cn/cn/guide/develop/openai/introduction) 端点）。
- `agents.defaults.model` 使用控制台模型 id，如 **`glm-4-flash`**、**`glm-4-plus`** 等。
- 若误填带 **`/`** 的 OpenRouter 风格 id，运行时会回退为 **`glm-4-flash`** 并打日志。
- 密钥：`providers.zhipuai.apiKey` 或 `providers.bigmodel.apiKey`，或环境变量（见下表）。

---

## 环境变量摘要

| 变量 | 作用 |
|------|------|
| `MOONSHOT_API_KEY` / `KIMI_API_KEY` | Kimi / Moonshot |
| `ZHIPUAI_API_KEY` / `ZHIPU_API_KEY` / `BIGMODEL_API_KEY` | 智谱（`zhipuai` / `bigmodel`） |
| `OPENAI_API_KEY` | OpenAI |
| `OPENROUTER_API_KEY` | OpenRouter |
| `NANOBOT_CONFIG` | 配置文件路径 |
| `NANOBOT_WORKSPACE` | 工具默认工作区（及技能、用户画像等路径基准） |
| `NANOBOT_API_KEY` + `NANOBOT_PROVIDER` | 可覆盖「默认 provider + 单密钥」组合（见 `openai-compat.ts`） |
| `NANOBOT_WEIXIN_VERBOSE` | `1` / `true` 时微信详细日志 |
| `NANOBOT_API_DEV` | API 开发模式（`start:dev` 注入；不托管 admin 静态包） |
| `ADMIN_PORT` / `PORT` | 管理 API 端口（默认 **18791**） |

**加载方式**：**CLI**（`pnpm nanobot` 等）在启动时执行 `load-env`：先读**与 `nanobot.config.json` 同目录的工程根**下的 `.env`，再读**当前工作目录**下的 `.env`（后者覆盖前者），见 `packages/nanobot/src/load-env.ts`。  
单独跑 **Nest 管理 API**（`node packages/api/dist/main.js` 等）**不会**自动跑这段逻辑；需要时在启动进程的环境里设置变量，或自行用 `dotenv` / 系统服务注入。

---

## CLI 命令

全局选项：`-c, --config`、`-w, --workspace`（`pnpm --filter nanobot start -- --help`）。

仓库根且已 `pnpm build` 时常用：

| 命令 | 说明 |
|------|------|
| `pnpm nanobot` | 进入 **agent** REPL；`-m "..."` 单条；`--allow-shell` |
| `pnpm --filter nanobot start -- status` | 配置、密钥、MCP 等就绪情况 |
| `pnpm --filter nanobot start -- onboard` | 写入默认 `nanobot.config.json` |
| `pnpm --filter nanobot start -- parity` | 与上游能力矩阵 |
| `pnpm --filter nanobot start -- channels weixin login` | 微信扫码登录 |
| `pnpm --filter nanobot start -- channels weixin start` | 仅微信长轮询 |

```bash
pnpm --filter nanobot start -- -m "用一句话介绍本项目"
```

---

## 配置项要点（`nanobot.config.json`）

- **`agents.defaults`**：`provider`、`model`（管理台「概览 / 模型与供应商」可改）。
- **`agents.displayName` / `agents.askNicknameOnStart`**：助手称呼、首轮问昵称等。
- **`providers.*`**：`baseUrl`、`apiKey`（可留空，走环境变量）。
- **`tools`**：`workspaceRoot`、**`allowShell`**、**`allowWrite`**（文件工具与技能、`.nanobot/user-context.json` 等均以该目录为工作区根）。
- **`agents.memory`**：`enabled`、`maxPersistedMessages`；`MEMORY.md` 与 `sessions/*.json` 见源码注释。
- **`channels.weixin`**：`enabled`、`allow_from`、`base_url`、`token` 等（见 `packages/nanobot/src/config.ts`）。
- **`mcp.servers`**：stdio MCP 与 CLI / 管理端一致。

磁盘 JSON 与 `defaultConfig()` **深度合并**，**以磁盘为准**。

---

## 工具与安全

- 文件类工具以 **`workspaceRoot`** 为界，并校验路径穿越。
- **`write_file`** 拒绝 `.env`、私钥名、`weixin/account.json`、常见证书后缀等。
- **`run_shell`** 仅在配置或 CLI 显式开启时使用。

---

## 开发

### 根目录常用脚本

| 命令 | 作用 |
|------|------|
| `pnpm build` | 全量构建（nanobot CLI + `api-lib` + Nest + admin） |
| `pnpm typecheck` | 全工作区 TypeScript 检查 |
| `pnpm dev` / `pnpm dev:admin` | 管理端开发：api-lib 监听 + Nest `start:dev` + Vite（`wait-on` 健康检查） |
| `pnpm dev:api` | 仅 Nest API |
| `pnpm dev:cli` | `vite-node --watch` 跑 CLI 源码 |
| `pnpm dev:all` | `dev:admin` + 微信长轮询重试 |
| `pnpm start:admin` / `pnpm start:api` | 运行已构建的 Nest（`node dist/main.js`） |
| `pnpm start:all` | `start:admin` + 微信长轮询重试 |
| `pnpm run playwright:install` | 拉取 **Playwright Chromium**（`skills/browser-watch` 等示例首次需要） |

### 修改了 `packages/nanobot` 里被 Nest 引用的逻辑？

改 **`api-lib` 相关**（如 `agent.ts`、`memory/`、`user/`）后需 **`pnpm --filter nanobot run build:lib`**，或在 `packages/api` 的 **`start:dev`**  pipeline 中随 watch 重编，否则 `dist` 与运行中的 `lib/api-lib.cjs` 会旧。

`packages/nanobot` 目录内：

```bash
cd packages/nanobot
pnpm dev
pnpm run build:lib
pnpm run build
```

---

## 目录结构（节选）

```
packages/nanobot/src/
  cli.ts, config.ts, agent.ts, load-env.ts
  providers/          # OpenAI 兼容客户端
  tools/              # 工具与 write 安全
  nanobot/
    cli/              # 子命令
    channels/weixin/  # iLink
    command/          # REPL slash
    memory/           # MEMORY.md、session 转写、buildFullSystemPrompt
    user/             # .nanobot/user-context.json 画像/意图/偏好
    skills/
    PARITY.ts
packages/api/src/     # Nest 控制器
packages/admin/src/   # React
scripts/weixin-retry.mjs
```

本地运行时目录 **`.nanobot-runtime/`** 建议不提交（已在 `.gitignore`）。**`nanobot.config.json`** 常含密钥，同忽略；团队共享结构用 **`nanobot.config.json.example`**。

---

## 常见问题

1. **401 / Key** — Key 与 `baseUrl` 国内、国际一致；`pnpm --filter nanobot start -- status` 自检；智谱勿与 OpenRouter 混用。
2. **管理端连不上 API** — 用 `pnpm dev:admin`；确认 **18791** 可访问；浏览器打开 **Vite 端口**（如 5173），不要只开 API 却访问错端口。
3. **管理端对话不流式** — 需 **新 API**（`/api/chat/stream`）与较新 `api-lib`；改 agent 后执行 **`build:lib`** 并重启 API。
4. **微信不回复** — 终端需 **`[weixin] channel: long-poll ready`**；使用 `pnpm dev:all` 或单独 `channels weixin start`；检查 `allow_from`、仅文本；可设 `NANOBOT_WEIXIN_VERBOSE=1`。
5. **微信 `fetch failed`** — 网络/代理；开详细日志排查。
6. **Moonshot 400 temperature** — 已按 provider 处理；仍报错时核对模型名与官方文档。

---

## 许可证与致谢

- 概念与协议对齐 **[HKUDS/nanobot](https://github.com/HKUDS/nanobot)**。  
- 以根目录 **`LICENSE`** 为准（若未添加请自行补充）。

更细设计说明见 **`packages/nanobot/docs/PRINCIPLES.md`**。
