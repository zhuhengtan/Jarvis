import React, { useState } from "react";
import {
  Layout,
  Menu,
  Button,
  Avatar,
  Dropdown,
  Space,
  Breadcrumb,
  Tag,
  theme,
} from "antd";
import type { MenuProps } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  AuditOutlined,
  BookOutlined,
  InteractionOutlined,
  AimOutlined,
  ToolOutlined,
  RobotOutlined,
  LogoutOutlined,
  UserOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation, Outlet } from "react-router-dom";

const { Header, Sider, Content, Footer } = Layout;

interface CustomLayoutProps {
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const CustomLayout: React.FC<CustomLayoutProps> = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = () => {
    localStorage.removeItem("JARVIS_ADMIN_TOKEN");
    localStorage.removeItem("JARVIS_ADMIN_USER");
    navigate("/login");
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "/dashboard",
      icon: <DashboardOutlined />,
      label: "系统总览",
    },
    {
      key: "/projects",
      icon: <FolderOpenOutlined />,
      label: "项目工作区",
    },
    {
      key: "/memory",
      icon: <BookOutlined />,
      label: "记忆中心",
      children: [
        {
          key: "/memory/candidates",
          icon: <AuditOutlined />,
          label: "待审候选 (Review)",
        },
        {
          key: "/memory/explorer",
          icon: <BookOutlined />,
          label: "持久记忆库 (Durable)",
        },
      ],
    },
    {
      key: "/sessions",
      icon: <InteractionOutlined />,
      label: "会话与观测",
    },
    {
      key: "/goals",
      icon: <AimOutlined />,
      label: "项目目标",
    },
    {
      key: "/skills",
      icon: <ToolOutlined />,
      label: "技能注册表",
    },
    {
      key: "/identity",
      icon: <RobotOutlined />,
      label: "助理与认知自省",
    },
  ];

  // Map path to breadcrumbs
  const getBreadcrumbs = (pathname: string) => {
    const map: Record<string, string[]> = {
      "/dashboard": ["控制台", "系统总览"],
      "/projects": ["控制台", "项目工作区"],
      "/memory/candidates": ["控制台", "记忆中心", "待审候选"],
      "/memory/explorer": ["控制台", "记忆中心", "持久记忆库"],
      "/sessions": ["控制台", "会话与观测"],
      "/goals": ["控制台", "项目目标"],
      "/skills": ["控制台", "技能注册表"],
      "/identity": ["控制台", "助理与认知自省"],
    };
    return map[pathname] || ["控制台", "页面"];
  };

  const breadcrumbItems = getBreadcrumbs(location.pathname).map((title) => ({
    title,
  }));

  const userMenu: MenuProps["items"] = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      danger: true,
      label: "退出登录",
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        width={240}
        style={{
          boxShadow: "2px 0 8px 0 rgba(29,35,41,.05)",
        }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? 0 : "0 24px",
            color: "#fff",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 1,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "#1677ff", marginRight: 8, fontSize: 22 }}>⚡</span>
          {!collapsed && "JARVIS ADMIN"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={["/memory"]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 12 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: "0 24px",
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 1px 4px rgba(0,21,41,.08)",
            zIndex: 1,
          }}
        >
          <Space orientation="horizontal" size="middle">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 48, height: 48 }}
            />
            <Breadcrumb items={breadcrumbItems} />
          </Space>

          <Space orientation="horizontal" size="large">
            <Tag color="processing" bordered={false}>
              Cognitive Runtime Active
            </Tag>
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <Space style={{ cursor: "pointer" }}>
                <Avatar
                  style={{ backgroundColor: "#1677ff" }}
                  icon={<UserOutlined />}
                />
                <span style={{ fontWeight: 500 }}>Admin</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content
          style={{
            margin: "24px 24px 0",
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
        <Footer style={{ textAlign: "center", color: "#8c8c8c" }}>
          Jarvis Cognitive Architecture © 2026 Powered by Ant Design 6 & React 19
        </Footer>
      </Layout>
    </Layout>
  );
};
