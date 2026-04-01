/**
 * 在其它模块读取 process.env 之前执行：加载工程根目录或当前工作目录下的 .env
 * Windows 记事本保存的 UTF-8 BOM 会导致首行变量名异常，此处先去掉 BOM 再 parse。
 */
import { parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cwdEnv = join(process.cwd(), ".env");
const entryDir = dirname(fileURLToPath(import.meta.url));
const repoEnv = join(entryDir, "..", ".env");

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function applyEnvFile(path: string, override: boolean): void {
  if (!existsSync(path)) return;
  const raw = stripBom(readFileSync(path, "utf8"));
  const parsed = parse(raw);
  for (const [key, value] of Object.entries(parsed)) {
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** 先仓库根 .env，再 cwd .env（覆盖） */
applyEnvFile(repoEnv, false);
applyEnvFile(cwdEnv, true);
