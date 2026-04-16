import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Table, Button, Space, Radio, Input, message, Modal, Upload } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, UploadOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '@/components/common/PageHeader';
import StatusTag from '@/components/common/StatusTag';
import { getRectification, confirmRectification, reimportRectification, downloadRectificationTemplate, exportSingleRectificationPdf } from '@/api/rectifications';
import type { ColumnsType } from 'antd/es/table';

const { TextArea } = Input;

interface RectificationItem {
  id: string;
  category: string;
  content: string;
  status: string;
}

interface RectificationDetailData {
  id: string;
  title: string;
  unit_name?: string;
  plan_name?: string;
  feedback_date?: string;
  deadline?: string;
  status: string;
  items?: RectificationItem[];
  confirmed_completed?: boolean;
  confirm_notes?: string;
  confirmed_at?: string;
  confirmed_by?: string;
  updated_at?: string;
  updated_by?: string;
}

const RectificationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<RectificationDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmCompleted, setConfirmCompleted] = useState<boolean | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [reimportModalVisible, setReimportModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getRectification(id);
      setData(res);
      setConfirmCompleted(res.confirmed_completed ?? null);
      setConfirmNotes(res.confirm_notes || '');
    } catch {
      message.error('获取详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (confirmCompleted === null) {
      message.error('请选择完成状态');
      return;
    }
    setConfirmLoading(true);
    try {
      await confirmRectification(id!, confirmCompleted, confirmNotes);
      message.success('确认成功');
      fetchData();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '确认失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleReimport = async (file: File) => {
    try {
      await reimportRectification(id!, file);
      message.success('重新导入成功');
      setReimportModalVisible(false);
      fetchData();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '重新导入失败');
    }
    return false;
  };

  const handleExportPdf = () => {
    if (id) {
      exportSingleRectificationPdf(id).catch(() => message.error('导出失败'));
    }
  };

  const itemColumns: ColumnsType<RectificationItem> = [
    { title: '分类', dataIndex: 'category', key: 'category', width: 150 },
    { title: '内容', dataIndex: 'content', key: 'content' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <StatusTag status={status} />,
    },
  ];

  if (loading) {
    return <Card loading />;
  }

  if (!data) {
    return <Card>未找到数据</Card>;
  }

  return (
    <div>
      <PageHeader
        title="整改详情"
        breadcrumbs={[
          { name: '执纪执行', path: '/execution/rectifications' },
          { name: '整改详情' },
        ]}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/execution/rectifications')}>
              返回
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setReimportModalVisible(true)}>
              重新导入
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleExportPdf}>
              导出整改通知书
            </Button>
          </Space>
        }
      />

      {/* Basic Info Card */}
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="标题">{data.title}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <StatusTag status={data.status} />
          </Descriptions.Item>
          <Descriptions.Item label="被巡察单位">{data.unit_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="所属计划">{data.plan_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="反馈日期">
            {data.feedback_date ? dayjs(data.feedback_date).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="截止日期">
            {data.deadline ? dayjs(data.deadline).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Rectification Items Card */}
      <Card title="整改事项" style={{ marginBottom: 16 }}>
        <Table
          columns={itemColumns}
          dataSource={data.items || []}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      {/* Manual Confirm Card */}
      <Card title="人工确认完成" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Radio.Group
            value={confirmCompleted}
            onChange={(e) => setConfirmCompleted(e.target.value)}
          >
            <Radio value={true}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} /> 已完成
            </Radio>
            <Radio value={false} style={{ marginLeft: 24 }}>
              未完成
            </Radio>
          </Radio.Group>
          
          <TextArea
            rows={3}
            placeholder="请输入确认说明（可选）"
            value={confirmNotes}
            onChange={(e) => setConfirmNotes(e.target.value)}
          />
          
          <Button type="primary" loading={confirmLoading} onClick={handleConfirm}>
            确认
          </Button>
        </Space>
      </Card>

      {/* Last Update Info */}
      <Card size="small">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="最后更新">
            {data.updated_at ? dayjs(data.updated_at).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="操作人">{data.updated_by || '-'}</Descriptions.Item>
          {data.confirmed_at && (
            <>
              <Descriptions.Item label="确认时间">
                {dayjs(data.confirmed_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="确认人">{data.confirmed_by || '-'}</Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {/* Reimport Modal */}
      <Modal
        title="重新导入整改记录"
        open={reimportModalVisible}
        onCancel={() => setReimportModalVisible(false)}
        footer={null}
      >
        <div style={{ padding: '20px 0' }}>
          <Button onClick={() => downloadRectificationTemplate()} style={{ marginBottom: 16 }}>
            下载模板
          </Button>
          <Upload
            accept=".xlsx"
            showUploadList={false}
            beforeUpload={handleReimport}
          >
            <Button icon={<UploadOutlined />}>选择 Excel 文件</Button>
          </Upload>
        </div>
      </Modal>
    </div>
  );
};

export default RectificationDetail;
