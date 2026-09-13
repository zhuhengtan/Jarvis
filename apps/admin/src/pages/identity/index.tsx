import React, { useEffect, useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Tag,
  Descriptions,
  Typography,
  Space,
  Alert,
  message,
  Divider,
} from "antd";
import { RobotOutlined, SaveOutlined } from "@ant-design/icons";
import { api } from "../../services/api";
import type { OverviewStats } from "../../types";

const { Title, Paragraph } = Typography;

export const IdentityPage: React.FC = () => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getOverview();
      setStats(data);
      form.setFieldsValue({
        assistantName: data.assistantName || "Jarvis",
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdateName = async (values: { assistantName: string }) => {
    setSaving(true);
    try {
      await api.setAssistantName(values.assistantName);
      message.success("助理名称已更新");
      loadProfile();
    } catch (err: any) {
      message.error(err.message || "更新失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card
        title={
          <Space>
            <RobotOutlined style={{ color: "#1677ff" }} />
            <span>助理身份与自我认知 (Assistant Identity & Self Model)</span>
          </Space>
        }
        loading={loading}
      >
        <Paragraph>
          Jarvis 具备显式的自我模型（Self Model）与个性定义。你可以在此修改助理称呼，或者通过 AI IDE
          自然语言对话（如 “以后叫你 Friday”）让 Jarvis 自主调用接口完成更改。
        </Paragraph>

        <Form
          form={form}
          layout="inline"
          onFinish={handleUpdateName}
          style={{ marginBottom: 24 }}
        >
          <Form.Item
            name="assistantName"
            label="当前助理显示名称"
            rules={[{ required: true, message: "请输入助理名称" }]}
          >
            <Input placeholder="例如：Jarvis 或 Friday" style={{ width: 240 }} />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
            >
              更新称呼
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        <Title level={5}>认知运行时边界与契约 (Runtime Boundary)</Title>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="运行时模式">
            <Tag color="cyan">Personal Cognitive Runtime</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="语义记忆写权限">
            <Tag color="gold">仅限人类审查候选记忆提拔 (Reviewed Candidates Only)</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="支持的通信协议">
            <Space>
              <Tag color="blue">MCP (stdio)</Tag>
              <Tag color="geekblue">MCP (streamable-http)</Tag>
              <Tag color="green">Fastify REST API</Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="已载入的核心能力">
            <Space wrap size={[4, 8]}>
              {stats?.capabilities.map((cap) => (
                <Tag key={cap} color="purple">
                  {cap}
                </Tag>
              ))}
            </Space>
          </Descriptions.Item>
        </Descriptions>

        <Alert
          style={{ marginTop: 20 }}
          type="info"
          showIcon
          message="架构隔离原则"
          description="Jarvis Runtime 是所有认知记忆的唯一宿主。Codex、Cursor、Antigravity 等开发工具都是适配器客户端，客户端无法越权直接操作 Markdown 知识库。"
        />
      </Card>
    </div>
  );
};
