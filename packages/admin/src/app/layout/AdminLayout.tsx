import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu, theme as antdTheme, Typography } from "antd";
import { getAdminSiderMenuItems } from "@/app/nav/adminMenu";
import {
  ADMIN_PAGE_TITLES,
  ADMIN_SUBMENU_MANAGE_KEY,
  MENU_KEYS_UNDER_MANAGE,
  menuKeyFromPath,
  pathForMenuKey,
} from "@/app/nav/paths";

const { Header, Sider, Content } = Layout;

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { token } = antdTheme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const key = menuKeyFromPath(location.pathname);
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    MENU_KEYS_UNDER_MANAGE.includes(key) ? [ADMIN_SUBMENU_MANAGE_KEY] : [],
  );

  useEffect(() => {
    const leaf = menuKeyFromPath(location.pathname);
    if (MENU_KEYS_UNDER_MANAGE.includes(leaf)) {
      setOpenKeys((prev) => (prev.includes(ADMIN_SUBMENU_MANAGE_KEY) ? prev : [...prev, ADMIN_SUBMENU_MANAGE_KEY]));
    }
  }, [location.pathname]);

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
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={getAdminSiderMenuItems()}
          onClick={({ key: k }) => {
            const p = pathForMenuKey(k);
            if (p) navigate(p);
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
