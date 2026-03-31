/**
 * 上游对应：`nanobot/agent/subagent.py`
 *
 * 上游子代理：独立上下文预算、工具子集、可并行；主 Agent 汇总结果。
 *
 * 当前：未实现。若需移植，建议先定最小 API：`spawnSubagent(task, tools)` 返回 Promise<string>。
 */
export async function runSubagentStub(_task: string): Promise<string> {
  return "[nanobot][subagent] stub：未执行子代理。";
}
