/**
 * 上游对应：`nanobot/session/*`
 *
 * 上游会话键常为 `channel:chat_id`，多用户隔离；CLI 也有 `cli:direct` 等。
 *
 * 当前：单进程内存 Map，仅供未来多会话扩展占位。
 */
export class SessionStore {
  private readonly sessions = new Map<string, unknown>();

  get(_key: string): unknown {
    return this.sessions.get(_key);
  }

  set(key: string, value: unknown): void {
    this.sessions.set(key, value);
  }

  clear(key: string): void {
    this.sessions.delete(key);
  }
}
