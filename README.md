# nanobot (TypeScript)

基于 **OpenAI 兼容 API** 的轻量本地 AI 助手 **CLI**，结构对齐 **[HKUDS/nanobot](https://github.com/HKUDS/nanobot)**（Python 原版），使用 **TypeScript + Node 20+** 实现。本仓库为 **pnpm monorepo**：核心 CLI 在 `packages/nanobot`，**B 端控制台**（Ant Design + React 19 + React Compiler）在 `packages/admin`。适合在终端对话、读写工作区文件、以及通过 **微信 iLink** 做个人号文本机器人（部分能力）。

> **说明**：本仓库是**部分移植**（结构 + 核心 Agent + 微信文本通道等），**并非**与上游 Python 版 1:1 功能等价。完整对照请运行 **`pnpm --filter nanobot start -- parity`**（需先 `pnpm build`），或查看 `packages/nanobot/src/nanobot/PARITY.ts`。

---

## 功能概览

| 能力 | 状态 |
|------|------|
| 终端交互 REPL / `-m` 单条消息 | 支持 |
| 记忆：`MEMORY.md` + 按 session 持久化最近对话（`.nanobot-runtime/memory/`） | 支持 |
| Kimi(Moonshot) / OpenAI / OpenRouter 等兼容端点 | 支持（统一 OpenAI SDK） |
| 函数工具：`read_file` / `list_dir` / `search_repo` / `write_file` | 支持 |
| 可选 `run_shell`（配置或 CLI 显式开启） | 支持 |
| 个人微信 iLink：扫码登录、长轮询、文本收发 → Agent | 支持（无图片/语音 CDN 解密） |
| `channels.weixin.enabled` 与 `pnpm nanobot` 并联长轮询 | 支持 |
| **B 端 Web 控制台**：概览、供应商与模型、高级配置（读写 `nanobot.config.json`） | 支持（`packages/admin`） |
| Gateway / 多通道总线 / MCP / 完整 Cron | 多为 stub，见 PARITY |

---

## 环境要求

- **Node.js ≥ 20**
- **pnpm**（建议与根目录 `packageManager` 字段一致，当前为 **pnpm@9**）
- 网络可达所选 LLM 的 API（国内 Kimi 需能访问 `api.moonshot.cn`）
- 使用微信通道时需能访问 `https://ilinkai.weixin.qq.com`（或你在配置中指定的 `base_url`）

---

## Monorepo 结构

| 包 | 说明 |
|----|------|
| **根目录** | 工作区脚本：`pnpm build`、`pnpm dev:admin`、`pnpm nanobot` 等 |
| **`packages/nanobot`** | CLI：`nanobot` / `dist/cli.js`，配置与 Agent 核心代码 |
| **`packages/admin`** | 管理端：Vite 8 + Ant Design 6 + React Compiler；开发时 API 默认 `127.0.0.1:18791` |

配置文件默认放在**仓库根目录**的 `nanobot.config.json`（代码会从 `packages/nanobot` 向上查找该文件）。

---

## 快速开始

```bash
pnpm install
pnpm build
```

### 1. 配置密钥（推荐 `.env`）

在仓库根目录自建 `.env`（该文件应在 `.gitignore` 中）：

```env
# 国内 Kimi 开放平台申请的 Key
MOONSHOT_API_KEY=sk-...
```

密钥也可写在 `nanobot.config.json` 的 `providers.<name>.apiKey`（**不要提交到 Git**）。

### 2. 配置文件

默认读取**仓库根目录** `nanobot.config.json`（可通过环境变量 `NANOBOT_CONFIG` 指向其他路径）。

若尚无配置文件，可在构建后执行：

```bash
pnpm --filter nanobot start -- onboard
```

再按需编辑 `agents.defaults`、`providers`、`tools`、`channels.weixin` 等。

### 3. 启动终端助手

```bash
pnpm nanobot
# 等价于在 packages/nanobot 下执行 node dist/cli.js
```

slash 命令：`/help`、`/new`（清空对话并删本会话记忆文件）、`/memory`（路径提示）、`/status`、`/exit` 等。

### 4.（可选）B 端控制台

**开发**（同时起管理 API + Vite 前端，前端通过代理访问 `/api`）：

```bash
pnpm dev
# 或
pnpm dev:admin
```

浏览器打开终端里提示的本地地址（默认 `http://127.0.0.1:5173`）。

**生产形态**（需先 `pnpm build`）：

```bash
pnpm start:admin
```

会在 `127.0.0.1:18791` 提供 API 与静态页面（环境变量 **`ADMIN_PORT`** 或 **`PORT`** 可改端口）。仅绑定本机回环地址，请勿在未加认证的情况下暴露到公网。

### 5.（可选）微信通道

```bash
pnpm --filter nanobot start -- channels weixin login
```

在 `nanobot.config.json` 中设置 `channels.weixin.enabled: true` 后，**同一进程**下 `pnpm nanobot` 会在后台并联微信长轮询（须已成功 login 或已配置有效 `token`）。

---

## Kimi / Moonshot 区域与模型参数

- **国内账号**（[platform.moonshot.cn](https://platform.moonshot.cn)）生成的 API Key 必须使用：

  `"baseUrl": "https://api.moonshot.cn/v1"`

- **国际站** Key 使用：`https://api.moonshot.ai/v1`  
  混用会导致 **HTTP 401**。

- 部分模型（如 `kimi-k2.5`）仅允许 **`temperature: 1`**，本仓库已对 `moonshot` provider 自动处理。

---

## 环境变量摘要

| 变量 | 作用 |
|------|------|
| `MOONSHOT_API_KEY` / `KIMI_API_KEY` | Moonshot 密钥 |
| `OPENAI_API_KEY` | OpenAI |
| `OPENROUTER_API_KEY` | OpenRouter |
| `NANOBOT_PROVIDER` + `NANOBOT_API_KEY` | 同时指定 provider 与密钥，覆盖默认 |
| `NANOBOT_CONFIG` | `nanobot.config.json` 路径 |
| `NANOBOT_WORKSPACE` | 工具默认工作区根目录 |
| `NANOBOT_WEIXIN_VERBOSE` | `1` / `true` 时打印微信轮询与消息处理详细日志 |
| `ADMIN_PORT` / `PORT` | 管理端 HTTP 端口（默认 `18791`） |

`.env` 先于 CWD 加载仓库根 `.env`，再由当前工作目录 `.env` 覆盖；已处理 UTF-8 BOM（见 `packages/nanobot/src/load-env.ts`）。

---

## CLI 命令

全局选项（多数子命令前可用）：`-c, --config <path>`，`-w, --workspace <path>`。

以下均在仓库根目录执行（需已 `pnpm build`）：

| 命令 | 说明 |
|------|------|
| `pnpm --filter nanobot start -- agent`（默认子命令） | 交互 REPL；`-m "..."` 单条；`--allow-shell` |
| `pnpm --filter nanobot start -- status` | 配置路径与各 provider 密钥是否就绪 |
| `pnpm --filter nanobot start -- onboard` | 写入默认配置；`--wizard` / `--sync-templates` / `--refresh-only` |
| `pnpm --filter nanobot start -- parity` | 打印与上游 Python 的能力矩阵 |
| `pnpm --filter nanobot start -- gateway` | **stub**：演示启动顺序，不监听真实 HTTP |
| `pnpm --filter nanobot start -- channels status` / `channels login` | 通道占位说明 / stub |
| `pnpm --filter nanobot start -- channels weixin login` | 微信 iLink 扫码登录 |
| `pnpm --filter nanobot start -- channels weixin start` | 仅运行微信长轮询（不与 REPL 并联） |
| `pnpm --filter nanobot start -- cron list` / `cron add` | 列表 / 添加任务（add 为 stub） |
| `pnpm --filter nanobot start -- provider login <name>` | stub |

示例：

```bash
pnpm --filter nanobot start -- status
pnpm --filter nanobot start -- -m "用一句话介绍本项目"
pnpm --filter nanobot start -- channels weixin start --allow-shell
```

也可 `cd packages/nanobot` 后使用 `node dist/cli.js …` 或 `pnpm start -- …`。

---

## 配置项要点（`nanobot.config.json`）

- **`agents.defaults`**：`provider`（如 `moonshot`）、`model`（如 `kimi-k2.5`）。
- **`providers.<id>.baseUrl` / `apiKey`**：各兼容端点；Key 可留空改由 `.env` 提供。
- **`tools`**：
  - `workspaceRoot`：文件工具根目录。
  - `allowShell`：是否注册并允许 `run_shell`（高危，默认建议 `false`）。
  - `allowWrite`：`false` 时不暴露 `write_file` 且拒绝写入。
- **`agents.memory`**（可选）：
  - `enabled`：默认 `true`；`false` 时不注入、不落盘会话记忆。
  - `maxPersistedMessages`：每会话 JSON 中保留的条数上限（user/assistant 各算一条），默认 `40`。
  - 工作区根目录 **`MEMORY.md`**：用 `## 标题` 分块，会注入 system（启用记忆时）。
  - 会话文件：`<repo>/.nanobot-runtime/memory/sessions/<session>.json`（`session` 来自 `-s` 或微信 `weixin:<用户id>`）。
- **`channels.weixin`**：
  - `enabled`：是否与默认 `agent` 并联启动长轮询。
  - `allow_from`：非空时仅处理这些微信用户 id。
  - `base_url`、`poll_timeout` 等见 `packages/nanobot/src/config.ts` 注释。

**注意**：磁盘上的 `nanobot.config.json` 会与 `defaultConfig()` 深度合并，**JSON 中的字段覆盖代码默认值**（例如仅改 `packages/nanobot/src/config.ts` 的默认 `enabled` 不会生效，若 JSON 里仍为 `false`）。

---

## 工具与安全

- 所有文件路径限制在 **`workspaceRoot`** 内，并做路径穿越检查。
- **`write_file`** 拒绝敏感路径（如 `.env`、常见私钥名、`.nanobot-runtime/weixin/account.json`、`.pem/.p12/.pfx` 等），见 `packages/nanobot/src/tools/writeGuard.ts`。
- **`run_shell`** 仅在显式开启时使用，在**工作区根目录**执行命令，风险自负。

---

## 开发

### 根目录常用脚本

| 命令 | 作用 |
|------|------|
| `pnpm build` | 构建所有包（CLI `dist/cli.js` + 管理端 `dist-web` / `dist-server`） |
| `pnpm typecheck` | 全工作区 TypeScript 检查 |
| `pnpm dev` / `pnpm dev:admin` | 管理端：API + Vite 联调 |
| `pnpm dev:cli` | CLI：`vite-node --watch` 跑 `packages/nanobot/src/cli.ts` |
| `pnpm nanobot` | 运行已构建的 CLI（生产 bundle） |
| `pnpm start:admin` | 运行已构建的管理端服务 |

### CLI 包内（`packages/nanobot`）

```bash
cd packages/nanobot
pnpm run dev          # vite-node --watch src/cli.ts（改源码重启进程）
pnpm run start:reload # 先 build，再监听 dist + node --watch（见 scripts/reload-dist.mjs）
pnpm run build:watch  # 仅监听重打包 dist/cli.js
pnpm run typecheck
pnpm run build
```

**热重载说明**

| 命令 | 行为 |
|------|------|
| `pnpm dev`（在 `packages/nanobot`） | 不经过 `dist`，由 **vite-node** 监视 `src` 并**重启整个 Node 进程**（REPL 会话会丢）。 |
| `pnpm run start:reload` | 先完整 `build`，再并行 **Vite watch 打包** 与 **`node --watch dist/cli.js`**；改 TS 后自动重编并重启 CLI。 |
| `pnpm nanobot`（根目录） | 无热重载，适合稳定运行。 |

微信长轮询与 REPL 同进程时，进程重启会断开长轮询，属预期现象。

---

## 目录结构（节选）

```
packages/nanobot/
  src/
    cli.ts                 # 入口：先 load-env，再 commander
    load-env.ts
    config.ts              # 配置加载、合并、路径（会向上查找根目录 nanobot.config.json）
    agent.ts
    providers/             # OpenAI 兼容客户端与错误说明
    tools/                 # 工具定义与执行
    nanobot/
      cli/                 # 各子命令实现
      channels/weixin/     # iLink 桥接
      command/             # REPL slash 路由
      PARITY.ts            # 与上游对照表
  docs/
    PRINCIPLES.md          # 数据流与扩展点（若存在）
packages/admin/
  src/                     # React 管理端页面
  server/index.ts          # 管理 API + 生产静态资源
```

运行时状态（微信登录态等）：`<repo>/.nanobot-runtime/`（建议勿提交）。

---

## 常见问题

1. **401 Invalid Authentication**  
   检查 Key 是否与 `baseUrl` 同属国内或国际；`pnpm --filter nanobot start -- status` 是否显示 `ready`。

2. **400 temperature**  
   Moonshot 部分模型仅支持 `temperature: 1`，已按 provider 自动设置。

3. **微信并联不启动**  
   确认 `nanobot.config.json` 里 `channels.weixin.enabled` 为 `true`，并已 `login`。

4. **微信 `fetch failed` / `ECONNRESET`**  
   网络或代理问题；可设 `NANOBOT_WEIXIN_VERBOSE=1` 查看详细日志。

5. **管理端页面报「无法连接管理 API」**  
   开发模式需同时起 API：使用 `pnpm dev:admin`，并确认 18791 未被占用；或检查 Vite 代理 `/api` 是否指向该端口。

---

## 许可证与致谢

- 上游概念与协议对齐 **[HKUDS/nanobot](https://github.com/HKUDS/nanobot)**。  
- 本 TypeScript 实现的许可证以仓库内 `LICENSE` 为准（若未添加，请自行补充）。

更细的**数据流、调用顺序与扩展点**见 **`packages/nanobot/docs/PRINCIPLES.md`**（若仓库中包含该文件）。
