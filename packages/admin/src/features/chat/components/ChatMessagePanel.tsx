import type { KeyboardEvent, RefObject } from "react";
import { Button, Card, Input, Spin, Typography } from "antd";
import type { ChatTurn } from "@/shared/api";

const { TextArea } = Input;

type Props = {
  turns: ChatTurn[];
  loading: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onDraftKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onClearThread: () => void;
  listEndRef: RefObject<HTMLDivElement | null>;
  onStop: () => void;
};

export function ChatMessagePanel({
  turns,
  loading,
  draft,
  onDraftChange,
  onSend,
  onClearThread,
  listEndRef,
  onStop,
  onDraftKeyDown,
}: Props) {
  return (
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
        {loading &&
        turns.length > 0 &&
        turns[turns.length - 1]?.role === "assistant" &&
        !turns[turns.length - 1]?.content ? (
          <div style={{ textAlign: "center", padding: 16 }}>
            <Spin size="medium" tip="模型思考中…" />
          </div>
        ) : null}
        <div ref={listEndRef} />
      </div>
      <TextArea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder="Enter 发送，Shift+Enter 换行；单行时 ↑↓ 浏览本会话发过的内容；生成中 Esc 可停止"
        autoSize={{ minRows: 2, maxRows: 6 }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && loading) {
            e.preventDefault();
            onStop();
            return;
          }
          onDraftKeyDown(e);
          if (e.key !== "Enter" || e.shiftKey) return;
          if (e.defaultPrevented) return;
          if (e.nativeEvent.isComposing) return;
          e.preventDefault();
          void onSend();
        }}
        disabled={loading}
      />
      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button onClick={onClearThread}>清空当前会话</Button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {loading ? (
            <Button danger onClick={onStop}>
              停止生成
            </Button>
          ) : null}
          <Button
            type="primary"
            onClick={() => void onSend()}
            loading={loading}
            disabled={loading || !draft.trim()}
          >
            发送
          </Button>
        </div>
      </div>
    </Card>
  );
}
