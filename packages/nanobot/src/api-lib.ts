/**
 * 供 @nanobot/api（Nest）等 Node 服务打包引用；CLI 仍使用 dist/cli.js。
 */
export { configPath, loadConfig, mergeAndSave, type NanobotConfig } from "./config.js";
export { runAgentWithHistory, type AgentChatHistoryItem } from "./agent.js";
export {
  weixinHasPersistedToken,
  startWeixinQrSession,
  pollWeixinQrAndMaybeSave,
  type WeixinQrStartResult,
  type WeixinQrPollResult,
} from "./nanobot/channels/weixin/weixinQrLogin.js";

// ===== 技能系统导出 =====
export {
  loadAllSkills,
  loadSkillPromptFragments,
  getCodeAnalysisReport,
  listAvailableSkills,
} from "./nanobot/skills/skillsLoader.js";

export type { SkillManifest } from "./nanobot/skills/skillsLoader.js";

export {
  addTodo,
  listTodos,
  updateTodo,
  deleteTodo,
  getTodoStats,
  runTodoTool,
} from "./nanobot/skills/todo.js";

export type { Todo, TodoList } from "./nanobot/skills/todo.js";

// 技能管理工具函数
export {
  importSkillFromGitHub,
  deleteSkill,
  getSkillDetail,
  getAllSkillsWithMetadata,
  searchGitHubSkills,
} from "./nanobot/skills/skillManager.js";

export type {
  GitHubSkillInfo,
  SkillDetail,
} from "./nanobot/skills/skillManager.js";
