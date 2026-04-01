import {
  DashboardOutlined,
  SettingOutlined,
  CloudServerOutlined,
  CommentOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";

export function getAdminSiderMenuItems(): MenuProps["items"] {
  return [
    { key: "dashboard", icon: <DashboardOutlined />, label: "概览" },
    { key: "chat", icon: <CommentOutlined />, label: "对话" },
    { key: "skills", icon: <ThunderboltOutlined />, label: "技能管理" },
    { key: "providers", icon: <CloudServerOutlined />, label: "模型与供应商" },
    { key: "config", icon: <SettingOutlined />, label: "高级配置" },
  ];
}
