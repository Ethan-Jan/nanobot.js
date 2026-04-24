import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App } from "antd";
import { postChatStream, type ChatTurn } from "@/shared/api";
import {
  deriveThreadTitle,
  loadThreadsFromStorage,
  newThreadId,
  saveThreadsToStorage,
} from "../storage";
import type { ChatThread } from "../types";

export function useChatWorkspace() {
  const { message } = App.useApp();
  const messageRef = useRef(message);
  messageRef.current = message;

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  /** `null` = 未浏览历史，正在自填；`number` = 正在查看 `userInputHistory[index]` */
  const [inputHistoryIndex, setInputHistoryIndex] = useState<number | null>(null);
  const stashedDraftRef = useRef("");

  useEffect(() => {
    let list = loadThreadsFromStorage();
    if (list.length === 0) {
      const id = newThreadId();
      list = [{ id, title: "新对话", updatedAt: Date.now(), turns: [] }];
      if (!saveThreadsToStorage(list)) {
        messageRef.current.warning("无法写入本地存储，刷新后历史可能丢失。");
      }
    }
    setThreads(list);
    setActiveId(list[0]!.id);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!saveThreadsToStorage(threads)) {
      messageRef.current.warning("无法写入本地存储，刷新后历史可能丢失。");
    }
  }, [threads, hydrated]);

  useEffect(() => {
    if (!hydrated || threads.length === 0) return;
    if (!activeId || !threads.some((t) => t.id === activeId)) {
      setActiveId(threads[0]!.id);
    }
  }, [threads, activeId, hydrated]);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId],
  );
  const turns = active?.turns ?? [];
  /** 从当前对话轮次提取的用户消息，供输入框上下键复用；与 turns 同序、由旧到新 */
  const userInputHistory = useMemo(
    () => turns.filter((m) => m.role === "user").map((m) => m.content),
    [turns],
  );

  useEffect(() => {
    setInputHistoryIndex(null);
    stashedDraftRef.current = "";
  }, [activeId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading, activeId]);

  const updateActiveThread = useCallback((updater: (t: ChatThread) => ChatThread) => {
    setThreads((prev) => prev.map((t) => (t.id === activeId ? updater(t) : t)));
  }, [activeId]);

  const createThread = useCallback(() => {
    const id = newThreadId();
    const next: ChatThread = { id, title: "新对话", updatedAt: Date.now(), turns: [] };
    setThreads((prev) => [next, ...prev]);
    setActiveId(id);
    setInputHistoryIndex(null);
    setDraft("");
  }, []);

  const selectThread = useCallback(
    (id: string) => {
      if (loading) return;
      setActiveId(id);
      setInputHistoryIndex(null);
      setDraft("");
    },
    [loading],
  );

  const removeThread = useCallback((id: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        return [{ id: newThreadId(), title: "新对话", updatedAt: Date.now(), turns: [] }];
      }
      return next;
    });
  }, []);

  const clearCurrentThread = useCallback(() => {
    if (!activeId) return;
    updateActiveThread((t) => ({
      ...t,
      turns: [],
      title: "新对话",
      updatedAt: Date.now(),
    }));
    setInputHistoryIndex(null);
    setDraft("");
  }, [activeId, updateActiveThread]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || loading || !activeId || !active) return;
    setInputHistoryIndex(null);
    const nextMessages: ChatTurn[] = [...turns, { role: "user", content: text }];
    updateActiveThread((t) => ({
      ...t,
      turns: nextMessages,
      title: t.title === "新对话" ? deriveThreadTitle(nextMessages) : t.title,
      updatedAt: Date.now(),
    }));
    setDraft("");
    setLoading(true);
    streamAbortRef.current = new AbortController();
    const withAssistant = [...nextMessages, { role: "assistant" as const, content: "" }];
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeId
          ? { ...t, turns: withAssistant, updatedAt: Date.now() }
          : t,
      ),
    );
    let acc = "";
    try {
      await postChatStream(
        nextMessages,
        activeId,
        (chunk) => {
          acc += chunk;
          setThreads((prev) =>
            prev.map((t) => {
              if (t.id !== activeId) return t;
              const u = [...t.turns];
              if (u.length === 0) return t;
              u[u.length - 1] = { role: "assistant", content: acc };
              return {
                ...t,
                turns: u,
                title:
                  t.title === "新对话" ? deriveThreadTitle([...nextMessages, { role: "assistant", content: acc }]) : t.title,
                updatedAt: Date.now(),
              };
            }),
          );
        },
        { signal: streamAbortRef.current.signal },
      );
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (aborted) {
        const note = acc.trim() ? `${acc}\n\n*[已停止生成]*` : "[已停止生成]";
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id !== activeId) return t;
            const u = [...t.turns];
            if (u.length === 0) return t;
            u[u.length - 1] = { role: "assistant", content: note };
            return { ...t, turns: u, updatedAt: Date.now() };
          }),
        );
        messageRef.current.info("已停止生成。可用 ↑↓ 在输入框快速调出本会话发过的文字。");
      } else {
        message.error(e instanceof Error ? e.message : String(e));
        setThreads((prev) =>
          prev.map((t) => (t.id === activeId ? { ...t, turns: t.turns.slice(0, -2) } : t)),
        );
      }
    } finally {
      streamAbortRef.current = null;
      setLoading(false);
    }
  }, [draft, loading, activeId, active, turns, updateActiveThread]);

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.updatedAt - a.updatedAt),
    [threads],
  );

  const stopGeneration = useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  /** 用户编辑输入时退出历史浏览 */
  const onDraftUserInput = useCallback((v: string) => {
    setInputHistoryIndex(null);
    setDraft(v);
  }, []);

  /**
   * 输入框内 ↑↓ 快速遍历本会话已发送过的用户消息（单行编辑时；含换行时走默认光标行为）。
   */
  const onDraftKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (loading) return;
      if (draft.includes("\n")) return;
      if (userInputHistory.length === 0) return;

      e.preventDefault();
      if (e.key === "ArrowUp") {
        if (inputHistoryIndex === null) {
          stashedDraftRef.current = draft;
          const idx = userInputHistory.length - 1;
          setInputHistoryIndex(idx);
          setDraft(userInputHistory[idx]!);
          return;
        }
        const idx = Math.max(0, inputHistoryIndex - 1);
        setInputHistoryIndex(idx);
        setDraft(userInputHistory[idx]!);
        return;
      }
      if (inputHistoryIndex === null) return;
      if (inputHistoryIndex < userInputHistory.length - 1) {
        const idx = inputHistoryIndex + 1;
        setInputHistoryIndex(idx);
        setDraft(userInputHistory[idx]!);
        return;
      }
      setInputHistoryIndex(null);
      setDraft(stashedDraftRef.current);
    },
    [draft, inputHistoryIndex, loading, userInputHistory],
  );

  return {
    hydrated,
    activeId,
    draft,
    onDraftUserInput,
    onDraftKeyDown,
    loading,
    turns,
    sortedThreads,
    listEndRef,
    createThread,
    selectThread,
    removeThread,
    clearCurrentThread,
    sendMessage,
    stopGeneration,
  };
}
