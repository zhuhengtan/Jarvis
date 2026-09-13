import React, { useEffect, useState } from "react";
import {
  Card,
  Select,
  Tag,
  Table,
  Button,
  Space,
  Typography,
  message,
  Empty,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { AimOutlined, ReloadOutlined } from "@ant-design/icons";
import { api } from "../../services/api";
import type { Goal } from "../../types";

const { Text } = Typography;
const { Option } = Select;

export const GoalsPage: React.FC = () => {
  const [projects, setProjects] = useState<Array<{ id: string; workspace: string }>>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .getProjects()
      .then((projs) => {
        setProjects(projs);
        if (projs.length > 0) {
          setSelectedProject(projs[0].id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    api
      .getGoals(selectedProject)
      .then(setGoals)
      .catch((err) => message.error(err.message || "加载目标失败"))
      .finally(() => setLoading(false));
  }, [selectedProject]);

  const columns: ColumnsType<Goal> = [
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: Goal["status"]) => {
        const color =
          status === "active" ? "processing" : status === "completed" ? "success" : "error";
        const label =
          status === "active" ? "进行中 (Active)" : status === "completed" ? "已完成" : "阻塞中";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "目标描述 (Title / Task Goal)",
      dataIndex: "title",
      key: "title",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 200,
      render: (time) => new Date(time).toLocaleString("zh-CN"),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title={
          <Space>
            <AimOutlined style={{ color: "#1677ff" }} />
            <span>项目目标跟踪看板 (Project Goals Board)</span>
          </Space>
        }
        extra={
          <Space>
            <span>选择关联项目：</span>
            <Select
              style={{ width: 280 }}
              value={selectedProject}
              onChange={setSelectedProject}
              placeholder="选择项目"
            >
              {projects.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.workspace.split("/").pop()} ({p.id.slice(0, 10)}...)
                </Option>
              ))}
            </Select>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                if (selectedProject) {
                  setLoading(true);
                  api
                    .getGoals(selectedProject)
                    .then(setGoals)
                    .finally(() => setLoading(false));
                }
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
        {projects.length === 0 ? (
          <Empty description="暂无项目会话记录，当 AI IDE 开启会话时将自动登记项目。" />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={goals}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>
    </div>
  );
};
