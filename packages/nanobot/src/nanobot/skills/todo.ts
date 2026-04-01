/**
 * Todo 管理技能 - 本地任务管理
 * 提供简单的待办事项管理功能，数据存储在工作区
 */

import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";

const TODO_FILENAME = ".nanobot/todos.json";

export interface Todo {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "done";
  tags: string[];
  createdAt: number;
  updatedAt: number;
  dueAt?: number;
}

export interface TodoList {
  todos: Todo[];
  version: number;
}

async function getTodoPath(root: string): Promise<string> {
  return join(root, TODO_FILENAME);
}

async function ensureTodoDir(root: string): Promise<void> {
  const dir = join(root, ".nanobot");
  try {
    await access(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
}

async function loadTodos(root: string): Promise<TodoList> {
  try {
    const path = await getTodoPath(root);
    const content = await readFile(path, "utf8");
    return JSON.parse(content) as TodoList;
  } catch {
    return { todos: [], version: 1 };
  }
}

async function saveTodos(root: string, list: TodoList): Promise<void> {
  await ensureTodoDir(root);
  const path = await getTodoPath(root);
  await writeFile(path, JSON.stringify(list, null, 2), "utf8");
}

// ===== Skill Actions =====

export async function addTodo(
  root: string,
  title: string,
  options: {
    description?: string;
    priority?: "low" | "medium" | "high";
    tags?: string[];
    dueAt?: number;
  } = {}
): Promise<string> {
  if (!title.trim()) {
    return "Error: Title cannot be empty";
  }

  const list = await loadTodos(root);
  
  const todo: Todo = {
    id: randomUUID().slice(0, 8),
    title: title.trim(),
    description: options.description?.trim(),
    priority: options.priority || "medium",
    status: "pending",
    tags: options.tags || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    dueAt: options.dueAt,
  };

  list.todos.push(todo);
  await saveTodos(root, list);

  return `✅ Created todo #${todo.id}: ${todo.title}`;
}

export async function listTodos(
  root: string,
  options: {
    status?: "pending" | "in_progress" | "done" | "all";
    priority?: "low" | "medium" | "high";
    tag?: string;
  } = {}
): Promise<string> {
  const list = await loadTodos(root);
  
  let todos = list.todos;
  
  if (options.status && options.status !== "all") {
    todos = todos.filter(t => t.status === options.status);
  }
  
  if (options.priority) {
    todos = todos.filter(t => t.priority === options.priority);
  }
  
  if (options.tag) {
    todos = todos.filter(t => t.tags.includes(options.tag!));
  }

  // Sort by priority and creation time
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  todos.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.createdAt - a.createdAt;
  });

  if (!todos.length) {
    return "📭 No todos found.";
  }

  const parts: string[] = [];
  parts.push(`📋 Todos (${todos.length}):`);
  parts.push("");

  for (const todo of todos) {
    const statusIcon = {
      pending: "⭕",
      in_progress: "🔄",
      done: "✅",
    }[todo.status];

    const priorityIcon = { low: "🔵", medium: "🟡", high: "🔴" }[todo.priority];
    
    parts.push(`${statusIcon} #${todo.id} ${priorityIcon} ${todo.title}`);
    
    if (todo.description) {
      parts.push(`   ${todo.description.slice(0, 60)}${todo.description.length > 60 ? "..." : ""}`);
    }
    
    if (todo.tags.length) {
      parts.push(`   🏷️ ${todo.tags.join(", ")}`);
    }
    
    if (todo.dueAt) {
      const due = new Date(todo.dueAt);
      const isOverdue = todo.dueAt < Date.now() && todo.status !== "done";
      parts.push(`   ${isOverdue ? "⏰ OVERDUE" : "📅 Due"}: ${due.toLocaleDateString()}`);
    }
    
    parts.push("");
  }

  return parts.join("\n");
}

