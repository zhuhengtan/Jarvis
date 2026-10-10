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
  RobotOutlined,
} from "@ant-design/icons";
import { api } from "../../services/api";
import type { ApprovalSweepStatus, MemoryRecord, MemoryKind, ProjectDetail, RuntimeSettings } from "../../types";

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
  const [settings, setSettings] = useState<RuntimeSettings | null>(null);
  const [autoReviewing, setAutoReviewing] = useState(false);
  const [autoApproving, setAutoApproving] = useState(false);
  const [sweep, setSweep] = useState<ApprovalSweepStatus | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const [data, projectData, runtimeSettings, approval] = await Promise.all([api.getCandidates(), api.getProjects(), api.getSettings(), api.approvalSweepStatus()]);
      setCandidates(data); setProjects(projectData); setSettings(runtimeSettings); setSweep(approval);
    } catch (err: any) {
      message.error(err.message || "加载候选记忆失败");
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async (record: MemoryRecord) => {
    const projectId = assignment[record.id];
    if (!projectId) return message.warning("请选择目标项目");
    try { await api.reassignCandidate(record.id, projectId, record.revision); message.success("候选已重新归属"); loadCandidates(); }
    catch (err: any) { message.error(err.message || "重新归属失败"); }
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  useEffect(() => {
    if (!sweep?.running) return;
    const timer = window.setTimeout(async () => {
      try {
        const status = await api.approvalSweepStatus();
        setSweep(status);
        if (!status.running) await loadCandidates();
      } catch (err: any) {
        message.error(err.message || "读取自动审批进度失败");
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [sweep]);

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
      await api.archiveCandidate(record.id, record.revision);
      message.info(`已归档候选记忆: "${record.title}"`);
      loadCandidates();
    } catch (err: any) {
      message.error(err.message || "归档失败");
    }
  };

  const handleAutoReview = async () => {
    setAutoReviewing(true);
    try {
      const result = await api.autoReviewCandidates();
      Modal.info({
        title: `审核建议（${result.failed} 条失败）`, width: 680,
        content: <div>建议尚未执行，请核对来源后在列表中操作。{result.recommendations.map(item => <p key={item.id}><strong>{item.title}</strong>：{({ promote: "建议提升", archive: "建议归档", keep: "建议保留" })[item.action]} — {item.reason}</p>)}</div>,
      });
      await loadCandidates();
    } catch (err: any) {
      message.error(err.message || "自动审查失败");
    } finally {
      setAutoReviewing(false);
    }
  };

  const handleOldestApproval = () => {
    if (sweep?.running || autoApproving) return;
    Modal.confirm({
      title: "从旧到新全量自动审批",
      content: "将按创建时间从旧到新处理全部待审候选，并按本机 Ollama 的判定提升或归档。来源不足、未归属或审核上下文过大的条目会保留，供人工处理。",
      okText: "开始",
      cancelText: "取消",
      onOk: async () => {
        try {
          setSweep(await api.startOldestApproval());
        } catch (err: any) {
          message.error(err.message || "全量自动审批失败");
        }
      },
    });
  };

  const handleAutoApprove = () => {
    if (autoApproving) return;
    if (selectedRowKeys.length === 0) {
      message.warning("请先选择要持久化写入的候选记忆");
      return;
    }
    const selected = candidates.filter(record => selectedRowKeys.includes(record.id)).map(record => ({ id: record.id, expectedRevision: record.revision }));
    if (selected.length !== selectedRowKeys.length) {
      setSelectedRowKeys([]);
      message.warning("候选列表已变化，请重新选择");
      return;
    }
    setAutoApproving(true);
    Modal.confirm({
      title: "执行自动审批",
      content: `将让本机 Ollama 判定选中的 ${selected.length} 条候选，并按判定提升或归档。来源不足、未归属或不确定的条目会保留；版本变化的条目需要刷新后重试。`,
      okText: "执行",
      cancelText: "取消",
      onCancel: () => setAutoApproving(false),
      onOk: async () => {
        try {
          const outcome = await api.autoApproveCandidates(selected);
          Modal.info({
            title: "自动审批已执行",
            content: <div>已按本机 Ollama 判定处理：提升 {outcome.promoted}、归档 {outcome.archived}、保留 {outcome.kept}、失败 {outcome.failed}。{outcome.results.filter(item => item.action === "keep" || item.action === "failed").map(item => <p key={item.id}>{candidates.find(record => record.id === item.id)?.title ?? item.id}：{item.reason}</p>)}</div>,
          });
          setSelectedRowKeys([]);
          await loadCandidates();
        } catch (err: any) {
          message.error(err.message || "自动审批失败");
        } finally {
          setAutoApproving(false);
        }
      },
    });
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
      await api.updateCandidate(selectedRecord.id, { ...values, expectedRevision: selectedRecord.revision });
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
          <Space>
            {settings?.provider === "ollama" && settings.ollamaModel.trim() && (
              <>
                <Button icon={<RobotOutlined />} onClick={handleOldestApproval} loading={sweep?.running} disabled={autoApproving || autoReviewing}>
                  从旧到新全量自动审批
                </Button>
                <Button icon={<RobotOutlined />} onClick={handleAutoApprove} disabled={selectedRowKeys.length === 0 || autoApproving || autoReviewing || sweep?.running} loading={autoApproving}>
                  执行自动审批（持久化写入）
                </Button>
                <Button type="primary" icon={<RobotOutlined />} onClick={handleAutoReview} loading={autoReviewing} disabled={autoApproving}>
                  生成审核建议
                </Button>
              </>
            )}
            <Button icon={<ReloadOutlined />} onClick={loadCandidates} loading={loading}>
              刷新列表
            </Button>
          </Space>
        }
      >
        {sweep && (sweep.running || sweep.finishedAt) && (
          <div style={{ marginBottom: 12 }}>
            {sweep.running ? "正在从旧到新自动审批" : "最近一轮自动审批"}：已查看 {sweep.scanned}，提升 {sweep.promoted}，归档 {sweep.archived}，保留 {sweep.kept}，失败 {sweep.failed}，剩余 {sweep.remaining}
            {sweep.error ? `。${sweep.error}` : ""}
            {settings?.autoApprovalEnabled ? `。定时每 ${settings.autoApprovalIntervalMinutes} 分钟再跑一轮。` : "。定时自动审批未开启。"}
          </div>
        )}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={candidates}
          loading={loading}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
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
