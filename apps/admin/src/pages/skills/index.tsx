import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Input,
  Button,
  Space,
  Drawer,
  Typography,
  message,
  Empty,
  Tag,
  Tabs,
  Form,
  Select,
  Popconfirm,
  Divider,
} from "antd";
import {
  ToolOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import { api } from "../../services/api";
import type { SkillItem, SkillBundle, SkillScript } from "../../types";

const { Text, Paragraph } = Typography;
const { Option } = Select;

// Preset Templates
const PRESET_TEMPLATES: Record<
  string,
  { name: string; description: string; content: string; scripts: SkillScript[] }
> = {
  code_review: {
    name: "code-review-pro",
    description: "全面代码审查与静态质量检查规范",
    content: `# Code Review & Quality Standards

## 目标
指导 AI Agent 按照团队标准对 PR / 代码变更进行严谨评审。

## 审查重点
1. 代码架构与单一职责原则。
2. 边界条件与异常处理。
3. 性能敏感路径与内存泄漏排查。

## 自动化检验
在审查代码前，请先调用配套脚本 \`scripts/verify.sh\` 执行本地 Lint 与类型检查。
`,
    scripts: [
      {
        filename: "verify.sh",
        content: `#!/bin/bash
set -e
echo "==> Running Automated Code Quality Verification..."
if [ -f "package.json" ]; then
  pnpm check || npm run check || echo "Check completed"
fi
echo "==> Verification completed successfully."
`,
      },
    ],
  },
  git_workflow: {
    name: "git-commit-workflow",
    description: "Git 提交与分支规范以及分支自动化清理工具",
    content: `# Git Commit & Branch Workflow

## 规范
1. Commit Message 遵循 Conventional Commits 格式：\`feat:\`, \`fix:\`, \`chore:\`, \`docs:\`。
2. 每个分支任务聚焦，完成合入后及时清理已合并分支。

## 工具脚本
调用 \`scripts/clean_branches.sh\` 可一键安全清理本地已合并的陈旧分支。
`,
    scripts: [
      {
        filename: "clean_branches.sh",
        content: `#!/bin/bash
echo "==> Pruning merged local branches..."
git branch --merged | grep -E -v "(^\*|master|main|dev)" | xargs -r git branch -d
echo "==> Done."
`,
      },
    ],
  },
  blank: {
    name: "custom-skill",
    description: "自定义业务技能",
    content: `# Custom Skill Instructions

在此输入该技能的核心指令与规则...
`,
    scripts: [],
  },
};

export const SkillsPage: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // Drawer states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [viewingBundle, setViewingBundle] = useState<SkillBundle | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states for editor
  const [form] = Form.useForm();
  const [scriptsList, setScriptsList] = useState<SkillScript[]>([]);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const data = await api.getSkills(query);
      setSkills(data);
    } catch (err: any) {
      message.error(err.message || "加载技能失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleOpenCreate = () => {
    setEditingName(null);
    form.resetFields();
    form.setFieldsValue({
      name: "",
      description: "",
      content: PRESET_TEMPLATES.code_review.content,
    });
    setScriptsList([...PRESET_TEMPLATES.code_review.scripts]);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = async (name: string) => {
    try {
      const bundle = await api.getSkillBundle(name);
      setEditingName(name);
      form.setFieldsValue({
        name: bundle.name,
        description: bundle.description,
        content: bundle.content,
      });
      setScriptsList(bundle.scripts || []);
      setIsEditorOpen(true);
    } catch (err: any) {
      message.error(err.message || "加载技能详情失败");
    }
  };

  const handleViewDetail = async (name: string) => {
    try {
      const bundle = await api.getSkillBundle(name);
      setViewingBundle(bundle);
    } catch (err: any) {
      message.error(err.message || "加载技能详情失败");
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await api.deleteSkill(name);
      message.info(`已删除技能: ${name}`);
      loadSkills();
    } catch (err: any) {
      message.error(err.message || "删除技能失败");
    }
  };

  const handleApplyTemplate = (key: string) => {
    const tmpl = PRESET_TEMPLATES[key];
    if (tmpl) {
      form.setFieldsValue({
        name: editingName ? form.getFieldValue("name") : tmpl.name,
        description: tmpl.description,
        content: tmpl.content,
      });
      setScriptsList([...tmpl.scripts]);
      message.success(`已套用模板: ${tmpl.description}`);
    }
  };

  const handleAddScript = () => {
    setScriptsList((prev) => [
      ...prev,
      {
        filename: `script_${prev.length + 1}.sh`,
        content: `#!/bin/bash\n# Write your helper script here...\n`,
      },
    ]);
  };

  const handleUpdateScript = (index: number, key: keyof SkillScript, value: string) => {
    setScriptsList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const handleRemoveScript = (index: number) => {
    setScriptsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveBundle = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const bundle: SkillBundle = {
        name: values.name,
        description: values.description,
        content: values.content,
        scripts: scriptsList,
      };

      if (editingName) {
        await api.updateSkillBundle(editingName, bundle);
        message.success("技能已成功更新");
      } else {
        await api.saveSkillBundle(bundle);
        message.success("新技能已成功保存并安装");
      }

      setIsEditorOpen(false);
      loadSkills();
    } catch (err: any) {
      message.error(err.message || "保存技能失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title={
          <Space>
            <ToolOutlined style={{ color: "#722ed1" }} />
            <span>Jarvis 技能注册中心 (Skills Registry & Bundles)</span>
            <Tag color="purple">{skills.length} 个可用技能</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
            >
              新增技能 (New Skill)
            </Button>
            <Input.Search
              placeholder="搜索技能库..."
              allowClear
              enterButton={<SearchOutlined />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onSearch={loadSkills}
              style={{ width: 240 }}
            />
            <Button icon={<ReloadOutlined />} onClick={loadSkills} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        {skills.length === 0 ? (
          <Empty description="未安装技能或技能根目录为空，点击右上角即可新增技能。" />
        ) : (
          <Row gutter={[16, 16]}>
            {skills.map((skill) => (
              <Col xs={24} sm={12} md={8} lg={6} key={skill.name}>
                <Card
                  hoverable
                  size="small"
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                  actions={[
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => handleViewDetail(skill.name)}
                    >
                      查看
                    </Button>,
                    <Button
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => handleOpenEdit(skill.name)}
                    >
                      编辑
                    </Button>,
                    <Popconfirm
                      title="确认删除该技能？"
                      description="删除后对应的 SKILL.md 及配套 scripts/* 均将被移除。"
                      onConfirm={() => handleDelete(skill.name)}
                      okText="删除"
                      cancelText="取消"
                    >
                      <Button type="link" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Text strong style={{ fontSize: 14 }}>
                          {skill.name}
                        </Text>
                        {skill.scriptCount && skill.scriptCount > 0 ? (
                          <Tag color="cyan" icon={<CodeOutlined />}>
                            {skill.scriptCount} 个脚本
                          </Tag>
                        ) : (
                          <Tag color="default">纯规则</Tag>
                        )}
                      </div>
                    }
                    description={
                      <Paragraph
                        ellipsis={{ rows: 2 }}
                        style={{ color: "#595959", margin: "8px 0 0", minHeight: 38 }}
                      >
                        {skill.description || "无详细说明"}
                      </Paragraph>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {/* Editor Drawer (Create / Edit Skill Bundle) */}
      <Drawer
        title={editingName ? `编辑技能包: ${editingName}` : "新增技能能力包 (New Skill Bundle)"}
        width={750}
        placement="right"
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setIsEditorOpen(false)}>取消</Button>
            <Button
              type="primary"
              loading={submitting}
              onClick={handleSaveBundle}
            >
              保存并生效
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="技能唯一英文标识 (Name)"
                rules={[
                  { required: true, message: "请输入技能标识" },
                  { pattern: /^[a-zA-Z0-9_-]+$/, message: "仅允许英文、数字、下划线及短横线" },
                ]}
              >
                <Input
                  disabled={Boolean(editingName)}
                  placeholder="例如：code-review-pro"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="快捷套用复合模板">
                <Select placeholder="选择开箱即用模板填充" onChange={handleApplyTemplate}>
                  <Option value="code_review">代码自动化体检规范 (含 verify.sh)</Option>
                  <Option value="git_workflow">Git 提交合规规范 (含 clean.sh)</Option>
                  <Option value="blank">空白自定义规范 (纯 Markdown)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="简要说明 (Description)"
            rules={[{ required: true, message: "请输入简要说明" }]}
          >
            <Input placeholder="一句话概括此技能的主要职责与作用" />
          </Form.Item>

          <Divider style={{ margin: "16px 0" }} />

          <Tabs
            items={[
              {
                key: "skill_md",
                label: (
                  <span>
                    <CodeOutlined style={{ marginRight: 6 }} />
                    📄 核心指令 (SKILL.md)
                  </span>
                ),
                children: (
                  <Form.Item
                    name="content"
                    rules={[{ required: true, message: "请输入 SKILL.md Markdown 内容" }]}
                    extra="编写供 AI 模型执行的完整 Prompt 指引。若有配套脚本，请在正文中提示模型调用 scripts/<filename>。"
                  >
                    <Input.TextArea
                      rows={14}
                      style={{ fontFamily: "monospace", fontSize: 13 }}
                      placeholder="# Skill Title&#10;&#10;## Instructions&#10;..."
                    />
                  </Form.Item>
                ),
              },
              {
                key: "scripts",
                label: (
                  <span>
                    <CodeOutlined style={{ marginRight: 6 }} />
                    ⚡ 配套脚本 (Scripts) ({scriptsList.length})
                  </span>
                ),
                children: (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        存放在 <code>scripts/</code> 目录下的可执行辅助程序（Shell, Python, TypeScript 等）。服务端将自动执行 <code>chmod 755</code> 赋权。
                      </Text>
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={handleAddScript}
                      >
                        添加脚本文件
                      </Button>
                    </div>

                    {scriptsList.length === 0 ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="当前技能暂无配套脚本。点击上方按钮可添加辅助脚本。"
                      />
                    ) : (
                      scriptsList.map((script, idx) => (
                        <Card
                          key={idx}
                          size="small"
                          style={{ background: "#fafafa" }}
                          title={
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Tag color="blue">scripts/</Tag>
                              <Input
                                size="small"
                                style={{ width: 220, fontFamily: "monospace" }}
                                value={script.filename}
                                placeholder="例如 verify.sh"
                                onChange={(e) =>
                                  handleUpdateScript(idx, "filename", e.target.value)
                                }
                              />
                            </div>
                          }
                          extra={
                            <Popconfirm
                              title="确认移除该脚本？"
                              onConfirm={() => handleRemoveScript(idx)}
                              okText="移除"
                              cancelText="取消"
                            >
                              <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                              />
                            </Popconfirm>
                          }
                        >
                          <Input.TextArea
                            rows={8}
                            style={{ fontFamily: "monospace", fontSize: 12 }}
                            value={script.content}
                            placeholder="#!/bin/bash&#10;# Write your script code..."
                            onChange={(e) =>
                              handleUpdateScript(idx, "content", e.target.value)
                            }
                          />
                        </Card>
                      ))
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>

      {/* View Detail Drawer */}
      <Drawer
        title={
          <Space>
            <ToolOutlined />
            <span>技能能力包全貌: {viewingBundle?.name}</span>
          </Space>
        }
        width={750}
        placement="right"
        open={Boolean(viewingBundle)}
        onClose={() => setViewingBundle(null)}
        extra={
          viewingBundle && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                const name = viewingBundle.name;
                setViewingBundle(null);
                handleOpenEdit(name);
              }}
            >
              在线编辑
            </Button>
          )
        }
      >
        {viewingBundle && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <Text strong style={{ fontSize: 13, color: "#8c8c8c" }}>
                简要说明:
              </Text>
              <Paragraph style={{ marginTop: 4, fontSize: 14 }}>
                {viewingBundle.description || "无"}
              </Paragraph>
            </div>

            <Tabs
              items={[
                {
                  key: "view_md",
                  label: "📄 SKILL.md",
                  children: (
                    <div
                      style={{
                        padding: 16,
                        background: "#f5f5f5",
                        borderRadius: 6,
                        fontFamily: "monospace",
                        fontSize: 13,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {viewingBundle.content}
                    </div>
                  ),
                },
                {
                  key: "view_scripts",
                  label: `⚡ 配套脚本 (${viewingBundle.scripts?.length ?? 0})`,
                  children: (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {viewingBundle.scripts?.length ? (
                        viewingBundle.scripts.map((script) => (
                          <Card
                            key={script.filename}
                            size="small"
                            title={
                              <Space>
                                <Tag color="cyan">scripts/{script.filename}</Tag>
                              </Space>
                            }
                          >
                            <div
                              style={{
                                padding: 12,
                                background: "#1e1e1e",
                                color: "#d4d4d4",
                                borderRadius: 4,
                                fontFamily: "monospace",
                                fontSize: 12,
                                whiteSpace: "pre-wrap",
                                maxHeight: 300,
                                overflowY: "auto",
                              }}
                            >
                              {script.content}
                            </div>
                          </Card>
                        ))
                      ) : (
                        <Empty description="该技能无配套独立脚本" />
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
