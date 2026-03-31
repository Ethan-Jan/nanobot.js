/**
 * 对应上游：`nanobot cron list|add|...`（`nanobot/cli/commands.py`）
 */

import { CronService } from "../cron/service.js";

export async function runCronList(): Promise<void> {
  const svc = new CronService();
  const jobs = await svc.listJobs();
  if (!jobs.length) {
    console.log(`(no jobs; stub file: ${svc.jobsPath()})`);
    return;
  }
  console.log(JSON.stringify(jobs, null, 2));
}

export function runCronAdd(opts: {
  name?: string;
  message?: string;
  cron?: string;
  every?: string;
}): void {
  const svc = new CronService();
  const msg = svc.addJobStub({
    name: opts.name ?? "unnamed",
    message: opts.message ?? "",
    cron: opts.cron,
    everySeconds: opts.every ? parseInt(opts.every, 10) : undefined,
  });
  console.log(msg);
}
