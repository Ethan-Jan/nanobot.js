import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, List, Popconfirm, Spin, Typography, message } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { postChat, type ChatTurn } from "../api";

const { TextArea } = Input;

const STORAGE_KEY = "nanobot-admin-chat-threads-v1";

type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  turns: ChatTurn[];
};

function newThreadId(): string {
  return crypto.randomUUID();
}

function deriveTitle(turns: ChatTurn[]): string {
  const first = turns.find((t) => t.role === "user");
  if (!first?.content?.trim()) return "新对话";
  const line = first.content.trim().split(/\r?\n/)[0] ?? "";
  return line.length > 36 ? `${line.slice(0, 36)}…` : line || "新对话";
}

function loadThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

function saveThreads(threads: ChatThread[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  } catch (e) {
    message.warning("无法写入本地存储，刷新后历史可能丢失。");
    console.error(e);
  }
}

export default function ChatPage() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let list = loadThreads();
    if (list.length === 0) {
      const id = newThreadId();
      list = [{ id, title: "新对话", updatedAt: Date.now(), turns: [] }];
      saveThreads(list);
    }
    setThreads(list);
    setActiveId(list[0]!.id);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveThreads(threads);
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

  const createThread = () => {
    const id = newThreadId();
    const next: ChatThread = { id, title: "新对话", updatedAt: Date.now(), turns: [] };
    setThreads((prev) => [next, ...prev]);
    setActiveId(id);
    setDraft("");
  };

  const selectThread = (id: string) => {
    if (loading) return;
    setActiveId(id);
    setDraft("");
  };

  const removeThread = (id: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        return [{ id: newThreadId(), title: "新对话", updatedAt: Date.now(), turns: [] }];
      }
      return next;
    });
  };

  const handleClearCurrent = () => {
    if (!activeId) return;
    updateActiveThread((t) => ({
      ...t,
      turns: [],
      title: "新对话",
      updatedAt: Date.now(),
    }));
    setDraft("");
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || loading || !activeId || !active) return;
    const nextMessages: ChatTurn[] = [...turns, { role: "user", content: text }];
    updateActiveThread((t) => ({
      ...t,
      turns: nextMessages,
      title: t.title === "新对话" ? deriveTitle(nextMessages) : t.title,
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
                title: t.title === "新对话" ? deriveTitle([...nextMessages, { role: "assistant", content: reply }]) : t.title,
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
  };

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.updatedAt - a.updatedAt),
    [threads],
  );

  if (!hydrated || !activeId) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        对话列表保存在本机浏览器（localStorage）。每条会话对应服务端记忆键 <code>admin:web:&lt;会话ID&gt;</code>，与 CLI 其它会话隔离。出于安全，此入口<strong>不会</strong>开启{" "}
        <code>run_shell</code>。
      </Typography.Paragraph>
      <div
        style={{
          display: "flex",
          gap: 16,
          height: "calc(100vh - 220px)",
          minHeight: 360,
        }}
      >
        <Card
          size="small"
          title="历史会话"
          style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column" }}
          styles={{ body: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: 8 } }}
          extra={
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={createThread}>
              新建
            </Button>
          }
        >
          <List
            size="small"
            style={{ flex: 1, overflowY: "auto" }}
            dataSource={sortedThreads}
            locale={{ emptyText: "暂无" }}
            renderItem={(t) => (
              <List.Item
                style={{
                  cursor: loading ? "not-allowed" : "pointer",
                  padding: "8px 10px",
                  borderRadius: 6,
                  marginBottom: 4,
                  background: t.id === activeId ? "var(--ant-color-primary-bg, #e6f4ff)" : undefined,
                }}
                onClick={() => selectThread(t.id)}
                actions={[
                  <Popconfirm
                    key="del"
                    title="删除此会话？"
                    description="将移除侧边栏条目并删除本机保存的该对话内容。服务端该会话 ID 对应的记忆文件仍可能留在磁盘上。"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => removeThread(t.id)}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={loading}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Typography.Text ellipsis style={{ maxWidth: 160 }}>
                      {t.title}
                    </Typography.Text>
                  }
                  description={
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(t.updatedAt).toLocaleString()}
                    </Typography.Text>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
        <Card
          style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}
          styles={{ body: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" } }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              marginBottom: 12,
              padding: 8,
              background: "var(--ant-color-fill-quaternary, #f5f5f5)",
              borderRadius: 8,
            }}
          >
            {turns.length === 0 && !loading ? (
              <Typography.Text type="secondary">在下方输入消息开始对话。</Typography.Text>
            ) : null}
            {turns.map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: t.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    background: t.role === "user" ? "var(--ant-color-primary, #1677ff)" : "#fff",
                    color: t.role === "user" ? "#fff" : "inherit",
                    border:
                      t.role === "assistant" ? "1px solid var(--ant-color-border-secondary, #f0f0f0)" : undefined,
                  }}
                >
                  {t.content}
                </div>
              </div>
            ))}
            {loading ? (
              <div style={{ textAlign: "center", padding: 16 }}>
                <Spin tip="模型思考中…" />
              </div>
            ) : null}
            <div ref={listEndRef} />
          </div>
          <TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Enter 发送，Shift+Enter 换行"
            autoSize={{ minRows: 2, maxRows: 6 }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              if (e.nativeEvent.isComposing) return;
              e.preventDefault();
              void handleSend();
            }}
            disabled={loading}
          />
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <Button onClick={handleClearCurrent}>清空当前会话</Button>
            <Button type="primary" onClick={() => void handleSend()} loading={loading} disabled={!draft.trim()}>
              发送
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
