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

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
