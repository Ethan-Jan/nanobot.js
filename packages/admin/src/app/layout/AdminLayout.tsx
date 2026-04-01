import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu, theme as antdTheme, Typography } from "antd";
import { getAdminSiderMenuItems } from "@/app/nav/adminMenu";
import { ADMIN_PAGE_TITLES, PATH_BY_MENU, menuKeyFromPath, type MenuKey } from "@/app/nav/paths";

const { Header, Sider, Content } = Layout;

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { token } = antdTheme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const key = menuKeyFromPath(location.pathname);

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
          items={getAdminSiderMenuItems()}
          onClick={({ key: k }) => {
            navigate(PATH_BY_MENU[k as MenuKey]);
          }}
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
            {ADMIN_PAGE_TITLES[key]}
          </Typography.Title>
        </Header>
        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
