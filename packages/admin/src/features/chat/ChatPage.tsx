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
  } = useChatWorkspace();

  if (!hydrated || !activeId) {
    return <PageSpinner size="medium" />;
  }

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        对话列表保存在本机浏览器（localStorage）。每条会话对应服务端记忆键 <code>admin:web:&lt;会话ID&gt;</code>，与 CLI
        其它会话隔离。出于安全，此入口<strong>不会</strong>开启 <code>run_shell</code>。生成过程中可点<strong>停止</strong>
        或按 <kbd>Esc</kbd>。在输入框<strong>单行</strong>编辑时可用 <kbd>↑</kbd>
        <kbd>↓</kbd> 快速调出本会话发过的内容。
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
          onDraftChange={onDraftUserInput}
          onDraftKeyDown={onDraftKeyDown}
          onSend={sendMessage}
          onClearThread={clearCurrentThread}
          listEndRef={listEndRef}
          onStop={stopGeneration}
        />
      </div>
    </div>
  );
}
