import { defaultConfig, type NanobotConfig, type WeixinChannelConfig } from "../../../config.js";
import { DEFAULT_LONG_POLL_TIMEOUT_S } from "./constants.js";

export type MergedWeixinChannelConfig = Required<
  Pick<
    WeixinChannelConfig,
    "base_url" | "cdn_base_url" | "poll_timeout" | "allow_from" | "token" | "state_dir" | "enabled"
  >
> & { route_tag: string | number | null };

export function mergedWeixinConfig(cfg: NanobotConfig): MergedWeixinChannelConfig {
  const d = defaultConfig().channels!.weixin!;
  const w = cfg.channels?.weixin ?? {};
  return {
    enabled: w.enabled ?? d.enabled ?? false,
    allow_from: w.allow_from ?? d.allow_from ?? [],
    base_url: w.base_url ?? d.base_url!,
    cdn_base_url: w.cdn_base_url ?? d.cdn_base_url!,
    route_tag: w.route_tag ?? d.route_tag ?? null,
    token: w.token ?? d.token ?? "",
    state_dir: w.state_dir ?? d.state_dir ?? "",
    poll_timeout: w.poll_timeout ?? d.poll_timeout ?? DEFAULT_LONG_POLL_TIMEOUT_S,
  };
}
