import { Typography } from "antd";
import { PageSpinner } from "@/shared/ui/PageSpinner";
import { ChatMessagePanel } from "./components/ChatMessagePanel";
import { ChatThreadSidebar } from "./components/ChatThreadSidebar";
import { useChatWorkspace } from "./hooks/useChatWorkspace";

export function ChatPage() {
  const {
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
  } = useChatWorkspace();

  if (!hydrated || !activeId) {
    return <PageSpinner size="default" />;
  }

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        对话列表保存在本机浏览器（localStorage）。每条会话对应服务端记忆键 <code>admin:web:&lt;会话ID&gt;</code>，与 CLI
        其它会话隔离。出于安全，此入口<strong>不会</strong>开启 <code>run_shell</code>。
      </Typography.Paragraph>
      <div
        style={{
          display: "flex",
          gap: 16,
          height: "calc(100vh - 220px)",
          minHeight: 360,
        }}
      >
        <ChatThreadSidebar
          threads={sortedThreads}
          activeId={activeId}
          loading={loading}
          onSelect={selectThread}
          onCreate={createThread}
          onRemove={removeThread}
        />
        <ChatMessagePanel
          turns={turns}
          loading={loading}
          draft={draft}
          onDraftChange={setDraft}
          onSend={sendMessage}
          onClearThread={clearCurrentThread}
          listEndRef={listEndRef}
        />
      </div>
    </div>
  );
}
