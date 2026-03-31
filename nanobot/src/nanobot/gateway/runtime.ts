/**
 * 上游对应：`nanobot` gateway 启动流程（见 `nanobot/cli/commands.py` 中 gateway 命令）
 *
 * 上游大致顺序：
 * 1. 加载配置
 * 2. 构造 MessageBus
 * 3. 启动 CronService、HeartbeatService
 * 4. 启动各已启用通道
 * 5. 暴露 HTTP/WebSocket 网关（默认端口等由配置决定）
 *
 * 本 TS 实现：`startGatewayStub` 仅打印对照说明，不监听端口，避免误占生产端口。
 * 后续可在此用 `node:http` 或 `fastify` 实现健康检查与 bridge 回调。
 */

import { MessageBus } from "../bus/messageBus.js";
import { CronService } from "../cron/service.js";
import { HeartbeatService } from "../heartbeat/service.js";
import { listChannelAdapters } from "../channels/registry.js";

export interface GatewayOptions {
  /** 上游 `--port` / 配置中的网关端口；stub 阶段仅打印 */
  port?: number;
  verbose?: boolean;
}

/**
 * Stub：演示启动顺序，不进入长驻监听。
 * 与上游 `nanobot gateway` 行为不等价。
 */
export async function startGatewayStub(opts: GatewayOptions = {}): Promise<void> {
  const port = opts.port ?? 18790;
  console.log(`[nanobot][gateway] stub 启动顺序演示（不会监听 :${port}）`);
  const bus = new MessageBus();
  bus.start();

  const cron = new CronService();
  await cron.startStub();

  const hb = new HeartbeatService();
  await hb.startStub();

  console.log("[nanobot][gateway] 已注册通道适配器（占位列表）:");
  for (const name of listChannelAdapters()) {
    console.log(`  - ${name}`);
  }
  console.log(
    "[nanobot][gateway] 完整实现需：HTTP 路由、鉴权、与各通道 SDK 的长连接。见 PARITY.ts。",
  );
}
