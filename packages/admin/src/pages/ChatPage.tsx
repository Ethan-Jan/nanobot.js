import { useEffect, useRef, useState } from "react";
import { Button, Card, Input, Spin, Typography, message } from "antd";
import { postChat, type ChatTurn } from "../api";

const { TextArea } = Input;

export default function ChatPage() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  const handleClear = () => {
    setTurns([]);
    setDraft("");
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || loading) return;
    const nextMessages: ChatTurn[] = [...turns, { role: "user", content: text }];
    setTurns(nextMessages);
    setDraft("");
    setLoading(true);
    try {
      const reply = await postChat(nextMessages);
      setTurns((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
      setTurns((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        使用当前配置中的默认模型与工具（与 CLI Agent 一致）；会话键为 <code>admin:web</code>。出于安全，此入口<strong>不会</strong>开启{" "}
        <code>run_shell</code>。
      </Typography.Paragraph>
      <Card
        styles={{ body: { display: "flex", flexDirection: "column", height: "calc(100vh - 220px)", minHeight: 360 } }}
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
          <Button onClick={handleClear}>清空会话</Button>
          <Button type="primary" onClick={() => void handleSend()} loading={loading} disabled={!draft.trim()}>
            发送
          </Button>
        </div>
      </Card>
    </div>
  );
}
