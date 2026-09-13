import React, { useEffect, useState } from "react";
import {
  Table,
  Input,
  Tag,
  Space,
  Card,
  Button,
  Drawer,
  Descriptions,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BookOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { api } from "../../services/api";
import type { MemoryRecord, MemoryKind } from "../../types";

const { Text } = Typography;

const kindColors: Record<MemoryKind, string> = {
  preference: "blue",
  fact: "green",
  constraint: "red",
  decision: "purple",
  identity: "magenta",
  workflow: "orange",
};

export const MemoryExplorerPage: React.FC = () => {
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<MemoryRecord | null>(null);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const data = await api.getMemories(undefined, searchQuery);
      setMemories(data.filter((m) => m.status === "active"));
    } catch (err: any) {
      message.error(err.message || "加载持久记忆库失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const columns: ColumnsType<MemoryRecord> = [
    {
      title: "分类",
      dataIndex: "kind",
      key: "kind",
      width: 120,
      render: (kind: MemoryKind) => (
        <Tag color={kindColors[kind] || "default"}>{kind.toUpperCase()}</Tag>
      ),
      filters: [
        { text: "Preference", value: "preference" },
        { text: "Decision", value: "decision" },
        { text: "Workflow", value: "workflow" },
        { text: "Fact", value: "fact" },
        { text: "Constraint", value: "constraint" },
      ],
      onFilter: (value, record) => record.kind === value,
    },
    {
      title: "记忆标题",
      dataIndex: "title",
      key: "title",
      render: (text, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ID: {record.id.slice(0, 18)}... | 版本 Rev.{record.revision}
          </Text>
        </Space>
      ),
    },
    {
      title: "范围",
      dataIndex: "scope",
      key: "scope",
      width: 120,
      render: (scope: string, record) => (
        <Tag color={scope === "global" ? "gold" : "cyan"}>
          {scope === "global" ? "全局记忆" : `项目 (${record.projectId?.slice(0, 10)}...)`}
        </Tag>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
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
          onClick={() => setSelectedRecord(record)}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title={
          <Space>
            <BookOutlined style={{ color: "#52c41a" }} />
            <span>持久语义知识库 (Durable Memories Explorer)</span>
            <Tag color="green">{memories.length} 条已提拔</Tag>
          </Space>
        }
        extra={
          <Space>
            <Input.Search
              placeholder="语义检索记忆..."
              allowClear
              enterButton={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={loadMemories}
              style={{ width: 260 }}
            />
            <Button icon={<ReloadOutlined />} onClick={loadMemories} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={memories}
          loading={loading}
          pagination={{ pageSize: 12 }}
        />
      </Card>

      <Drawer
        title="持久记忆详情"
        placement="right"
        width={600}
        open={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
      >
        {selectedRecord && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="标题">
                <Text strong>{selectedRecord.title}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={kindColors[selectedRecord.kind]}>
                  {selectedRecord.kind.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="范围与项目">
                {selectedRecord.scope} / {selectedRecord.projectId || "全局"}
              </Descriptions.Item>
              <Descriptions.Item label="修订版本">
                Rev {selectedRecord.revision}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(selectedRecord.updatedAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Text strong style={{ fontSize: 14 }}>
                Markdown 语义源文件内容:
              </Text>
              <div
                style={{
                  marginTop: 8,
                  padding: 16,
                  background: "#f5f5f5",
                  borderRadius: 6,
                  whiteSpace: "pre-wrap",
                  fontFamily: "monospace",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {selectedRecord.content}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
