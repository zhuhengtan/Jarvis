import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Tag,
  Space,
  Card,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Typography,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  FolderOpenOutlined,
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  AimOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import type { ProjectDetail } from "../../types";

const { Text, Paragraph } = Typography;

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err: any) {
      message.error(err.message || "加载项目列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await api.createProject(values);
      message.success(`项目 "${values.name || values.workspace}" 注册成功`);
      setIsModalOpen(false);
      form.resetFields();
      loadProjects();
    } catch (err: any) {
      message.error(err.message || "注册项目失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await api.deleteProject(id);
      message.info("已解除项目注册");
      loadProjects();
    } catch (err: any) {
      message.error(err.message || "注销失败");
    }
  };

  const columns: ColumnsType<ProjectDetail> = [
    {
      title: "项目名称",
      dataIndex: "name",
      key: "name",
      width: 200,
      render: (name: string, record: ProjectDetail) => (
        <Space direction="vertical" size={2}>
          <Text strong>{name || "未命名项目"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ID: {record.id.slice(0, 16)}...
          </Text>
        </Space>
      ),
    },
    {
      title: "工作区物理绝对路径 (Workspace Path)",
      dataIndex: "workspace",
      key: "workspace",
      render: (workspace: string) => (
        <Paragraph
          copyable
          style={{ margin: 0, fontFamily: "monospace", fontSize: 12 }}
        >
          {workspace}
        </Paragraph>
      ),
    },
    {
      title: "Git 仓库",
      dataIndex: "gitRemote",
      key: "gitRemote",
      width: 220,
      ellipsis: true,
      render: (remote?: string) =>
        remote ? (
          <Tooltip title={remote}>
            <Tag color="geekblue">{remote.split("/").pop()}</Tag>
          </Tooltip>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            非 Git 仓库
          </Text>
        ),
    },
    {
      title: "当前活跃目标",
      dataIndex: "activeGoal",
      key: "activeGoal",
      render: (goal?: string) =>
        goal ? (
          <Tag color="orange" icon={<AimOutlined />}>
            {goal}
          </Tag>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            暂无活跃目标
          </Text>
        ),
    },
    {
      title: "认知资产",
      key: "stats",
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Tag color="blue">{record.goalsCount} 个目标</Tag>
          <Tag color="green">{record.memoriesCount} 条记忆</Tag>
        </Space>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<AimOutlined />}
            onClick={() => navigate(`/goals?project=${record.id}`)}
          >
            目标
          </Button>

          <Button
            size="small"
            icon={<BookOutlined />}
            onClick={() => navigate(`/memory/explorer?project=${record.id}`)}
          >
            记忆
          </Button>

          <Popconfirm
            title="确认解绑该项目？"
            description="解绑后工作区目录文件保留，但不再出现在默认项目清单中。"
            onConfirm={() => handleDeleteProject(record.id)}
            okText="解绑"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title={
          <Space>
            <FolderOpenOutlined style={{ color: "#1677ff" }} />
            <span>项目工作区管理 (Projects & Workspaces)</span>
            <Tag color="blue">{projects.length} 个纳管项目</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsModalOpen(true)}
            >
              注册新项目
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadProjects}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={projects}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="注册纳管新项目 (Register Project)"
        open={isModalOpen}
        onOk={handleCreateProject}
        confirmLoading={submitting}
        onCancel={() => setIsModalOpen(false)}
        okText="完成建档"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="workspace"
            label="本地/服务端工作区绝对路径 (Absolute Workspace Path)"
            rules={[
              { required: true, message: "请输入完整绝对路径，例如 /Users/.../my-app" },
            ]}
            extra="Jarvis 将校验该路径并在其中创建 .jarvis/project.json 建立永久绑定。"
          >
            <Input placeholder="/Users/username/projects/my-app" />
          </Form.Item>

          <Form.Item
            name="name"
            label="项目显示名称 (Project Name)"
            extra="留空时将自动提取目录名作为默认名称。"
          >
            <Input placeholder="例如：Jarvis Core 或 Gorgeous Admin" />
          </Form.Item>

          <Form.Item name="description" label="项目简介" extra="用于无工作区会话的自动归属判断。">
            <Input.TextArea rows={2} placeholder="一句话说明项目用途、技术栈或主要模块" />
          </Form.Item>

          <Form.Item name="keywords" label="项目关键词" extra="多个关键词用逗号分隔，例如：Cocos, 自走棋, 战斗" getValueFromEvent={(event: React.ChangeEvent<HTMLInputElement>) => event.target.value.split(",").map((item) => item.trim()).filter(Boolean)}>
            <Input placeholder="Cocos, RTS, memory" />
          </Form.Item>

          <Form.Item
            name="initialGoal"
            label="设定首个活跃目标 (Initial Active Goal)"
            extra="可选。建档后可立即进入 Goals 看板进行生命周期追踪。"
          >
            <Input placeholder="例如：梳理中台架构并完成首期功能交付" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
