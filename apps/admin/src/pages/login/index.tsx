import React, { useState } from "react";
import { Card, Form, Input, Button, message, Typography } from "antd";
import { LockOutlined, ThunderboltFilled } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (values: { token: string }) => {
    setLoading(true);
    try {
      const res = await api.login(values.token);
      message.success("登录成功");
      localStorage.setItem("JARVIS_ADMIN_TOKEN", res.token);
      localStorage.setItem("JARVIS_ADMIN_USER", JSON.stringify(res.user));
      navigate("/dashboard");
    } catch (err: any) {
      message.error(err.message || "登录失败，请检查管理端凭据");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      }}
    >
      <Card
        style={{
          width: 400,
          borderRadius: 12,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
          padding: 12,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#1677ff1a",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <ThunderboltFilled style={{ fontSize: 32, color: "#1677ff" }} />
          </div>
          <Title level={3} style={{ margin: 0 }}>
            Jarvis 认知管理控制台
          </Title>
          <Text type="secondary">Personal Cognitive Runtime Admin</Text>
        </div>

        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="token"
            label="管理员凭据 (Admin Token / Key)"
            rules={[{ required: true, message: "请输入 JARVIS_ADMIN_KEY 或 API Token" }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "rgba(0,0,0,.25)" }} />}
              placeholder="请输入管理员密钥 (默认 jarvis-admin)"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              验证并进入控制台
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
