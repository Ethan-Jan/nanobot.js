/**
 * 上游对应：`nanobot/security/*`
 *
 * 上游可能包含：命令白名单、路径策略、敏感操作确认、容器/用户降权等。
 *
 * 当前 TS：工具层由 `tools/run.ts` 做 workspace 根目录限制 + `allowShell`；
 * 本文件预留扩展点。
 */
export interface SandboxPolicy {
  workspaceRoot: string;
  allowShell: boolean;
}

export function describeSandbox(_p: SandboxPolicy): string {
  return "sandbox：当前仅路径约束 + shell 开关；未实现上游完整策略引擎。";
}
