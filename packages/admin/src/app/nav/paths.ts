export type MenuKey = "dashboard" | "chat" | "skills" | "providers" | "config";

export const ADMIN_PAGE_TITLES: Record<MenuKey, string> = {
  dashboard: "概览",
  chat: "对话",
  skills: "技能管理",
  providers: "模型与供应商",
  config: "高级配置",
};

export const PATH_BY_MENU: Record<MenuKey, string> = {
  dashboard: "/",
  chat: "/chat",
  skills: "/skills",
  providers: "/providers",
  config: "/config",
};

export function menuKeyFromPath(pathname: string): MenuKey {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/" || p === "/dashboard") return "dashboard";
  const seg = p.slice(1);
  if (seg === "chat" || seg === "skills" || seg === "providers" || seg === "config") {
    return seg;
  }
  return "dashboard";
}
