/**
 * 上游对应：`nanobot/cron/*`、`nanobot/agent/tools/cron.py`
 *
 * 上游能力要点：
 * - `jobs.json` 持久化定时任务
 * - cron 表达式或固定间隔
 * - 到点向 Agent 注入 system/user 消息，并可投递回通道（--deliver）
 *
 * 当前：`startStub` 仅说明；`listJobs`/`addJobStub` 为最小文件占位，便于后续接 `node-cron`。
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot } from "../../config.js";

const JOBS_BASENAME = "nanobot.cron.jobs.json";

export interface CronJobStub {
  name: string;
  cron?: string;
  everySeconds?: number;
  message: string;
}

export class CronService {
  /** 上游在 gateway 内常驻；此处不启动定时器 */
  async startStub(): Promise<void> {
    console.error(
      "[nanobot][cron] CronService 为 stub：未调度任务。CLI `nanobot cron list` 可读取占位 JSON。",
    );
  }

  jobsPath(): string {
    return join(repoRoot(), JOBS_BASENAME);
  }

  async listJobs(): Promise<CronJobStub[]> {
    try {
      const raw = await readFile(this.jobsPath(), "utf8");
      const parsed = JSON.parse(raw) as { jobs?: CronJobStub[] };
      return parsed.jobs ?? [];
    } catch {
      return [];
    }
  }

  /** 占位：实际上应校验 cron、去重、写回文件并注册调度器 */
  addJobStub(job: CronJobStub): string {
    return `[nanobot][cron] stub add：${JSON.stringify(job)} — 未写入 ${this.jobsPath()}。请后续实现持久化与 node-cron。`;
  }
}
