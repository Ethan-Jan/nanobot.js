import {
  ApiOutlined,
  AppstoreOutlined,
  CloudServerOutlined,
  CommentOutlined,
  DashboardOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { ADMIN_SUBMENU_MANAGE_KEY } from "./paths";

export function getAdminSiderMenuItems(): MenuProps["items"] {
  return [
    { key: "dashboard", icon: <DashboardOutlined />, label: "概览" },
    { key: "chat", icon: <CommentOutlined />, label: "对话" },
    {
      key: ADMIN_SUBMENU_MANAGE_KEY,
      icon: <AppstoreOutlined />,
      label: "管理",
      children: [
        { key: "skills", icon: <ThunderboltOutlined />, label: "技能管理" },
        { key: "providers", icon: <CloudServerOutlined />, label: "模型与供应商" },
        { key: "mcp", icon: <ApiOutlined />, label: "MCP 服务" },
        { key: "config", icon: <SettingOutlined />, label: "高级配置" },
      ],
    },
  ];
}
