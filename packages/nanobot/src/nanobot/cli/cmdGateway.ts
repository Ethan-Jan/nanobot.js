/**
 * 对应上游：`nanobot gateway`（`nanobot/cli/commands.py`）
 * 完整实现见 `nanobot/gateway/runtime.ts` 注释中的启动顺序。
 */

import { startGatewayStub } from "../gateway/runtime.js";

export async function runGatewayCommand(opts: { port?: string; verbose?: boolean }): Promise<void> {
  const port = opts.port ? parseInt(opts.port, 10) : undefined;
  if (opts.port && Number.isNaN(port)) {
    throw new Error(`Invalid port: ${opts.port}`);
  }
  await startGatewayStub({ port, verbose: opts.verbose });
}
