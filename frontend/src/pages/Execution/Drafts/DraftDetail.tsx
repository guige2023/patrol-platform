import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Space, DatePicker, message } from 'antd';
import { getGroups } from '@/api/groups';
import { getUnits } from '@/api/units';
import { createDraft, updateDraft, getDraft, submitDraft } from '@/api/drafts';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface DraftDetailProps {
  open: boolean;
  editingId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}


const CATEGORY_OPTIONS = [
  { label: '官僚主义', value: '官僚主义' },
  { label: '形式主义', value: '形式主义' },
  { label: '群众纪律', value: '群众纪律' },
  { label: '廉洁纪律', value: '廉洁纪律' },
  { label: '违反中央八项规定精神', value: '违反中央八项规定精神' },
  { label: '其他', value: '其他' },
];

const SEVERITY_OPTIONS = [
  { label: '一般', value: '一般' },
  { label: '较重', value: '较重' },
  { label: '严重', value: '严重' },
];

const DraftDetail: React.FC<DraftDetailProps> = ({ open, editingId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [groupOptions, setGroupOptions] = useState<{ label: string; value: string }[]>([]);
  const [unitOptions, setUnitOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetchGroups();
      fetchUnits();
      if (editingId) {
        fetchDraftData(editingId);
      } else {
        form.resetFields();
      }
    }
  }, [open, editingId]);

  const fetchGroups = async () => {
    try {
      const res = await getGroups();
      const groups = Array.isArray(res) ? res : res || [];
      setGroupOptions(groups.map((g: any) => ({ label: g.name, value: g.id })));
    } catch {
      message.error('获取巡察组失败');
    }
  };

  const fetchUnits = async () => {
    try {
      const res = await getUnits({ page: 1, page_size: 100 });
      const units = res.items || [];
      setUnitOptions(units.map((u: any) => ({ label: u.name, value: u.id })));
    } catch {
      message.error('获取单位失败');
    }
  };

  const fetchDraftData = async (id: string) => {
    try {
      const res = await getDraft(id);
      const data = { ...res };
      if (data.investigation_start_date) {
        data.investigation_start_date = dayjs(data.investigation_start_date);
      }
      if (data.investigation_end_date) {
        data.investigation_end_date = dayjs(data.investigation_end_date);
      }
      form.setFieldsValue(data);
    } catch {
      message.error('获取底稿详情失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Format dates
      const payload: any = { ...values };
      if (payload.investigation_start_date) {
        payload.investigation_start_date = payload.investigation_start_date.format('YYYY-MM-DD');
      }
      if (payload.investigation_end_date) {
        payload.investigation_end_date = payload.investigation_end_date.format('YYYY-MM-DD');
      }

      if (editingId) {
        await updateDraft(editingId, payload);
        message.success('编辑底稿成功');
      } else {
        await createDraft(payload);
        message.success('新建底稿成功');
      }
      onSuccess();
      onClose();
      form.resetFields();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.detail || (editingId ? '编辑底稿失败' : '新建底稿失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDraft = async () => {
    if (!editingId) return;
    try {
      setLoading(true);
      await submitDraft(editingId, 'submit');
      message.success('提交成功');
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={editingId ? '查看/编辑底稿' : '新建底稿'}
      open={open}
      onCancel={handleCancel}
      width={700}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入标题' }]}
        >
          <Input placeholder="请输入标题" />
        </Form.Item>

        <Form.Item
          name="group_id"
          label="巡察组"
          rules={[{ required: true, message: '请选择巡察组' }]}
        >
          <Select options={groupOptions} placeholder="请选择巡察组" />
        </Form.Item>

        <Form.Item name="unit_id" label="被巡察单位">
          <Select options={unitOptions} placeholder="请选择被巡察单位" allowClear showSearch />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="investigation_start_date" label="调查开始日期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择开始日期" />
          </Form.Item>
          <Form.Item name="investigation_end_date" label="调查结束日期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择结束日期" />
          </Form.Item>
        </div>

        <Form.Item name="location" label="地点">
          <Input placeholder="请输入地点" />
        </Form.Item>

        <Form.Item name="category" label="类别">
          <Select options={CATEGORY_OPTIONS} placeholder="请选择类别" allowClear />
        </Form.Item>

        <Form.Item name="problem_type" label="问题类型">
          <Input placeholder="请输入问题类型" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="severity" label="严重程度">
            <Select options={SEVERITY_OPTIONS} placeholder="请选择严重程度" allowClear />
          </Form.Item>
          <Form.Item name="participants" label="参与人员">
            <Input placeholder="请输入参与人员" />
          </Form.Item>
        </div>

        <Form.Item name="content" label="内容">
          <TextArea rows={4} placeholder="请输入内容" />
        </Form.Item>

        <Form.Item name="evidence_summary" label="证据摘要">
          <TextArea rows={4} placeholder="请输入证据摘要" />
        </Form.Item>

        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Space>
            <Button onClick={handleCancel}>取消</Button>
            {editingId && (
              <Button onClick={handleSubmitDraft} loading={loading}>提交</Button>
            )}
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              {editingId ? '保存' : '创建'}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default DraftDetail;
