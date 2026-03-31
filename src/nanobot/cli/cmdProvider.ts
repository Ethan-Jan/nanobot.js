/**
 * 对应上游：`nanobot provider login`（OAuth 设备码，如 openai-codex、github-copilot）
 * 需 oauth-cli-kit 类流程；此处仅占位。
 */

export function runProviderLogin(provider: string): void {
  console.log(
    `[nanobot] provider login "${provider}"：stub。请在 TS 中接入设备码授权或直接使用 API Key（.env / nanobot.config.json）。`,
  );
}
