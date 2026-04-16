import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Card, Select, message, Upload, Modal, Tag, Progress as ProgressBar, Alert } from 'antd';
import { UploadOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import PageHeader from '@/components/common/PageHeader';
import { getProgressList } from '@/api/progress';
import { getPlans } from '@/api/plans';
import api from '@/api/client';

interface ProgressRecord {
  id: string;
  plan_id: string;
  plan_name?: string;
  group_id?: string;
  group_name?: string;
  week_number: number;
  report_date: string;
  talk_count: number;
  doc_review_count: number;
  petition_count: number;
  visit_count: number;
  problem_total: number;
  problem_party: number;
  problem_pty: number;
  problem_key: number;
  next_week_plan: string;
  notes?: string;
  created_at: string;
}

interface GroupProgress {
  group_id: string;
  group_name: string;
  plan_name: string;
  progress: number;
  status: string;
}

const ProgressPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProgressRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [planOptions, setPlanOptions] = useState<{ label: string; value: string }[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(undefined);
  const [groupProgress, setGroupProgress] = useState<GroupProgress[]>([]);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const [importing, setImporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getProgressList({
        page,
        page_size: pageSize,
        plan_id: selectedPlanId,
      });
      setData(res.items || []);
      setTotal(res.total || 0);
    } catch {
      message.error('加载进度数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanOptions = async () => {
    try {
      const res = await getPlans({ page_size: 100 });
      const plans = res.items || [];
      setPlanOptions(plans.map((p: any) => ({ label: p.name, value: p.id })));
    } catch {
      // ignore
    }
  };

  const fetchGroupProgress = async () => {
    try {
      const res = await api.get('/progress/group-overview', { params: { plan_id: selectedPlanId } });
      setGroupProgress(res.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPlanOptions();
  }, []);

  useEffect(() => {
    fetchData();
  }, [page, pageSize, selectedPlanId]);

  useEffect(() => {
    if (selectedPlanId) {
      fetchGroupProgress();
    } else {
      setGroupProgress([]);
    }
  }, [selectedPlanId]);

  const handleImportProgress = async () => {
    if (uploadFileList.length === 0 || !uploadFileList[0]?.originFileObj) {
      message.error('请选择要导入的文件');
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFileList[0].originFileObj as Blob);
      if (selectedPlanId) {
        formData.append('plan_id', selectedPlanId);
      }
      await api.post('/progress/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('导入成功');
      setUploadModalVisible(false);
      setUploadFileList([]);
      fetchData();
      fetchGroupProgress();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const columns: ColumnsType<ProgressRecord> = [
    { title: '周次', dataIndex: 'week_number', key: 'week_number', width: 60 },
    { title: '计划', dataIndex: 'plan_name', key: 'plan_name', ellipsis: true },
    { title: '巡察组', dataIndex: 'group_name', key: 'group_name' },
    { title: '报告日期', dataIndex: 'report_date', key: 'report_date', render: (d: string) => d?.split('T')[0] },
    { title: '谈话', dataIndex: 'talk_count', key: 'talk_count' },
    { title: '查阅文档', dataIndex: 'doc_review_count', key: 'doc_review_count' },
    { title: '信访', dataIndex: 'petition_count', key: 'petition_count' },
    { title: '走访', dataIndex: 'visit_count', key: 'visit_count' },
    { title: '发现问题', dataIndex: 'problem_total', key: 'problem_total' },
    { title: '立行立改', dataIndex: 'problem_party', key: 'problem_party', render: (v: number) => <Tag color="green">{v}</Tag> },
    { title: '线索', dataIndex: 'problem_pty', key: 'problem_pty', render: (v: number) => <Tag color="orange">{v}</Tag> },
    { title: '重点问题', dataIndex: 'problem_key', key: 'problem_key', render: (v: number) => <Tag color="red">{v}</Tag> },
    { title: '下周计划', dataIndex: 'next_week_plan', key: 'next_week_plan', ellipsis: true },
  ];

  return (
    <div>
      <PageHeader
        title="进度管理"
        breadcrumbs={[{ name: '执行管理' }, { name: '进度管理' }]}
      />

      {/* 统计卡片 */}
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          {groupProgress.map((gp, idx) => (
            <Card key={idx} size="small" style={{ width: 240 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{gp.plan_name} - {gp.group_name}</div>
              <ProgressBar percent={gp.progress} status={gp.status === '已完成' ? 'success' : 'active'} size="small" />
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                {gp.status} ({gp.progress}%)
              </div>
            </Card>
          ))}
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>选择计划：</span>
          <Select
            value={selectedPlanId}
            onChange={setSelectedPlanId}
            options={[{ label: '全部计划', value: '' }, ...planOptions]}
            style={{ width: 200 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setUploadModalVisible(true)}
          >
            导入进度
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          showTotal: (t) => `共 ${t} 条`,
        }}
      />

      {/* 导入 Modal */}
      <Modal
        title="导入进度数据"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          setUploadFileList([]);
        }}
        onOk={handleImportProgress}
        confirmLoading={importing}
      >
        <Alert
          message="请下载模板后填写数据，然后上传导入"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            icon={<FileExcelOutlined />}
            onClick={() => {
              // Download template
              window.open('/api/v1/progress/template', '_blank');
            }}
          >
            下载导入模板
          </Button>
          <Upload
            fileList={uploadFileList}
            onChange={({ fileList }) => setUploadFileList(fileList)}
            beforeUpload={() => false}
            accept=".xlsx"
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>选择 Excel 文件</Button>
          </Upload>
        </Space>
      </Modal>
    </div>
  );
};

export default ProgressPage;
