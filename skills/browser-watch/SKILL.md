---
name: browser-watch
description: 指导把「反复打开页面、人工盯变化」变成可脚本化或可提醒的流程（Playwright/扩展/纯 Node 轮询）。本仓库根已声明 dev 依赖 playwright；浏览器二进制需用户本机执行一次 pnpm playwright:install。无需 Playwright 时用 examples/poll-url-hash.mjs 即可（仅 Node 内置 fetch）。
triggers: ["browser-watch", "监听浏览器", "页面变化", "网页监控", "自动刷新", "重复操作", "Playwright", "盯页面", "DOM 变化", "无头浏览器"]
version: "1.0.0"
---

# Browser Watch（浏览器变化与省重复手活）

本技能用于：**把用户为「等某个网页或界面变化」而反复手动的过程，改写成可复跑脚本、或定时/事件驱动的提醒。**

## 本仓库里装了什么、还要你手动装什么

| 项 | 状态 |
|----|--------|
| **根目录 `package.json` 的 `playwright`（npm 包）** | 已随 monorepo `pnpm install` 安装。 |
| **Chromium 等浏览器内核** | **不**随依赖自动下全量；在仓库根执行一次 **`pnpm run playwright:install`**（或 `pnpm exec playwright install chromium`）。未装时运行 `examples/playwright-watch-skeleton.mjs` 会报找不到 browser。 |
| **纯 URL 轮询** `examples/poll-url-hash.mjs` | **不依赖 Playwright**；仅 Node 20+（`fetch`）即可。 |

> nanobot 默认没有内置「远程浏览器控制」类工具，实现仍依赖 **`run_shell`（若已开）**、在工作区**新建脚本**（`read_file` / `write_file`），或用户自配 **MCP/浏览器** 相关工具。

## 1. 先问清场景

向用户确认：

| 问题 | 决定方案 |
|------|----------|
| 变化能否用 **HTTP/接口** 判断（如 JSON 变了）？ | 优先 **Node + `fetch` 轮询**（轻、无头浏览器），不必开 Chromium |
| 必须 **真实页面渲染后** 才能看到？ | **Playwright / Puppeteer** 打开页面、等选择器/文案 |
| 要盯 **同标签里 SPA 的 DOM**？ | 优先 Playwright 的 `waitForFunction` / `locator`；或浏览器扩展的 **MutationObserver** |
| 是否涉及登录/验证码/风控？ | 提醒用户合规；必要时 **人工登录后 cookie 存储状态文件** 再给脚本用（仅本地、注意安全） |

## 2. 方案 A：仅判断「整页/接口是否变」（适合列表、状态位、价格接口）

- 对 **可匿名 GET 的地址**：定时 `fetch`，对 body 做 **hash 或子串** 与上次比；变则打日志、发通知（用户自备 webhook、Bark、邮件脚本等）。
- 本技能目录下可参照：`examples/poll-url-hash.mjs`（纯 Node、无 Playwright）。

## 3. 方案 B：Playwright 监听 **渲染后** 的 DOM / 网络

1. **在本 monorepo 根目录**：`playwright` 已在 `devDependencies` 中。首次在本机需执行：  
   `pnpm run playwright:install`（只拉 Chromium，体积小些）。**在用户自己的其它项目**里若没有 `playwright`，再执行 `pnpm add -D playwright` 后同样 `npx playwright install chromium`。
2. 用 **稳定选择器**（`data-testid`、可访问性角色）等，避免只依赖会变的 `div:nth-child`。
3. 常用模式：
   - `page.waitForSelector` / `locator` 等某文本出现
   - `page.waitForFunction`：在页内比较 DOM 与上次 **序列化** 的片段
   - `page.on('response', …)` 过滤 XHR/ fetch 的 API，直接比对 JSON
4. 骨架见：`examples/playwright-watch-skeleton.mjs`（需本地安装 playwright 后运行）。

**注意**：尊重站点 robots / 服务条款，控制频率，勿对生产系统做 DDoS 式轮询。

## 4. 方案 C：用户本机、长期挂在浏览器里（扩展）

- **Chrome/Edge 扩展**：`chrome.tabs` + `content script` 里 **MutationObserver** 盯指定 DOM；`chrome.alarms` 做兜底轮询；变化时 badge / 系统通知（需 `notifications` 权限）。
- 适合「只在自己已登录的页面上盯板块」、无法在无头里稳定复现登录态时。

## 5. 与 MCP 联用

若用户在 `nanobot.config.json` 里已配置**浏览器/自动化类 MCP**，可优先用 MCP 暴露的工具完成「开页-截图-取 DOM」；本技能则补充 **本仓库可提交的脚本** 与 **可维护的 watch 结构**（目录、环境变量、日志）。

## 6. 落地步骤（你作为 Agent 的推荐动作）

1. 确认 `tools.allowShell` 与网络是否允许运行脚本。  
2. 若只需 HTTP：在工作区**新建** `scripts/poll-*.mjs`（可基于 `examples/poll-url-hash.mjs` 改 URL 与比较逻辑）。  
3. 若需真实 DOM：生成 Playwright 脚本，写清**安装命令**与**如何定时执行**（任务计划、cron、`while sleep` 等）。  
4. 提醒用户把 **差分通知** 接到其常用渠道，避免只打印在终端无人看。

## 7. 安全与隐私

- 不在仓库里写死长期有效的 **cookie / token**；用本地 `.env` 或 OS 凭据，并列入 `.gitignore`。  
- 对敏感页面，优先用户本机扩展 + 不导出 HTML 全量到日志。
