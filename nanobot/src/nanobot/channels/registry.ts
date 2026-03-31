/**
 * 上游对应：`nanobot/channels/*` 下各适配器（Telegram、Feishu、Slack、Matrix、WeChat…）
 *
 * Python 侧通过可选依赖与配置开关加载；Node 侧每个通道通常需要：
 * - 独立 npm 包 + bot token / app secret
 * - 长轮询或 WebSocket/Webhook 服务器（常由 gateway HTTP 承载）
 *
 * 此处只列出与上游文档常见通道对应的「名字」，便于 `gateway` stub 打印与后续逐个实现。
 */

export const CHANNEL_NAMES = [
  "telegram",
  "feishu",
  "lark",
  "slack",
  "discord",
  "matrix",
  "wecom",
  "wechat",
  "whatsapp",
  "qq",
  "dingtalk",
] as const;

export type ChannelName = (typeof CHANNEL_NAMES)[number];

export function listChannelAdapters(): string[] {
  return [...CHANNEL_NAMES];
}

/**
 * 上游 `nanobot channels status` 会读配置并表格展示 enabled / token 是否配置。
 * TS stub：返回静态说明。
 */
export function describeChannelsStatus(): string {
  const lines = [
    "[nanobot][channels] status",
    "· weixin（个人微信 iLink）：已实现 `channels weixin login` + `channels weixin start`，见 nanobot/channels/weixin/*",
    "· 其它通道（Telegram/Slack/…）：仍为占位，需各自 SDK。",
    `关键字列表：${CHANNEL_NAMES.join(", ")}`,
  ];
  return lines.join("\n");
}
