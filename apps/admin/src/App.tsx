import React from "react";
import { RouterProvider } from "react-router-dom";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { router } from "./routes";
import { lightTheme } from "./theme";

export const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN} theme={lightTheme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
};
