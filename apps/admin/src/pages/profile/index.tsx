import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Tabs,
  Tooltip,
  Badge,
  Popconfirm,
  Drawer,
  List,
} from "antd";
import {
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { api } from "../../services/api";
import type { ProfileItem, ProfileCategory, ProfileStatus } from "../../types";

const { Title, Text, Paragraph } = Typography;

const categoryMeta: Record<ProfileCategory, { label: string; color: string }> = {
  communication: { label: "沟通偏好", color: "blue" },
  workflow: { label: "工作流习惯", color: "cyan" },
  habit: { label: "个人习惯", color: "geekblue" },
  taste: { label: "技术品味", color: "purple" },
  goal: { label: "长期目标", color: "gold" },
  trait: { label: "性格特质", color: "magenta" },
  life: { label: "生活作息", color: "orange" },
};

export const ProfilePage: React.FC = () => {
  const [items, setItems] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<ProfileItem | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [previewDigestVisible, setPreviewDigestVisible] = useState(false);
  const [previewDigest, setPreviewDigest] = useState("");
  const [evidenceDrawerItem, setEvidenceDrawerItem] = useState<ProfileItem | null>(null);

  const [form] = Form.useForm();

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await api.getProfiles();
      setItems(data);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "获取画像失败");
    } finally {
      setLoading(false);
    }
  };

  const loadDigest = async () => {
    try {
      const res = await api.getProfileDigest();
      setPreviewDigest(res.digest || "（暂无生效注入画像）");
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "获取注入预览失败");
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleOpenDigestModal = () => {
    loadDigest();
    setPreviewDigestVisible(true);
  };

  const handleApprovePending = async (item: ProfileItem) => {
    try {
      await api.updateProfile(item.id, {
        expectedRevision: item.revision,
        status: "active",
      });
      message.success("画像已通过审核并激活");
      loadProfiles();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "操作失败");
    }
  };

  const handleToggleInject = async (item: ProfileItem, checked: boolean) => {
    try {
      await api.updateProfile(item.id, {
        expectedRevision: item.revision,
        inject: checked,
      });
      message.success(checked ? "已开启客户端注入" : "已暂停客户端注入");
      loadProfiles();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "操作失败");
    }
  };

  const handleDelete = async (item: ProfileItem) => {
    try {
      await api.deleteProfile(item.id);
      message.success("条目已删除");
      loadProfiles();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleOpenEdit = (item: ProfileItem) => {
    setEditingItem(item);
    form.setFieldsValue({
      statement: item.statement,
      category: item.category,
      status: item.status,
      inject: item.inject,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      const values = await form.validateFields();
      await api.updateProfile(editingItem.id, {
        expectedRevision: editingItem.revision,
        statement: values.statement,
        category: values.category,
        status: values.status,
        inject: values.inject,
      });
      message.success("更新成功");
      setEditModalVisible(false);
      setEditingItem(null);
      loadProfiles();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "保存失败");
    }
  };

  const filteredItems = activeCategory === "all"
    ? items
    : items.filter((item) => item.category === activeCategory);

  const activeCount = items.filter((i) => i.status === "active").length;
  const pendingCount = items.filter((i) => i.status === "pending").length;
  const disabledCount = items.filter((i) => i.status === "disabled").length;
  const statedCount = items.filter((i) => i.origin === "stated").length;

  const columns = [
    {
      title: "认知分类",
      dataIndex: "category",
      key: "category",
      width: 120,
      render: (cat: ProfileCategory) => {
        const meta = categoryMeta[cat] || { label: cat, color: "default" };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "画像认知内容",
      dataIndex: "statement",
      key: "statement",
      render: (text: string, record: ProfileItem) => (
        <Space direction="vertical" size={2} style={{ width: "100%" }}>
          <Text strong>{text}</Text>
          <Space size={8}>
            <Tag color={record.origin === "stated" ? "green" : "blue"}>
              {record.origin === "stated" ? "用户明确告知" : "会话推断归纳"}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              频次: {record.count} 次
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              置信度: {Math.round(record.confidence * 100)}%
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status: ProfileStatus) => {
        if (status === "active") return <Badge status="success" text="已生效" />;
        if (status === "pending") return <Badge status="warning" text="待审核" />;
        return <Badge status="default" text="已停用" />;
      },
    },
    {
      title: "注入",
      dataIndex: "inject",
      key: "inject",
      width: 90,
      render: (inject: boolean, record: ProfileItem) => (
        <Switch
          size="small"
          checked={inject}
          onChange={(checked) => handleToggleInject(record, checked)}
        />
      ),
    },
    {
      title: "证据来源",
      key: "evidence",
      width: 110,
      render: (_: unknown, record: ProfileItem) => (
        <Button
          size="small"
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setEvidenceDrawerItem(record)}
        >
          {record.evidence.length} 条记录
        </Button>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 160,
      render: (_: unknown, record: ProfileItem) => (
        <Space size={6}>
          {record.status === "pending" && (
            <Tooltip title="审核通过并生效">
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprovePending(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除该画像条目？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(record)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <UserOutlined style={{ marginRight: 8, color: "#1890ff" }} />
            用户认知画像 (User Cognitive Profile)
          </Title>
          <Text type="secondary">
            会话结束后只根据用户原话提炼。条目保持待审核，人工通过后才会注入客户端。性格特质和生活作息不会注入。
          </Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<EyeOutlined />} onClick={handleOpenDigestModal}>
              注入摘要预览
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadProfiles} loading={loading}>
              刷新
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="已生效画像 (Active)"
              value={activeCount}
              valueStyle={{ color: "#52c41a" }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="待审核画像 (Pending)"
              value={pendingCount}
              valueStyle={{ color: "#faad14" }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="已停用 (Disabled)"
              value={disabledCount}
              valueStyle={{ color: "#8c8c8c" }}
              prefix={<StopOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="明确指定 (Stated)"
              value={statedCount}
              suffix={`/ ${items.length}`}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card bordered={false}>
        <Tabs
          activeKey={activeCategory}
          onChange={setActiveCategory}
          items={[
            { key: "all", label: `全部 (${items.length})` },
            { key: "communication", label: `沟通偏好 (${items.filter(i => i.category === "communication").length})` },
            { key: "workflow", label: `工作流 (${items.filter(i => i.category === "workflow").length})` },
            { key: "habit", label: `习惯 (${items.filter(i => i.category === "habit").length})` },
            { key: "taste", label: `品味 (${items.filter(i => i.category === "taste").length})` },
            { key: "goal", label: `目标 (${items.filter(i => i.category === "goal").length})` },
            { key: "trait", label: `特质 (${items.filter(i => i.category === "trait").length})` },
            { key: "life", label: `作息 (${items.filter(i => i.category === "life").length})` },
          ]}
        />
        <Table
          dataSource={filteredItems}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 编辑模态框 */}
      <Modal
        title="编辑用户认知条目"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="statement"
            label="画像认知描述"
            rules={[{ required: true, message: "请输入画像描述" }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select>
              {Object.entries(categoryMeta).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  {v.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="active">已生效 (Active)</Select.Option>
              <Select.Option value="pending">待审核 (Pending)</Select.Option>
              <Select.Option value="disabled">已停用 (Disabled)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="inject" label="是否注入客户端" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 注入摘要预览模态框 */}
      <Modal
        title="AI 客户端注入摘要预览"
        open={previewDigestVisible}
        onCancel={() => setPreviewDigestVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewDigestVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          这是客户端实际会看到的摘要。待审核条目，以及性格特质、生活作息，都不会出现在这里。
        </Paragraph>
        <Paragraph
          style={{
            background: "#f5f5f5",
            padding: 12,
            borderRadius: 6,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
          }}
        >
          {previewDigest}
        </Paragraph>
      </Modal>

      {/* 证据抽屉 */}
      <Drawer
        title="证据来源追溯"
        placement="right"
        width={420}
        onClose={() => setEvidenceDrawerItem(null)}
        open={Boolean(evidenceDrawerItem)}
      >
        {evidenceDrawerItem && (
          <div>
            <Title level={5}>{evidenceDrawerItem.statement}</Title>
            <Paragraph type="secondary">
              初次发现: {evidenceDrawerItem.firstSeenAt} · 最近更新: {evidenceDrawerItem.lastSeenAt}
            </Paragraph>
            <List
              dataSource={evidenceDrawerItem.evidence}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={`Session: ${item.sessionId}`}
                    description={
                      <div>
                        <Text style={{ fontStyle: "italic" }}>"{item.excerpt}"</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          时间: {item.occurredAt}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};
export default ProfilePage;
