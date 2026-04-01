import { useState, type ReactNode } from "react";
import { Layout, Menu, theme as antdTheme, Typography } from "antd";
import {
  DashboardOutlined,
  SettingOutlined,
  CloudServerOutlined,
  CommentOutlined,
} from "@ant-design/icons";
import Dashboard from "./pages/Dashboard";
import ConfigPage from "./pages/ConfigPage";
import ProvidersPage from "./pages/ProvidersPage";
import ChatPage from "./pages/ChatPage";

const { Header, Sider, Content } = Layout;

type MenuKey = "dashboard" | "chat" | "config" | "providers";

const TITLES: Record<MenuKey, string> = {
  dashboard: "概览",
  chat: "对话",
  providers: "模型与供应商",
  config: "高级配置",
};

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [key, setKey] = useState<MenuKey>("dashboard");
  const { token } = antdTheme.useToken();

  let body: ReactNode;
  if (key === "dashboard") body = <Dashboard />;
  else if (key === "chat") body = <ChatPage />;
  else if (key === "config") body = <ConfigPage />;
  else body = <ProvidersPage />;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={220}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? 0 : "0 20px",
            fontWeight: 600,
            color: "#fff",
            fontSize: collapsed ? 12 : 15,
          }}
        >
          {collapsed ? "NB" : "Nanobot"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[key]}
          items={[
            { key: "dashboard", icon: <DashboardOutlined />, label: "概览" },
            { key: "chat", icon: <CommentOutlined />, label: "对话" },
            { key: "providers", icon: <CloudServerOutlined />, label: "模型与供应商" },
            { key: "config", icon: <SettingOutlined />, label: "高级配置" },
          ]}
          onClick={({ key: k }) => setKey(k as MenuKey)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: "0 24px",
            background: token.colorBgContainer,
            display: "flex",
            alignItems: "center",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            {TITLES[key]}
          </Typography.Title>
        </Header>
        <Content style={{ margin: 24, minHeight: 280 }}>{body}</Content>
      </Layout>
    </Layout>
  );
}
