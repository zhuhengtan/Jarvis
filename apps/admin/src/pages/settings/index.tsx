import React, { useEffect, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Select, Space, Switch, Tag, message } from "antd";
import { api } from "../../services/api";
import type { RuntimeSettings } from "../../types";

export const SettingsPage: React.FC = () => {
  const [form] = Form.useForm<RuntimeSettings>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<string>();
  const [embeddingStatus, setEmbeddingStatus] = useState<string>();
  useEffect(() => { api.getSettings().then((settings) => form.setFieldsValue(settings)).catch((error) => message.error(error.message)).finally(() => setLoading(false)); }, [form]);
  const save = async () => { try { const values = await form.validateFields(); setSaving(true); await api.updateSettings(values); message.success("设置已保存，新的检索请求立即生效"); } catch (error: any) { message.error(error.message || "设置保存失败"); } finally { setSaving(false); } };
  const testOllama = async () => { try { const result = await api.testOllama(); setOllamaStatus(result.ok ? `已连接：${result.model}` : `连接失败：${result.message}`); } catch (error: any) { setOllamaStatus(`连接失败：${error.message || "请求失败"}`); } };
  const testEmbedding = async () => { try { const result = await api.testEmbedding(); setEmbeddingStatus(result.ok ? `已连接：${result.model}（${result.dimensions} 维）` : `连接失败：${result.message}`); } catch (error: any) { setEmbeddingStatus(`连接失败：${error.message || "请求失败"}`); } };
  return <Space direction="vertical" size={16} style={{ width: "100%" }}>
    <Card title="Ollama 生成模型" loading={loading} extra={<Button onClick={testOllama}>测试连接</Button>}>
      <Form form={form} layout="vertical"><Form.Item name="provider" label="提炼 Provider"><Select options={[{ value: "ollama", label: "Ollama（本地）" }, { value: "none", label: "停用模型提炼" }]} /></Form.Item><Form.Item name="ollamaBaseUrl" label="Ollama 地址" rules={[{ required: true, type: "url" }]}><Input /></Form.Item><Form.Item name="ollamaModel" label="生成模型" rules={[{ required: true }]}><Input placeholder="qwen3.5:9b" /></Form.Item></Form>
      {ollamaStatus && <Tag color={ollamaStatus.startsWith("已连接") ? "green" : "red"}>{ollamaStatus}</Tag>}
    </Card>
    <Card title="Embedding 模型" extra={<Button onClick={testEmbedding}>测试 Embedding</Button>}>
      <Form form={form} layout="vertical"><Form.Item name="embeddingProvider" label="Embedding Provider"><Select options={[{ value: "ollama", label: "Ollama（本地）" }, { value: "none", label: "停用向量检索" }]} /></Form.Item><Form.Item name="embeddingBaseUrl" label="Embedding 地址" rules={[{ required: true, type: "url" }]}><Input /></Form.Item><Form.Item name="embeddingModel" label="Embedding 模型" rules={[{ required: true }]}><Input placeholder="nomic-embed-text" /></Form.Item></Form>
      <div style={{ color: "#8c8c8c", marginBottom: 8 }}>当前文本 RAG 使用关键词召回；Embedding 设置用于连接测试和后续向量索引，启用前不会改变现有召回结果。</div>
      {embeddingStatus && <Tag color={embeddingStatus.startsWith("已连接") ? "green" : "red"}>{embeddingStatus}</Tag>}
    </Card>
    <Card title="RAG 检索策略"><Form form={form} layout="vertical"><Form.Item name="ragMinScore" label="最低相关度阈值" extra="命中词数量低于该值的记录会被过滤；0 表示不过滤。"><InputNumber min={0} max={20} step={1} style={{ width: 180 }} /></Form.Item><Form.Item name="ragMaxResults" label="最大返回条数"><InputNumber min={1} max={100} style={{ width: 180 }} /></Form.Item><Form.Item name="ragMemoryLimit" label="上下文最多注入记忆数"><InputNumber min={1} max={100} style={{ width: 180 }} /></Form.Item><Form.Item name="ragRecentEventLimit" label="上下文最多注入近期事件数"><InputNumber min={0} max={100} style={{ width: 180 }} /></Form.Item><Form.Item name="ragSkillLimit" label="上下文最多注入 Skill 数"><InputNumber min={0} max={50} style={{ width: 180 }} /></Form.Item><Form.Item name="ragIncludeGlobal" label="检索全局记忆" valuePropName="checked"><Switch /></Form.Item><Form.Item name="autoConsolidation" label="启用后台自动整理" valuePropName="checked"><Switch /></Form.Item><Button type="primary" onClick={save} loading={saving}>保存全部设置</Button></Form></Card>
  </Space>;
};
