import type { ThemeConfig } from "antd";

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: "#1677ff",
    borderRadius: 6,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      headerBg: "#ffffff",
      siderBg: "#001529",
    },
    Menu: {
      darkItemBg: "#001529",
      darkItemSelectedBg: "#1677ff",
    },
  },
};

export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: "#1677ff",
    colorBgBase: "#141414",
    borderRadius: 6,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      headerBg: "#1f1f1f",
      siderBg: "#141414",
    },
    Menu: {
      darkItemBg: "#141414",
      darkItemSelectedBg: "#1677ff",
    },
  },
};
