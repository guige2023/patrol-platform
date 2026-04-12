import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, message, Descriptions, Tag } from 'antd';
import { createKnowledge, updateKnowledge, getKnowledge } from '@/api/knowledge';
import dayjs from 'dayjs';

interface KnowledgeModalProps {
  open: boolean;
  knowledgeId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface KnowledgeData {
  id?: string;
  title?: string;
  category?: string;
  version?: string;
  content?: string;
  tags?: string[];
  source?: string;
  effective_date?: string;
  is_published?: boolean;
  created_at?: string;
}

const KnowledgeModal: React.FC<KnowledgeModalProps> = ({ open, knowledgeId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [form] = Form.useForm();
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeData | null>(null);

  useEffect(() => {
    if (open) {
      if (knowledgeId) {
        setViewMode(true);
        setKnowledgeData(null);
        getKnowledge(knowledgeId).then((res: any) => {
          setKnowledgeData(res);
        }).catch(() => {
          message.error('获取知识详情失败');
        });
      } else {
        setViewMode(false);
        setKnowledgeData(null);
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
    if (knowledgeData) {
      form.setFieldsValue({
        ...knowledgeData,
        effective_date: knowledgeData.effective_date ? dayjs(knowledgeData.effective_date) : undefined,
      });
    }
    setViewMode(false);
  };

  const categoryLabels: Record<string, string> = {
    regulation: '法规',
    policy: '政策',
    dict: '字典',
  };

  const renderViewMode = () => (
    <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
      <Descriptions.Item label="标题">{knowledgeData?.title || '-'}</Descriptions.Item>
      <Descriptions.Item label="分类">{categoryLabels[knowledgeData?.category || ''] || knowledgeData?.category || '-'}</Descriptions.Item>
      <Descriptions.Item label="版本">{knowledgeData?.version || '-'}</Descriptions.Item>
      <Descriptions.Item label="内容">{knowledgeData?.content || '-'}</Descriptions.Item>
      <Descriptions.Item label="标签">
        {knowledgeData?.tags && knowledgeData.tags.length > 0
          ? knowledgeData.tags.map((tag: string) => <Tag key={tag}>{tag}</Tag>)
          : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="来源">{knowledgeData?.source || '-'}</Descriptions.Item>
      <Descriptions.Item label="生效日期">
        {knowledgeData?.effective_date ? dayjs(knowledgeData.effective_date).format('YYYY-MM-DD') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="状态">
        {knowledgeData?.is_published ? <span style={{ color: '#52c41a' }}>已发布</span> : <span style={{ color: '#faad14' }}>草稿</span>}
      </Descriptions.Item>
      <Descriptions.Item label="创建时间">
        {knowledgeData?.created_at ? dayjs(knowledgeData.created_at).format('YYYY-MM-DD HH:mm') : '-'}
      </Descriptions.Item>
    </Descriptions>
  );

  return (
    <Modal
      title={knowledgeId ? (viewMode ? '知识详情' : '编辑知识') : '新建知识'}
      open={open}
      onCancel={onClose}
      onOk={viewMode ? handleViewEdit : handleSubmit}
      okText={viewMode ? '编辑' : '保存'}
      confirmLoading={loading}
      width={600}
      destroyOnHidden
    >
      {viewMode ? renderViewMode() : (
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="请选择分类">
              <Select.Option value="regulation">法规</Select.Option>
              <Select.Option value="policy">政策</Select.Option>
              <Select.Option value="dict">字典</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="version" label="版本">
            <Input placeholder="请输入版本" />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={4} placeholder="请输入内容" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车确认" />
          </Form.Item>
          <Form.Item name="source" label="来源">
            <Input placeholder="请输入来源" />
          </Form.Item>
          <Form.Item name="effective_date" label="生效日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

export default KnowledgeModal;
