/**
 * 上游对应：`nanobot/heartbeat/*`
 *
 * 上游用途：按配置周期性触发「心跳」提示词或轻量任务，让 Agent 主动整理状态、
 * 检查待办等（与 MEMORY.md / HEARTBEAT.md 模板配合）。
 *
 * 当前：仅占位日志，不 setInterval。
 */

export class HeartbeatService {
  async startStub(): Promise<void> {
    console.error(
      "[nanobot][heartbeat] HeartbeatService 为 stub：未注册 interval。实现时需读取配置间隔并调用 AgentLoop。",
    );
  }
}
