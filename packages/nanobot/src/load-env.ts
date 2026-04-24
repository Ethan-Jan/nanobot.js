/**
 * 在其它模块读取 process.env 之前执行：加载**工程根**与**当前工作目录**下的 `.env`（与 `nanobot.config.json` 所在根一致，见 `repoRoot()`）。
 * Windows 记事本保存的 UTF-8 BOM 会导致首行变量名异常，此处先去掉 BOM 再 parse。
 */
import { parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./config.js";

const cwdEnv = join(process.cwd(), ".env");
const repoEnv = join(repoRoot(), ".env");

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

/** 先工程根 `.env`，再当前工作目录 `.env`（后者覆盖前者） */
applyEnvFile(repoEnv, false);
applyEnvFile(cwdEnv, true);