export async function updateTodo(
  root: string,
  id: string,
  updates: {
    title?: string;
    description?: string;
    status?: "pending" | "in_progress" | "done";
    priority?: "low" | "medium" | "high";
    tags?: string[];
  }
): Promise<string> {
  const list = await loadTodos(root);
  const todo = list.todos.find(t => t.id === id || t.id.startsWith(id));
  
  if (!todo) {
    return `Error: Todo #${id} not found`;
  }

  if (updates.title !== undefined) todo.title = updates.title;
  if (updates.description !== undefined) todo.description = updates.description;
  if (updates.status !== undefined) todo.status = updates.status;
  if (updates.priority !== undefined) todo.priority = updates.priority;
  if (updates.tags !== undefined) todo.tags = updates.tags;
  
  todo.updatedAt = Date.now();
  await saveTodos(root, list);

  return `✏️ Updated todo #${todo.id}: ${todo.title}`;
}

export async function deleteTodo(root: string, id: string): Promise<string> {
  const list = await loadTodos(root);
  const index = list.todos.findIndex(t => t.id === id || t.id.startsWith(id));
  
  if (index === -1) {
    return `Error: Todo #${id} not found`;
  }

  const deleted = list.todos.splice(index, 1)[0];
  await saveTodos(root, list);

  return `🗑️ Deleted todo #${deleted.id}: ${deleted.title}`;
}

export async function getTodoStats(root: string): Promise<string> {
  const list = await loadTodos(root);
  const { todos } = list;
  
  const stats = {
    total: todos.length,
    pending: todos.filter(t => t.status === "pending").length,
    in_progress: todos.filter(t => t.status === "in_progress").length,
    done: todos.filter(t => t.status === "done").length,
    high: todos.filter(t => t.priority === "high").length,
    overdue: todos.filter(t => t.dueAt && t.dueAt < Date.now() && t.status !== "done").length,
  };

  const completionRate = stats.total > 0 
    ? Math.round((stats.done / stats.total) * 100) 
    : 0;

  const parts: string[] = [];
  parts.push("📊 Todo Statistics");
  parts.push("═".repeat(30));
  parts.push(`Total: ${stats.total} todos`);
  parts.push("");
  parts.push("Status:");
  parts.push(`  ⭕ Pending:     ${stats.pending}`);
  parts.push(`  🔄 In Progress: ${stats.in_progress}`);
  parts.push(`  ✅ Done:        ${stats.done}`);
  parts.push("");
  parts.push(`High Priority: ${stats.high}`);
  parts.push(`Overdue: ${stats.overdue}`);
  parts.push("");
  parts.push(`📈 Completion Rate: ${completionRate}%`);
  
  if (completionRate === 100 && stats.total > 0) {
    parts.push("🎉 All done! Great job!");
  }

  return parts.join("\n");
}

// ===== Tool Interface for Agent =====

export async function runTodoTool(
  root: string,
  action: "add" | "list" | "update" | "delete" | "stats",
  args: Record<string, unknown>
): Promise<string> {
  switch (action) {
    case "add":
      return addTodo(root, String(args.title), {
        description: args.description as string,
        priority: args.priority as "low" | "medium" | "high",
        tags: args.tags as string[],
        dueAt: args.dueAt as number,
      });
    
    case "list":
      return listTodos(root, {
        status: args.status as "pending" | "in_progress" | "done" | "all",
        priority: args.priority as "low" | "medium" | "high",
        tag: args.tag as string,
      });
    
    case "update":
      return updateTodo(root, String(args.id), {
        title: args.title as string,
        description: args.description as string,
        status: args.status as "pending" | "in_progress" | "done",
        priority: args.priority as "low" | "medium" | "high",
        tags: args.tags as string[],
      });
    
    case "delete":
      return deleteTodo(root, String(args.id));
    
    case "stats":
      return getTodoStats(root);
    
    default:
      return `Unknown todo action: ${action}`;
  }
}
