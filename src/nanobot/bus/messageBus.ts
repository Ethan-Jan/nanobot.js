/**
 * 上游对应：`nanobot/bus/*`（Python）
 *
 * 职责（概念上）：
 * - 汇聚各通道（Telegram、Slack…）的入站消息，转为统一内部事件
 * - 分发给 AgentLoop、日志、以及可能的插件
 *
 * 当前 TS：占位类型，便于日后把 `gateway` 里「假启动」换成真实 wiring。
 * 实现方向：Node 内置 EventEmitter，或 Redis Pub/Sub 多实例部署。
 */

import { EventEmitter } from "node:events";

/** 与上游「规范化消息」对应的极简占位结构 */
export interface BusEnvelope {
  channel: string;
  chatId: string;
  text: string;
  raw?: unknown;
}

export class MessageBus extends EventEmitter {
  /**
   * 上游在 gateway 启动时注册各 channel adapter 并 subscribe。
   * 此处仅占位，调用时打印提示。
   */
  start(): void {
    console.error(
      "[nanobot][bus] MessageBus.start() 为 stub：尚未注册任何 channel adapter。参见 nanobot/channels/registry.ts。",
    );
  }

  publish(_envelope: BusEnvelope): void {
    this.emit("message", _envelope);
  }
}
