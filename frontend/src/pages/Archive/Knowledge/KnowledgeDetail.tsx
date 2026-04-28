import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Switch, Button, Card, message, Table, Space, Modal } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getKnowledgeDetail, updateKnowledge } from '@/api/knowledge';
import { getErrorMessage } from '@/utils/error';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:18800';

const KnowledgeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [knowledgeData, setKnowledgeData] = useState<any>(null);

  useEffect(() => {
    if (id) {
      getKnowledgeDetail(id).then((data: any) => {
        form.setFieldsValue(data);
        setKnowledgeData(data);
      }).catch(console.error);
    }
  }, [id]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await updateKnowledge(id!, values);
      message.success('保存成功');
      navigate('/archive/knowledge');
    } catch (e: any) {
      message.error(getErrorMessage(e) || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 附件预览
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // 支持在 iframe 中预览的文件类型（浏览器原生支持）
  const PREVIEWABLE_TYPES = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']);

  const handlePreview = async (filename: string, fileType?: string) => {
    try {
      // 对于不支持在浏览器内预览的文件类型，改为下载
      const ext = (fileType || filename.split('.').pop() || '').toLowerCase();
      if (!PREVIEWABLE_TYPES.has(ext)) {
        message.info('该文件格式暂不支持在线预览，已改为下载');
        handleDownload(filename);
        return;
      }
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/v1/knowledge-files/${id}/attachments/${encodeURIComponent(filename)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('预览失败');
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
        setPreviewVisible(true);
      };
      reader.onerror = () => {
        throw new Error('读取文件失败');
      };
      reader.readAsDataURL(blob);
    } catch (e: any) {
      message.error('预览失败: ' + (e.message || '未知错误'));
    }
  };

  // 附件下载
  const handleDownload = async (filename: string) => {
    try {
      const token = localStorage.getItem('token');
      // 必须调用 /download 端点（返回 attachment Content-Disposition），不能用预览端点（inline）
      const response = await fetch(`${API_BASE}/api/v1/knowledge-files/${id}/attachments/${encodeURIComponent(filename)}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('下载失败');
      const blob = await response.blob();
      // 从 Content-Disposition header 提取原始文件名
      const contentDisp = response.headers.get('Content-Disposition') || '';
      const fnMatch = contentDisp.match(/filename\*?=['"]?(?:UTF-8'')?([^;\n"']+)/i);
      const downloadName = fnMatch ? decodeURIComponent(fnMatch[1]) : filename;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      message.error('下载失败: ' + (e.message || '未知错误'));
    }
  };

  const attachments = knowledgeData?.attachments || [];
  const attachmentColumns = [
    { title: '文件名', dataIndex: 'filename', key: 'filename' },
    { title: '大小', dataIndex: 'size', key: 'size', render: (size: number) => size ? `${(size / 1024).toFixed(2)} KB` : '-' },
    { title: '上传时间', dataIndex: 'upload_time', key: 'upload_time', render: (time: string) => time ? new Date(time).toLocaleString() : '-' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handlePreview(record.filename, record.file_type)}>预览</Button>
          <Button type="link" icon={<DownloadOutlined />} onClick={() => handleDownload(record.filename)}>下载</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="知识详情" breadcrumbs={[{ name: '档案管理' }, { name: '知识库', path: '/archive/knowledge' }, { name: '知识详情' }]} />
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select placeholder="请选择分类">
              <Select.Option value="regulation">法规</Select.Option>
              <Select.Option value="policy">政策</Select.Option>
              <Select.Option value="dict">制度</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="version" label="版本">
            <Input placeholder="请输入版本" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="请输入标签">
            </Select>
          </Form.Item>
          <Form.Item name="is_published" label="已发布" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate('/archive/knowledge')}>取消</Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 附件列表 */}
      {attachments.length > 0 && (
        <Card title="附件列表" style={{ marginTop: 16 }}>
          <Table
            columns={attachmentColumns}
            dataSource={attachments}
            rowKey="filename"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* 附件预览 Modal */}
      <Modal
        title="附件预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        <iframe
          src={previewUrl}
          style={{ width: '100%', height: '600px', border: 'none' }}
          title="附件预览"
        />
      </Modal>
    </div>
  );
};

export default KnowledgeDetail;
