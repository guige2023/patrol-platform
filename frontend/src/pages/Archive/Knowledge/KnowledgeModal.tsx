import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, message, Descriptions, Tag, Upload, Button, List } from 'antd';
import { UploadOutlined, DownloadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { createKnowledge, updateKnowledge, getKnowledge } from '@/api/knowledge';
import api from '@/api/client';
import dayjs from 'dayjs';
import { getErrorMessage } from '@/utils/error';
import { useFieldOptions } from '@/hooks/useFieldOptions';

interface KnowledgeModalProps {
  open: boolean;
  knowledgeId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface Attachment {
  filename: string;
  url: string;
  size: number;
  upload_time: string;
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
  attachments?: Attachment[];
}

const KnowledgeModal: React.FC<KnowledgeModalProps> = ({ open, knowledgeId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [form] = Form.useForm();
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeData | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewFilename, setPreviewFilename] = useState<string>('');

  const { getOptions } = useFieldOptions();
  const categoryOptions = getOptions('knowledge_category');

  useEffect(() => {
    if (open) {
      if (knowledgeId) {
        setViewMode(true);
        setKnowledgeData(null);
        setAttachments([]);
        getKnowledge(knowledgeId).then((res: any) => {
          setKnowledgeData(res);
          setAttachments(res.attachments || []);
        }).catch(() => {
          message.error('获取知识详情失败');
        });
      } else {
        setViewMode(false);
        setKnowledgeData(null);
        setAttachments([]);
        form.resetFields();
      }
    }
  }, [open, knowledgeId]);

  const handleUpload = async (file: File) => {
    if (!knowledgeId) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/knowledge/${knowledgeId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAttachments(prev => [...prev, res.data || res]);
      message.success('上传成功');
    } catch (e: any) {
      message.error(getErrorMessage(e) || '上传失败');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleDownload = async (att: Attachment) => {
    if (!knowledgeId) return;
    const token = localStorage.getItem('token');
    if (!token) {
      message.error('未登录或登录已过期，请重新登录');
      return;
    }
    try {
      const res = await fetch(`/api/knowledge/${knowledgeId}/attachments/${encodeURIComponent(att.filename)}/download?watermark=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let errMsg = '下载失败';
        try {
          const errData = await res.json();
          errMsg = errData.detail || errData.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = att.filename;
      a.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      message.error(e.message || '下载失败');
    }
  };

  const handlePreview = async (att: Attachment) => {
    if (!knowledgeId) return;
    const token = localStorage.getItem('token');
    if (!token) {
      message.error('未登录或登录已过期，请重新登录');
      return;
    }
    try {
      const res = await fetch(`/api/knowledge/${knowledgeId}/attachments/${encodeURIComponent(att.filename)}/download?watermark=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let errMsg = '预览失败';
        try {
          const errData = await res.json();
          errMsg = errData.detail || errData.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setPreviewUrl(blobUrl);
      setPreviewFilename(att.filename);
      setPreviewOpen(true);
    } catch (e: any) {
      message.error(e.message || '预览失败');
    }
  };

  const handleDeleteAttachment = async (att: Attachment) => {
    if (!knowledgeId) return;
    try {
      await api.delete(`/knowledge/${knowledgeId}/attachments/${att.filename}`);
      setAttachments(prev => prev.filter(a => a.filename !== att.filename));
      message.success('删除成功');
    } catch (e: any) {
      message.error(getErrorMessage(e) || '删除失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
      message.error(getErrorMessage(e) || '操作失败');
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
    <>
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
      {knowledgeId && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>附件列表</span>
            <Upload
              accept="*"
              showUploadList={false}
              beforeUpload={handleUpload}
              disabled={uploading}
            >
              <Button size="small" icon={<UploadOutlined />} loading={uploading}>上传附件</Button>
            </Upload>
          </div>
          {attachments.length === 0 ? (
            <div style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>暂无附件</div>
          ) : (
            <List
              size="small"
              dataSource={attachments}
              renderItem={(att: Attachment) => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" key="preview" icon={<EyeOutlined />} onClick={() => handlePreview(att)}>预览</Button>,
                    <Button type="link" size="small" key="download" icon={<DownloadOutlined />} onClick={() => handleDownload(att)}>下载</Button>,
                    <Button type="link" size="small" danger key="delete" icon={<DeleteOutlined />} onClick={() => handleDeleteAttachment(att)}>删除</Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={att.filename}
                    description={`${formatFileSize(att.size)} · ${att.upload_time ? dayjs(att.upload_time).format('YYYY-MM-DD HH:mm') : ''}`}
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      )}
    </>
  );

  return (
    <>
    <Modal
      title={knowledgeId ? (viewMode ? '知识详情' : '编辑知识') : '新建知识'}
      open={open}
      onCancel={onClose}
      onOk={viewMode ? handleViewEdit : handleSubmit}
      okText={viewMode ? '编辑' : '保存'}
      confirmLoading={loading}
      width={600}
    >
      {viewMode ? renderViewMode() : (
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={categoryOptions} placeholder="请选择分类" />
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

    {/* 预览 Modal */}
    <Modal
      title={`预览：${previewFilename}`}
      open={previewOpen}
      onCancel={() => {
        setPreviewOpen(false);
        if (previewUrl) {
          window.URL.revokeObjectURL(previewUrl);
          setPreviewUrl('');
        }
      }}
      footer={null}
      width={800}
      bodyStyle={{ height: '70vh', padding: 0 }}
    >
      {previewUrl && (
        <iframe
          src={previewUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={`预览：${previewFilename}`}
        />
      )}
    </Modal>
    </>
  );
};

export default KnowledgeModal;
