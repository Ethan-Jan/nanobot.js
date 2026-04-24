import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "@/app/layout/AdminLayout";
import { ChatPage } from "@/features/chat/ChatPage";
import { ConfigPage } from "@/features/config/ConfigPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ProvidersPage } from "@/features/providers/ProvidersPage";
import { SkillsPage } from "@/features/skills/SkillsPage";
import { McpPage } from "@/features/mcp/McpPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="mcp" element={<McpPage />} />
        <Route path="config" element={<ConfigPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
