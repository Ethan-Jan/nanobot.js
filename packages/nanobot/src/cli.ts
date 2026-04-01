#!/usr/bin/env node
/**
 * CLI 入口（等价于上游 `python -m nanobot` / `nanobot` console_scripts）。
 * 子命令注册集中在 `nanobot/cli/register.ts`，并与 `src/nanobot/**` 下的模块对齐。
 */
import "./load-env.js";
import { Command } from "commander";
import { registerNanobotCli } from "./nanobot/cli/register.js";

const program = new Command();
program.name("nanobot").description("nanobot TypeScript port（对齐 HKUDS/nanobot 子命令结构）").version("0.1.0");

registerNanobotCli(program);

/** `pnpm run start -- subcmd` 有时会把字面量 `--` 放进 argv，commander 会误解析 */
function argvForCommander(): string[] {
  const a = [...process.argv];
  const i = a.findIndex((x, idx) => idx >= 2 && x === "--");
  if (i >= 2) a.splice(i, 1);
  return a;
}

program.parseAsync(argvForCommander()).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
