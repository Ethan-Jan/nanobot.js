import OpenAI from "openai";
import { configPath } from "../config.js";

export interface ChatDiagContext {
  providerName: string;
  model: string;
  baseURL: string;
}

/**
 * 把 OpenAI SDK / 网关返回的错误转成可操作的说明（尤其 401）。
 */
export function explainChatApiError(err: unknown, ctx: ChatDiagContext): string {
  const path = configPath();
  const head = `[API 错误] provider=${ctx.providerName} model=${ctx.model} baseURL=${ctx.baseURL}`;

  if (err instanceof OpenAI.APIError) {
    const st = err.status;
    const msg = err.message || String(err.error ?? "");

    if (st === 401 || /401|Invalid Authentication|invalid.*api.*key/i.test(msg)) {
      return [
        `${head}`,
        `HTTP 401：密钥无效、过期，或与当前平台不一致。`,
        ``,
        `请逐项检查：`,
        `1) ${path} → providers.${ctx.providerName}.apiKey（或 .env：MOONSHOT_API_KEY / OPENROUTER_API_KEY 等）`,
        `2) Key 是否完整复制、前后无空格/引号；是否在对应平台重新生成过`,
        `3) agents.defaults.provider 是否与 Key 匹配：moonshot 只能用 Kimi 的 Key；zhipuai/bigmodel 须用智谱开放平台 Key；不能与 OpenRouter 混用`,
        `4) agents.defaults.model 是否为该平台支持的 id（Kimi：kimi-k2.5 等；智谱：glm-4-flash 等，勿填 openai/gpt-4o-mini 这类 OpenRouter 名）`,
        `5) Kimi：国内 Key 须配 providers.moonshot.baseUrl=https://api.moonshot.cn/v1；国际站用 https://api.moonshot.ai/v1（混用会 401）`,
        ``,
        `可先运行：node dist/cli.js status`,
      ].join("\n");
    }

    return `${head}\n${msg} (status=${st ?? "?"})`;
  }

  if (err instanceof Error) {
    return `${head}\n${err.message}`;
  }

  return `${head}\n${String(err)}`;
}
