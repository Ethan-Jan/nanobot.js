/**
 * 技能模块导出
 * 
 * 技能系统允许为 nanobot 添加领域特定的能力：
 * - 代码分析和项目概览
 * - Todo 任务管理
 * - 自定义提示片段（通过 skills/ 目录）
 * - 工具和扩展
 */

export {
  loadAllSkills,
  loadSkillPromptFragments,
  getCodeAnalysisReport,
  listAvailableSkills,
} from "./skillsLoader.js";

export type { SkillManifest } from "./skillsLoader.js";

export {
  analyzeCodeFile,
  scanProjectStructure,
  generateProjectReport,
  detectCircularDeps,
} from "./codeAnalyzer.js";

export type { FileAnalysis, ProjectStructure } from "./codeAnalyzer.js";

// ===== Todo Management =====
export {
  addTodo,
  listTodos,
  updateTodo,
  deleteTodo,
  getTodoStats,
  runTodoTool,
} from "./todo.js";

export type { Todo, TodoList } from "./todo.js";

// ===== Skill Manager =====
export {
  importSkillFromGitHub,
  deleteSkill,
  getSkillDetail,
  searchGitHubSkills,
  getAllSkillsWithMetadata,
} from "./skillManager.js";

export type {
  GitHubSkillInfo,
  SkillDetail,
} from "./skillManager.js";
