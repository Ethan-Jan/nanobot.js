/**
 * 供 @nanobot/api（Nest）等 Node 服务打包引用；CLI 仍使用 dist/cli.js。
 */
export { configPath, loadConfig, mergeAndSave, type NanobotConfig } from "./config.js";
export { runAgentWithHistory, type AgentChatHistoryItem } from "./agent.js";
export {
  weixinHasPersistedToken,
  startWeixinQrSession,
  pollWeixinQrAndMaybeSave,
  type WeixinQrStartResult,
  type WeixinQrPollResult,
} from "./nanobot/channels/weixin/weixinQrLogin.js";
