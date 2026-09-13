import React, { useEffect, useState } from "react";
import {
  Row,
  Col,
  Card,
  Statistic,
  Alert,
  Tag,
  Space,
  Button,
  Typography,
  Spin,
} from "antd";
import {
  AuditOutlined,
  InteractionOutlined,
  BookOutlined,
  ToolOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import type { OverviewStats } from "../../types";

const { Title, Paragraph, Text } = Typography;

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getOverview()
      .then(setStats)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px 0" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {stats?.assistantName ? `欢迎，${stats.assistantName} 控制中枢` : "Jarvis 认知管理中枢"}
          </Title>
          <Text type="secondary">
            独立运行的 Personal Cognitive Runtime 运维与记忆审查平台
          </Text>
        </div>
        <Button
          type="primary"
          icon={<AuditOutlined />}
          onClick={() => navigate("/memory/candidates")}
        >
          审查候选记忆 ({stats?.pendingCandidates ?? 0})
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate("/memory/candidates")}>
            <Statistic
              title="待审候选记忆 (Pending Candidates)"
              value={stats?.pendingCandidates ?? 0}
              valueStyle={{ color: stats?.pendingCandidates ? "#faad14" : "#52c41a" }}
              prefix={<AuditOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#8c8c8c" }}>
              Human-in-the-loop 审查与提拔
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate("/sessions")}>
            <Statistic
              title="当前活跃会话 (Active Sessions)"
              value={stats?.activeSessions ?? 0}
              suffix={`/ ${stats?.totalSessions ?? 0}`}
              valueStyle={{ color: "#1677ff" }}
              prefix={<InteractionOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#8c8c8c" }}>
              AI IDE & Client 连接状态
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate("/memory/explorer")}>
            <Statistic
              title="持久语义记忆 (Durable Memories)"
              value={stats?.activeMemories ?? 0}
              valueStyle={{ color: "#52c41a" }}
              prefix={<BookOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#8c8c8c" }}>
              已审核并归档的 Markdown 知识
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate("/skills")}>
            <Statistic
              title="已安装技能 (Skills)"
              value={stats?.totalSkills ?? 0}
              valueStyle={{ color: "#722ed1" }}
              prefix={<ToolOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#8c8c8c" }}>
              认知工具库与能力集合
            </div>
          </Card>
        </Col>
      </Row>

      <Alert
        message="Jarvis 核心认知规则提示"
        description={
          <div>
            <Paragraph style={{ margin: "4px 0" }}>
              <strong>AI 客户端严禁直接写入持久语义记忆：</strong>所有来自 Codex、Cursor、Antigravity 等会话的反思与经验，必须先保存为
              Candidate（候选记录），经过人类在此控制台审查、调整并确认后，方可 Promote（提拔）为正式 Markdown 记忆。
            </Paragraph>
            <Space orientation="horizontal" size="small" style={{ marginTop: 8 }}>
              <Tag icon={<CheckCircleOutlined />} color="success">
                Reviewed Candidates Only
              </Tag>
              <Tag color="cyan">Markdown + Git</Tag>
              <Tag color="purple">Dynamic Store (Postgres / JSONL)</Tag>
            </Space>
          </div>
        }
        type="info"
        showIcon
      />

      <Card title="Jarvis 自省系统能力 (System Capabilities)">
        <Space wrap orientation="horizontal" size={[8, 8]}>
          {stats?.capabilities.map((cap) => (
            <Tag key={cap} color="blue" style={{ padding: "4px 10px", fontSize: 13 }}>
              {cap}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  );
};
