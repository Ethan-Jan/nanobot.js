/**
 * 对应上游：`nanobot channels status` / `channels login` 等
 */

import { describeChannelsStatus } from "../channels/registry.js";

export function runChannelsStatus(): void {
  console.log(describeChannelsStatus());
}

export function runChannelsLogin(): void {
  console.log(
    "[nanobot] channels login：stub。上游用于 WhatsApp bridge 等扫码登录；Node 侧需接入对应 bridge 二进制与配置。",
  );
}
