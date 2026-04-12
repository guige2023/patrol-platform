import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, message } from 'antd';
import { createKnowledge, updateKnowledge, getKnowledge } from '@/api/knowledge';

interface KnowledgeModalProps {
  open: boolean;
  knowledgeId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const KnowledgeModal: React.FC<KnowledgeModalProps> = ({ open, knowledgeId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (knowledgeId) {
        setViewMode(true);
        getKnowledge(knowledgeId).then((res: any) => {
          form.setFieldsValue(res);
        }).catch(console.error);
      } else {
        setViewMode(false);
        form.resetFields();
      }
    }
  }, [open, knowledgeId]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      if (knowledgeId) {
        await updateKnowledge(knowledgeId, values);
        message.success('更新成功');
      } else {
        await createKnowledge(values);
        message.success('创建成功');
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.response?.data?.detail || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewEdit = () => {
    setViewMode(false);
  };

  return (
    <Modal
      title={knowledgeId ? (viewMode ? '知识详情' : '编辑知识') : '新建知识'}
      open={open}
      onCancel={onClose}
      onOk={viewMode ? handleViewEdit : handleSubmit}
      okText={viewMode ? '编辑' : '保存'}
      confirmLoading={loading}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="请输入标题" disabled={viewMode} />
        </Form.Item>
        <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
          <Select placeholder="请选择分类" disabled={viewMode}>
            <Select.Option value="regulation">法规</Select.Option>
            <Select.Option value="policy">政策</Select.Option>
            <Select.Option value="dict">字典</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="version" label="版本">
          <Input placeholder="请输入版本" disabled={viewMode} />
        </Form.Item>
        <Form.Item name="content" label="内容">
          <Input.TextArea rows={4} placeholder="请输入内容" disabled={viewMode} />
        </Form.Item>
        <Form.Item name="tags" label="标签">
          <Select mode="tags" placeholder="输入标签后回车确认" disabled={viewMode} />
        </Form.Item>
        <Form.Item name="source" label="来源">
          <Input placeholder="请输入来源" disabled={viewMode} />
        </Form.Item>
        <Form.Item name="effective_date" label="生效日期">
          <DatePicker style={{ width: '100%' }} disabled={viewMode} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default KnowledgeModal;
