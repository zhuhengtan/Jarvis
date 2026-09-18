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
  Select,
  message,
  Popconfirm,
  Typography,
  Drawer,
  Descriptions,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AuditOutlined,
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { api } from "../../services/api";
import type { MemoryRecord, MemoryKind, ProjectDetail } from "../../types";

const { Text } = Typography;
const { Option } = Select;

const kindColors: Record<MemoryKind, string> = {
  preference: "blue",
  fact: "green",
  constraint: "red",
  decision: "purple",
  identity: "magenta",
  workflow: "orange",
};

export const CandidatesPage: React.FC = () => {
  const [candidates, setCandidates] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MemoryRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [form] = Form.useForm();
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [assignment, setAssignment] = useState<Record<string, string>>({});

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const [data, projectData] = await Promise.all([api.getCandidates(), api.getProjects()]);
      setCandidates(data); setProjects(projectData);
    } catch (err: any) {
      message.error(err.message || "加载候选记忆失败");
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async (record: MemoryRecord) => {
    const projectId = assignment[record.id];
    if (!projectId) return message.warning("请选择目标项目");
    try { await api.reassignCandidate(record.id, projectId); message.success("候选已重新归属"); loadCandidates(); }
    catch (err: any) { message.error(err.message || "重新归属失败"); }
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const handlePromote = async (record: MemoryRecord) => {
    try {
      await api.promoteCandidate(record.id, record.revision);
      message.success(`已成功提拔记忆: "${record.title}" 为正式持久记忆`);
      loadCandidates();
    } catch (err: any) {
      message.error(err.message || "提拔失败");
    }
  };

  const handleArchive = async (record: MemoryRecord) => {
    try {
      await api.archiveCandidate(record.id);
      message.info(`已归档候选记忆: "${record.title}"`);
      loadCandidates();
    } catch (err: any) {
      message.error(err.message || "归档失败");
    }
  };

  const handleOpenEdit = (record: MemoryRecord) => {
    setSelectedRecord(record);
    form.setFieldsValue({
      title: record.title,
      kind: record.kind,
      content: record.content,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRecord) return;
    try {
      const values = await form.validateFields();
      await api.updateCandidate(selectedRecord.id, values);
      message.success("候选记忆修改成功");
      setIsEditing(false);
      loadCandidates();
    } catch (err: any) {
      message.error(err.message || "修改保存失败");
    }
  };

  const columns: ColumnsType<MemoryRecord> = [
    {
      title: "类型",
      dataIndex: "kind",
      key: "kind",
      width: 110,
      render: (kind: MemoryKind) => (
        <Tag color={kindColors[kind] || "default"}>{kind.toUpperCase()}</Tag>
      ),
      filters: [
        { text: "Preference", value: "preference" },
        { text: "Decision", value: "decision" },
        { text: "Workflow", value: "workflow" },
        { text: "Fact", value: "fact" },
        { text: "Constraint", value: "constraint" },
        { text: "Identity", value: "identity" },
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
            ID: {record.id.slice(0, 16)}... | 作用域: {record.scope}
          </Text>
        </Space>
      ),
    },
    {
      title: "内容摘要",
      dataIndex: "content",
      key: "content",
      ellipsis: true,
      render: (content: string) => (
        <span style={{ color: "#595959", fontFamily: "monospace" }}>
          {(content || "").slice(0, 100)}{content.length > 100 ? "..." : ""}
        </span>
      ),
    },
    {
      title: "来源追踪",
      dataIndex: "sourceRefs",
      key: "sourceRefs",
      width: 140,
      render: (refs: string[]) => (
        <span>{refs?.length ? `${refs.length} 个来源引用` : "未指定来源"}</span>
      ),
    },
    {
      title: "生成时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (time: string) => new Date(time).toLocaleString("zh-CN"),
    },
    {
      title: "操作 (Human Review)",
      key: "action",
      width: 260,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedRecord(record);
              setIsViewing(true);
            }}
          >
            预览
          </Button>

          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>

          <Popconfirm
            title="确认提拔为正式记忆？"
            description="提拔后将以 Markdown 文件形式永久持久化至语义知识库。"
            onConfirm={() => handlePromote(record)}
            okText="提拔"
            cancelText="取消"
          >
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
            >
              提拔
            </Button>
          </Popconfirm>

          {record.projectId === "unassigned" && (
            <Space.Compact>
              <Select size="small" placeholder="归属项目" style={{ width: 120 }} value={assignment[record.id]} onChange={(value) => setAssignment((current) => ({ ...current, [record.id]: value }))}>
                {projects.map((project) => <Option key={project.id} value={project.id}>{project.name}</Option>)}
              </Select>
              <Button size="small" onClick={() => handleReassign(record)}>归属</Button>
            </Space.Compact>
          )}

          <Popconfirm
            title="确认归档此候选记忆？"
            description="归档后此条目将不再进入提拔列表。"
            onConfirm={() => handleArchive(record)}
            okText="归档"
            cancelText="取消"
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
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
            <AuditOutlined style={{ color: "#1677ff" }} />
            <span>候选记忆审查大厅 (Memory Candidates Review)</span>
            <Tag color="orange">{candidates.length} 条待审查</Tag>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadCandidates}
            loading={loading}
          >
            刷新列表
          </Button>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={candidates}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* View Drawer */}
      <Drawer
        title="候选记忆详情与溯源"
        placement="right"
        width={600}
        open={isViewing}
        onClose={() => setIsViewing(false)}
        extra={
          selectedRecord && (
            <Space>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setIsViewing(false);
                  handleOpenEdit(selectedRecord);
                }}
              >
                编辑
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => {
                  handlePromote(selectedRecord);
                  setIsViewing(false);
                }}
              >
                提拔到持久库
              </Button>
            </Space>
          )
        }
      >
        {selectedRecord && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="记忆标题">
                <Text strong>{selectedRecord.title}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={kindColors[selectedRecord.kind]}>
                  {selectedRecord.kind.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="作用域">
                {selectedRecord.scope === "global" ? "全局 (Global)" : `项目 (${selectedRecord.projectId})`}
              </Descriptions.Item>
              <Descriptions.Item label="版本 / 状态">
                Rev {selectedRecord.revision} | {selectedRecord.status}
              </Descriptions.Item>
              <Descriptions.Item label="来源追踪">
                {selectedRecord.sourceRefs.length ? (
                  selectedRecord.sourceRefs.map((ref) => (
                    <Tag key={ref} color="blue">
                      {ref}
                    </Tag>
                  ))
                ) : (
                  <Text type="secondary">无明确来源引用</Text>
                )}
              </Descriptions.Item>
              {selectedRecord.summary && <Descriptions.Item label="摘要">{selectedRecord.summary}</Descriptions.Item>}
              {selectedRecord.verification && <Descriptions.Item label="验证状态">{selectedRecord.verification}</Descriptions.Item>}
              <Descriptions.Item label="生成时间">
                {new Date(selectedRecord.createdAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Text strong style={{ fontSize: 14 }}>
                记忆正文 (Markdown Content):
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

      {/* Edit Modal */}
      <Modal
        title="微调候选记忆 (Edit Candidate)"
        open={isEditing}
        onOk={handleSaveEdit}
        onCancel={() => setIsEditing(false)}
        okText="保存修改"
        cancelText="取消"
        width={650}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="记忆标题"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input placeholder="概括此条记忆的核心主旨" />
          </Form.Item>

          <Form.Item
            name="kind"
            label="分类类型"
            rules={[{ required: true, message: "请选择类型" }]}
          >
            <Select>
              <Option value="preference">Preference (偏好习惯)</Option>
              <Option value="fact">Fact (项目客观事实)</Option>
              <Option value="constraint">Constraint (强硬约束与禁忌)</Option>
              <Option value="decision">Decision (架构与技术决策)</Option>
              <Option value="identity">Identity (自我与用户身份认同)</Option>
              <Option value="workflow">Workflow (工作流程与规范)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="content"
            label="记忆内容 (Markdown 格式)"
            rules={[{ required: true, message: "请输入记忆正文" }]}
          >
            <Input.TextArea
              rows={8}
              placeholder="编写结构化、可被未来会话高效检索的高质量 Markdown 内容..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
