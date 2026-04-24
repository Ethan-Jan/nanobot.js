export type MenuKey = "dashboard" | "chat" | "skills" | "providers" | "config" | "mcp" | "user-context";

export const ADMIN_PAGE_TITLES: Record<MenuKey, string> = {
  dashboard: "概览",
  chat: "对话",
  skills: "技能管理",
  providers: "模型与供应商",
  config: "高级配置",
  mcp: "MCP 服务",
  "user-context": "用户画像",
};

export const PATH_BY_MENU: Record<MenuKey, string> = {
  dashboard: "/",
  chat: "/chat",
  skills: "/skills",
  providers: "/providers",
  config: "/config",
  mcp: "/mcp",
  "user-context": "/user-context",
};

export function menuKeyFromPath(pathname: string): MenuKey {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/" || p === "/dashboard") return "dashboard";
  const seg = p.slice(1);
  if (
    seg === "chat" ||
    seg === "skills" ||
    seg === "providers" ||
    seg === "config" ||
    seg === "mcp" ||
    seg === "user-context"
  ) {
    return seg;
  }
  return "dashboard";
}

/** 侧栏「管理」子菜单的 key（非路由，仅用于 SubMenu） */
export const ADMIN_SUBMENU_MANAGE_KEY = "manage";

export const MENU_KEYS_UNDER_MANAGE: MenuKey[] = ["skills", "user-context", "providers", "config", "mcp"];

/** 仅叶子菜单项可导航；SubMenu 的 key 无路径 */
export function pathForMenuKey(key: string): string | undefined {
  if (key in PATH_BY_MENU) return PATH_BY_MENU[key as MenuKey];
  return undefined;
}
