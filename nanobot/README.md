# nanobot (TypeScript)

基于 **OpenAI 兼容 API** 的轻量本地 AI 助手 CLI，结构对齐 **[HKUDS/nanobot](https://github.com/HKUDS/nanobot)**（Python 原版），使用 **TypeScript + Node 20+** 实现。适合在终端对话、读写工作区文件、以及通过 **微信 iLink** 做个人号文本机器人（部分能力）。

> **说明**：本仓库是**部分移植**（结构 + 核心 Agent + 微信文本通道等），**并非**与上游 Python 版 1:1 功能等价。完整对照请运行 **`node dist/cli.js parity`** 或查看 `src/nanobot/PARITY.ts`。

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
| `channels.weixin.enabled` 与 `pnpm start` 并联长轮询 | 支持 |
| Gateway / 多通道总线 / MCP / 完整 Cron | 多为 stub，见 PARITY |

---

## 环境要求

- **Node.js ≥ 20**
- 网络可达所选 LLM 的 API（国内 Kimi 需能访问 `api.moonshot.cn`）
- 使用微信通道时需能访问 `https://ilinkai.weixin.qq.com`（或你在配置中指定的 `base_url`）

---

## 快速开始

```bash
npm install
npm run build
```

### 1. 配置密钥（推荐 `.env`）

在项目根目录自建 `.env`（该文件已在 `.gitignore` 中）：

```env
# 国内 Kimi 开放平台申请的 Key
MOONSHOT_API_KEY=sk-...
```

密钥也可写在 `nanobot.config.json` 的 `providers.<name>.apiKey`（**不要提交到 Git**）。

### 2. 配置文件

默认读取**项目根目录** `nanobot.config.json`（可通过环境变量 `NANOBOT_CONFIG` 指向其他路径）。

若仓库中该文件被 `.gitignore` 忽略，可执行：

```bash
node dist/cli.js onboard
```

再按需编辑 `agents.defaults`、`providers`、`tools`、`channels.weixin` 等。

### 3. 启动终端助手

```bash
npm start
# 或
node dist/cli.js
```

 slash 命令：`/help`、`/new`（清空对话并删本会话记忆文件）、`/memory`（路径提示）、`/status`、`/exit` 等。

### 4.（可选）微信通道

```bash
node dist/cli.js channels weixin login
```

在 `nanobot.config.json` 中设置 `channels.weixin.enabled: true` 后，**同一进程**下 `pnpm start` 会在后台并联微信长轮询（须已成功 login 或已配置有效 `token`）。

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

`.env` 先于 CWD 加载仓库根 `.env`，再由当前工作目录 `.env` 覆盖；已处理 UTF-8 BOM（见 `src/load-env.ts`）。

---

## CLI 命令

全局选项（多数子命令前可用）：`-c, --config <path>`，`-w, --workspace <path>`。

| 命令 | 说明 |
|------|------|
| `agent`（默认） | 交互 REPL；`-m "..."` 单条；`--allow-shell` |
| `status` | 配置路径与各 provider 密钥是否就绪 |
| `onboard` | 写入默认配置；`--wizard` / `--sync-templates` / `--refresh-only` |
| `parity` | 打印与上游 Python 的能力矩阵 |
| `gateway` | **stub**：演示启动顺序，不监听真实 HTTP |
| `channels status` / `channels login` | 通道占位说明 / stub |
| `channels weixin login` | 微信 iLink 扫码登录 |
| `channels weixin start` | 仅运行微信长轮询（不与 REPL 并联） |
| `cron list` / `cron add` | 列表 / 添加任务（add 为 stub） |
| `provider login <name>` | stub |

示例：

```bash
node dist/cli.js status
node dist/cli.js -m "用一句话介绍本项目"
node dist/cli.js channels weixin start --allow-shell
```

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
  - `base_url`、`poll_timeout` 等见 `src/config.ts` 注释。

**注意**：磁盘上的 `nanobot.config.json` 会与 `defaultConfig()` 深度合并，**JSON 中的字段覆盖代码默认值**（例如仅改 `src/config.ts` 的默认 `enabled` 不会生效，若 JSON 里仍为 `false`）。

---

## 工具与安全

- 所有文件路径限制在 **`workspaceRoot`** 内，并做路径穿越检查。
- **`write_file`** 拒绝敏感路径（如 `.env`、常见私钥名、`.nanobot-runtime/weixin/account.json`、`.pem/.p12/.pfx` 等），见 `src/tools/writeGuard.ts`。
- **`run_shell`** 仅在显式开启时使用，在**工作区根目录**执行命令，风险自负。

---

## 开发

```bash
npm run dev          # 与 start:dev 相同：直接跑 TS，改源码自动重启进程
npm run start:dev    # vite-node --watch src/cli.ts（推荐日常改代码）
npm run start:reload # 先 build，再「vite build --watch」+「node --watch dist/cli.js」贴近生产 bundle 的热重载
npm run build:watch  # 仅监听重打包 dist/cli.js（可另开终端配合 node dist/cli.js）
npm run typecheck
npm run build        # 一次性产出 dist/cli.js
```

**热重载说明**

| 命令 | 行为 |
|------|------|
| `npm run dev` / `start:dev` | 不经过 `dist`，由 **vite-node** 监视 `src` 并**重启整个 Node 进程**（REPL 会话会丢）。 |
| `npm run start:reload` | 先完整 `build`，再并行 **Vite watch 打包** 与 **`node --watch dist/cli.js`**；改 TS 后自动重编并重启 CLI。 |
| `npm start` | 无热重载，适合稳定运行。 |

微信长轮询与 REPL 同进程时，进程重启会断开长轮询，属预期现象。

---

## 目录结构（节选）

```
src/
  cli.ts                 # 入口：先 load-env，再 commander
  load-env.ts
  config.ts              # 配置加载、合并、路径
  agent.ts               # REPL、模型-工具循环、微信并联入口
  providers/             # OpenAI 兼容客户端与错误说明
  tools/                 # 工具定义与执行
  nanobot/
    cli/                 # 各子命令实现
    channels/weixin/     # iLink 桥接
    command/             # REPL slash 路由
    PARITY.ts            # 与上游对照表
```

运行时状态（微信登录态等）：`<repo>/.nanobot-runtime/`（建议勿提交）。

---

## 常见问题

1. **401 Invalid Authentication**  
   检查 Key 是否与 `baseUrl` 同属国内或国际；`node dist/cli.js status` 是否显示 `ready`。

2. **400 temperature**  
   Moonshot 部分模型仅支持 `temperature: 1`，已按 provider 自动设置。

3. **微信并联不启动**  
   确认 `nanobot.config.json` 里 `channels.weixin.enabled` 为 `true`，并已 `login`。

4. **微信 `fetch failed` / `ECONNRESET`**  
   网络或代理问题；可设 `NANOBOT_WEIXIN_VERBOSE=1` 查看详细日志。

---

## 许可证与致谢

- 上游概念与协议对齐 **[HKUDS/nanobot](https://github.com/HKUDS/nanobot)**。  
- 本 TypeScript 实现的许可证以仓库内 `LICENSE` 为准（若未添加，请自行补充）。

更细的**数据流、调用顺序与扩展点**见 **`docs/PRINCIPLES.md`**。
