import { message } from "antd";
import type { ChatTurn } from "@/shared/api";
import type { ChatThread } from "./types";

export const CHAT_THREADS_STORAGE_KEY = "nanobot-admin-chat-threads-v1";

export function newThreadId(): string {
  return crypto.randomUUID();
}

export function deriveThreadTitle(turns: ChatTurn[]): string {
  const first = turns.find((t) => t.role === "user");
  if (!first?.content?.trim()) return "新对话";
  const line = first.content.trim().split(/\r?\n/)[0] ?? "";
  return line.length > 36 ? `${line.slice(0, 36)}…` : line || "新对话";
}

export function loadThreadsFromStorage(): ChatThread[] {
  try {
    const raw = localStorage.getItem(CHAT_THREADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is ChatThread =>
          x &&
          typeof x === "object" &&
          typeof (x as ChatThread).id === "string" &&
          typeof (x as ChatThread).title === "string" &&
          typeof (x as ChatThread).updatedAt === "number" &&
          Array.isArray((x as ChatThread).turns),
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        updatedAt: t.updatedAt,
        turns: t.turns.filter(
          (m): m is ChatTurn =>
            m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
        ),
      }));
  } catch {
    return [];
  }
}

export function saveThreadsToStorage(threads: ChatThread[]) {
  try {
    localStorage.setItem(CHAT_THREADS_STORAGE_KEY, JSON.stringify(threads));
  } catch (e) {
    message.warning("无法写入本地存储，刷新后历史可能丢失。");
    console.error(e);
  }
}
