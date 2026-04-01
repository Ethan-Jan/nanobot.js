import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, theme } from "antd";
import type { Locale } from "antd/es/locale";
import * as ZhLocale from "antd/locale/zh_CN";
import App from "./App";
import "antd/dist/reset.css";

const zhCN = (ZhLocale as unknown as { default: Locale }).default;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm }}>
      <App />
    </ConfigProvider>
  </StrictMode>,
);
