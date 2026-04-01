/**
 * `nanobot channels weixin login|start`
 * 对齐上游 `nanobot channels login -c weixin` 与 gateway 内 weixin 通道。
 */

import { loadConfig } from "../../config.js";
import { WeixinIlinkBridge } from "../channels/weixin/weixinIlinkBridge.js";

export async function runWeixinLogin(opts: { force?: boolean }): Promise<void> {
  const cfg = await loadConfig();
  const bridge = new WeixinIlinkBridge(cfg);
  const ok = await bridge.login({ force: opts.force });
  if (!ok) process.exitCode = 1;
}

export async function runWeixinStart(opts: { allowShell?: boolean }): Promise<void> {
  const cfg = await loadConfig();
  const bridge = new WeixinIlinkBridge(cfg);
  await bridge.runLoop({ allowShell: opts.allowShell });
}
