import React, { useEffect, useState } from "react";
import {
  Table,
  Card,
  Tag,
  Button,
  Space,
  Drawer,
  Timeline,
  Descriptions,
  Typography,
  message,
  Tabs,
  Badge,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  InteractionOutlined,
  ReloadOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { api } from "../../services/api";
import type { Session, Event, Experience } from "../../types";

const { Text, Paragraph } = Typography;

export const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionDetail, setSessionDetail] = useState<{
    session: Session;
    events: Event[];
    experiences: Experience[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (err: any) {
      message.error(err.message || "加载会话列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleOpenDetail = async (record: Session) => {
    setSelectedSession(record);
    setDetailLoading(true);
    try {
      const detail = await api.getSessionDetail(record.id);
      setSessionDetail(detail);
    } catch (err: any) {
      message.error(err.message || "获取会话详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnsType<Session> = [
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => (
        <Badge
          status={status === "active" ? "processing" : "default"}
          text={status === "active" ? "活跃中" : "已归档"}
        />
      ),
      filters: [
        { text: "活跃 (active)", value: "active" },
        { text: "已归档 (closed)", value: "closed" },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "客户端 (Client)",
      dataIndex: "client",
      key: "client",
      width: 140,
      render: (client: string) => <Tag color="blue">{client}</Tag>,
    },
    {
      title: "工作区与任务摘要",
      dataIndex: "task",
      key: "task",
      render: (task: string, record: Session) => (
        <Space direction="vertical" size={2}>
          <Text strong ellipsis style={{ maxWidth: 450 }}>
            {task}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, fontFamily: "monospace" }}>
            {record.workspace}
          </Text>
        </Space>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (time: string) => new Date(time).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_, record) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleOpenDetail(record)}
        >
          观测
        </Button>
      ),
    },
  ];

  const getEventTagColor = (type: Event["type"]) => {
    switch (type) {
      case "observation":
        return "blue";
      case "action":
        return "orange";
      case "result":
        return "green";
      case "system":
        return "purple";
      default:
        return "default";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title={
          <Space>
            <InteractionOutlined style={{ color: "#1677ff" }} />
            <span>AI 会话观测与溯源流 (Sessions Observability)</span>
            <Tag color="blue">{sessions.length} 个历史/活跃会话</Tag>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadSessions} loading={loading}>
            刷新
          </Button>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={sessions}
          loading={loading}
          pagination={{ pageSize: 12 }}
        />
      </Card>

      <Drawer
        title="会话深度观测与事件时间轴"
        placement="right"
        width={700}
        loading={detailLoading}
        open={Boolean(selectedSession)}
        onClose={() => {
          setSelectedSession(null);
          setSessionDetail(null);
        }}
      >
        {selectedSession && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="会话 ID">
                <Text copyable style={{ fontFamily: "monospace" }}>
                  {selectedSession.id}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="接入客户端">
                <Tag color="blue">{selectedSession.client}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="工作区目录">
                <Text style={{ fontFamily: "monospace" }}>{selectedSession.workspace}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="任务内容">
                {selectedSession.task}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {new Date(selectedSession.createdAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
            </Descriptions>

            <Tabs
              items={[
                {
                  key: "events",
                  label: `事件流水 (${sessionDetail?.events.length ?? 0})`,
                  children: (
                    <div style={{ maxHeight: 450, overflowY: "auto", padding: "12px 4px" }}>
                      {sessionDetail?.events.length ? (
                        <Timeline
                          items={sessionDetail.events.map((e) => ({
                            color: getEventTagColor(e.type),
                            children: (
                              <div style={{ marginBottom: 12 }}>
                                <Space>
                                  <Tag color={getEventTagColor(e.type)}>
                                    {e.type.toUpperCase()}
                                  </Tag>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {new Date(e.occurredAt).toLocaleTimeString("zh-CN")}
                                  </Text>
                                </Space>
                                <div
                                  style={{
                                    marginTop: 6,
                                    padding: "8px 12px",
                                    background: "#f9f9f9",
                                    borderRadius: 4,
                                    fontFamily: "monospace",
                                    fontSize: 12,
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {e.content}
                                </div>
                              </div>
                            ),
                          }))}
                        />
                      ) : (
                        <div style={{ textAlign: "center", color: "#999", padding: 24 }}>
                          该会话暂无记录的事件流水
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "experiences",
                  label: `反思经验 (${sessionDetail?.experiences.length ?? 0})`,
                  children: (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {sessionDetail?.experiences.map((exp) => (
                        <Card key={exp.id} size="small" style={{ background: "#fafafa" }}>
                          <Paragraph strong style={{ margin: "0 0 8px" }}>
                            {exp.summary}
                          </Paragraph>
                          {exp.decisions?.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <Text strong style={{ fontSize: 12, color: "#1677ff" }}>
                                关键决策 (Decisions):
                              </Text>
                              <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
                                {exp.decisions.map((d, i) => (
                                  <li key={i}>{d}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {exp.failures?.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <Text strong style={{ fontSize: 12, color: "#ff4d4f" }}>
                                失败避坑 (Failures):
                              </Text>
                              <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
                                {exp.failures.map((f, i) => (
                                  <li key={i}>{f}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {exp.nextSteps?.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <Text strong style={{ fontSize: 12, color: "#52c41a" }}>
                                后续推进 (Next Steps):
                              </Text>
                              <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
                                {exp.nextSteps.map((n, i) => (
                                  <li key={i}>{n}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </Card>
                      ))}
                      {!sessionDetail?.experiences.length && (
                        <div style={{ textAlign: "center", color: "#999", padding: 24 }}>
                          会话尚未提交结题经验
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};
