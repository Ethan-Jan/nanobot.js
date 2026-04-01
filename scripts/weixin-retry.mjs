/**
 * 供 dev:all / start:all：微信长轮询退出后自动重试（例如先起了 dev:all、后在 B 端才扫码登录）。
 * 子进程被信号结束（Ctrl+C）时不重试。
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    stopping = true;
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runWeixinOnce() {
  return new Promise((resolve) => {
    const child = spawn(
      "pnpm",
      ["--filter", "nanobot", "exec", "node", "dist/cli.js", "channels", "weixin", "start"],
      { cwd: root, stdio: "inherit", shell: true },
    );
    child.on("exit", (code, signal) => {
      resolve({ code: code ?? 1, signal });
    });
  });
}

for (;;) {
  if (stopping) break;
  const { code, signal } = await runWeixinOnce();
  if (stopping) break;
  if (signal) break;
  if (code === 0) break;
  console.error(
    `[weixin-retry] 长轮询已退出 (code=${String(code)})，8 秒后重试。若在管理端刚完成扫码，下一轮将连上；也可直接重启 pnpm dev:all。\n`,
  );
  await sleep(8000);
}
