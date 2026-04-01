import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { message } from "antd";
import { postChat, type ChatTurn } from "@/shared/api";
import {
  deriveThreadTitle,
  loadThreadsFromStorage,
  newThreadId,
  saveThreadsToStorage,
} from "../storage";
import type { ChatThread } from "../types";

export function useChatWorkspace() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let list = loadThreadsFromStorage();
    if (list.length === 0) {
      const id = newThreadId();
      list = [{ id, title: "新对话", updatedAt: Date.now(), turns: [] }];
      saveThreadsToStorage(list);
    }
    setThreads(list);
    setActiveId(list[0]!.id);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveThreadsToStorage(threads);
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
    setDraft("");
  }, []);

  const selectThread = useCallback(
    (id: string) => {
      if (loading) return;
      setActiveId(id);
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
    setDraft("");
  }, [activeId, updateActiveThread]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || loading || !activeId || !active) return;
    const nextMessages: ChatTurn[] = [...turns, { role: "user", content: text }];
    updateActiveThread((t) => ({
      ...t,
      turns: nextMessages,
      title: t.title === "新对话" ? deriveThreadTitle(nextMessages) : t.title,
      updatedAt: Date.now(),
    }));
    setDraft("");
    setLoading(true);
    try {
      const reply = await postChat(nextMessages, activeId);
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeId
            ? {
                ...t,
                turns: [...nextMessages, { role: "assistant", content: reply }],
                title:
                  t.title === "新对话"
                    ? deriveThreadTitle([...nextMessages, { role: "assistant", content: reply }])
                    : t.title,
                updatedAt: Date.now(),
              }
            : t,
        ),
      );
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
      setThreads((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, turns: t.turns.slice(0, -1) } : t)),
      );
    } finally {
      setLoading(false);
    }
  }, [draft, loading, activeId, active, turns, updateActiveThread]);

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.updatedAt - a.updatedAt),
    [threads],
  );

  return {
    hydrated,
    activeId,
    draft,
    setDraft,
    loading,
    turns,
    sortedThreads,
    listEndRef,
    createThread,
    selectThread,
    removeThread,
    clearCurrentThread,
    sendMessage,
  };
}
