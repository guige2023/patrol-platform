import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Space, Modal, message, DatePicker, Descriptions, Select } from 'antd';
import { getPlan, createPlan, updatePlan } from '@/api/plans';
import dayjs from 'dayjs';
import { getErrorMessage } from '@/utils/error';

interface PlanDetailProps {
  open: boolean;
  planId?: string | null;
  mode: 'create' | 'view' | 'edit';
  onClose: () => void;
  onSuccess: () => void;
}

interface PlanData {
  id?: string;
  name?: string;
  year?: number;
  round_name?: string;
  scope?: string;
  focus_areas?: string;
  authorization_letter?: string;
  authorization_date?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  status?: string;
  version?: string;
  approval_comment?: string;
  created_at?: string;
}

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已提交', value: 'submitted' },
  { label: '已批准', value: 'approved' },
  { label: '已发布', value: 'published' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
];

const PlanDetail: React.FC<PlanDetailProps> = ({ open, planId, mode, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [planData, setPlanData] = useState<PlanData | null>(null);

  useEffect(() => {
    if (open && mode === 'create') {
      form.setFieldsValue({ year: new Date().getFullYear() });
    }
  }, [open, mode]);

  useEffect(() => {
    if (open && planId && (mode === 'edit' || mode === 'view')) {
      setPlanData(null);
      getPlan(planId).then((res: any) => {
        setPlanData(res);
        const formData: any = { ...res };
        if (res.actual_start_date && res.actual_end_date) {
          formData.actual_date_range = [dayjs(res.actual_start_date), dayjs(res.actual_end_date)];
        }
        // focus_areas: API 返回数组，表单是字符串，编辑时需转换
        if (Array.isArray(res.focus_areas)) {
          formData.focus_areas = res.focus_areas.join('、');
        }
        // authorization_date: API 返回 ISO 字符串，表单 DatePicker 需要 dayjs
        if (res.authorization_date) {
          formData.authorization_date = dayjs(res.authorization_date);
        }
        form.setFieldsValue(formData);
      }).catch(() => {
        message.error('获取计划详情失败');
      });
    } else if (open && !planId && mode === 'create') {
      setPlanData(null);
    }
  }, [open, planId, mode]);

  const isView = mode === 'view';

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload: any = {
        name: values.name,
        year: values.year,
      };
      if (values.round_name) payload.round_name = values.round_name;
      if (values.scope) payload.scope = values.scope;

      // focus_areas 表单是 string，转为 List[str]
      if (values.focus_areas) {
        payload.focus_areas = values.focus_areas.split(/[，,\n]/).map((s: string) => s.trim()).filter(Boolean);
      }
      if (values.authorization_letter) payload.authorization_letter = values.authorization_letter;
      if (values.authorization_date) payload.authorization_date = values.authorization_date.format('YYYY-MM-DD');
      if (values.planned_date_range) {
        payload.planned_start_date = values.planned_date_range[0]?.format('YYYY-MM-DD');
        payload.planned_end_date = values.planned_date_range[1]?.format('YYYY-MM-DD');
      }
      if (values.actual_date_range) {
        payload.actual_start_date = values.actual_date_range[0]?.format('YYYY-MM-DD');
        payload.actual_end_date = values.actual_date_range[1]?.format('YYYY-MM-DD');
      }
      if (values.status) payload.status = values.status;
      if (values.approval_comment) payload.approval_comment = values.approval_comment;
      if (values.version) payload.version = values.version;
      // target_units 编辑时需保留原值
      if (values.target_units) payload.target_units = values.target_units;

      if (mode === 'create') {
        await createPlan(payload);
        message.success('新建计划成功');
      } else {
        await updatePlan(planId!, payload);
        message.success('保存成功');
      }
      onSuccess();
      onClose();
      form.resetFields();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(getErrorMessage(err) || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const renderViewMode = () => (
    <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
      <Descriptions.Item label="计划名称">{planData?.name || '-'}</Descriptions.Item>
      <Descriptions.Item label="年份">{planData?.year || '-'}</Descriptions.Item>
      <Descriptions.Item label="轮次">{planData?.round_name || '-'}</Descriptions.Item>
      <Descriptions.Item label="巡察范围">{planData?.scope || '-'}</Descriptions.Item>

      <Descriptions.Item label="重点领域">
        {Array.isArray(planData?.focus_areas) ? planData.focus_areas.join('、') : (planData?.focus_areas || '-')}
      </Descriptions.Item>
      <Descriptions.Item label="授权文书">{planData?.authorization_letter || '-'}</Descriptions.Item>
      <Descriptions.Item label="授权日期">
        {planData?.authorization_date ? dayjs(planData.authorization_date).format('YYYY-MM-DD') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="计划巡察日期范围">
        {planData?.planned_start_date || planData?.planned_end_date
          ? `${planData.planned_start_date ? dayjs(planData.planned_start_date).format('YYYY-MM-DD') : '-'} ~ ${planData.planned_end_date ? dayjs(planData.planned_end_date).format('YYYY-MM-DD') : '-'}`
          : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="实际开始日期">
        {planData?.actual_start_date ? dayjs(planData.actual_start_date).format('YYYY-MM-DD') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="实际结束日期">
        {planData?.actual_end_date ? dayjs(planData.actual_end_date).format('YYYY-MM-DD') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="状态">{planData?.status || '-'}</Descriptions.Item>
      <Descriptions.Item label="审批意见">{planData?.approval_comment || '-'}</Descriptions.Item>
      <Descriptions.Item label="版本号">{planData?.version || '-'}</Descriptions.Item>
      <Descriptions.Item label="变更记录">
        {Array.isArray(planData?.version_history) && planData.version_history.length > 0
          ? planData.version_history.map((h: any, i: number) => (
              <div key={i}>{h.date ? `${h.date}：${h.change}` : h.change}</div>
            ))
          : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="创建时间">
        {planData?.created_at ? dayjs(planData.created_at).format('YYYY-MM-DD HH:mm') : '-'}
      </Descriptions.Item>
    </Descriptions>
  );

  const title = mode === 'create' ? '新建计划' : mode === 'view' ? '查看计划' : '编辑计划';

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={isView ? null : (
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>确定</Button>
        </Space>
      )}
      width={700}
    >
      {isView ? renderViewMode() : (
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="计划名称" rules={[{ required: true, message: '请输入计划名称' }]}>
            <Input placeholder="请输入计划名称" />
          </Form.Item>
          <Form.Item name="year" label="年份" rules={[{ required: true, message: '请输入年份' }]}>
            <Input type="number" placeholder="如：2026" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="round_name" label="轮次">
            <Input placeholder="如：第一轮巡察" />
          </Form.Item>
          <Form.Item name="scope" label="巡察范围">
            <Input.TextArea rows={2} placeholder="请输入巡察范围" />
          </Form.Item>
          <Form.Item name="focus_areas" label="重点领域">
            <Input.TextArea rows={2} placeholder="请输入重点领域" />
          </Form.Item>
          <Form.Item name="authorization_letter" label="授权文书">
            <Input placeholder="请输入授权文书" />
          </Form.Item>
          <Form.Item name="authorization_date" label="授权日期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择授权日期" />
          </Form.Item>
          <Form.Item name="planned_date_range" label="计划巡察日期范围">
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="actual_date_range" label="实际巡察日期范围">
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          {/* target_units 隐藏字段，编辑时保留原值 */}
          <Form.Item name="target_units" style={{ display: 'none' }}>
            <Input />
          </Form.Item>
          {mode === 'edit' && (
            <Form.Item name="approval_comment" label="审批意见">
              <Input.TextArea rows={3} placeholder="请输入审批意见" />
            </Form.Item>
          )}
        </Form>
      )}
    </Modal>
  );
};

export default PlanDetail;
