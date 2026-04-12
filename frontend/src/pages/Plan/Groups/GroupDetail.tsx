import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Button, Space, message } from 'antd';
import { createGroup, updateGroup, getGroup } from '@/api/groups';
import { getPlans } from '@/api/plans';
import { getUnits } from '@/api/units';

interface GroupDetailProps {
  open: boolean;
  editingId?: string | null;
  onCancel: () => void;
  onSuccess: () => void;
}

interface PlanOption {
  label: string;
  value: string;
}

interface UnitOption {
  label: string;
  value: string;
}

interface GroupFormData {
  name: string;
  plan_id: string;
  target_unit_id?: string;
  status?: string;
}

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已审批', value: 'approved' },
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' },
];

const GroupDetail: React.FC<GroupDetailProps> = ({ open, editingId, onCancel, onSuccess }) => {
  const [form] = Form.useForm<GroupFormData>();
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);

  const isEdit = !!editingId;

  useEffect(() => {
    if (open) {
      loadOptions();
      if (editingId) {
        loadGroupData(editingId);
      } else {
        form.resetFields();
      }
    }
  }, [open, editingId]);

  const loadOptions = async () => {
    setLoading(true);
    try {
      const [plansRes, unitsRes] = await Promise.all([
        getPlans({ page_size: 100 }),
        getUnits({ page_size: 100 }),
      ]);
      setPlanOptions(
        (plansRes.items || []).map((p: any) => ({
          label: p.name,
          value: p.id,
        }))
      );
      setUnitOptions(
        (unitsRes.items || []).map((u: any) => ({
          label: u.name,
          value: u.id,
        }))
      );
    } catch (e) {
      console.error('Failed to load options', e);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupData = async (id: string) => {
    setInitialLoading(true);
    try {
      const res = await getGroup(id);
      form.setFieldsValue({
        name: res.name,
        plan_id: res.plan_id,
        target_unit_id: res.target_unit_id,
        status: res.status,
      });
    } catch (e) {
      message.error('加载巡察组详情失败');
      onCancel();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);
      if (isEdit) {
        await updateGroup(editingId!, values);
        message.success('更新巡察组成功');
      } else {
        await createGroup(values);
        message.success('新建巡察组成功');
      }
      onSuccess();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.detail || (isEdit ? '更新失败' : '新建失败'));
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Modal
      title={isEdit ? '查看巡察组' : '新建巡察组'}
      open={open}
      onCancel={onCancel}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" onClick={handleSubmit} disabled={initialLoading || submitLoading} loading={submitLoading}>
              {isEdit ? '保存' : '新建'}
            </Button>
          </Space>
        </div>
      }
      destroyOnHidden
    >
      <Form form={form} layout="vertical" disabled={initialLoading}>
        <Form.Item
          name="name"
          label="巡察组名称"
          rules={[{ required: true, message: '请输入巡察组名称' }]}
        >
          <Input placeholder="请输入巡察组名称" />
        </Form.Item>
        <Form.Item
          name="plan_id"
          label="巡察计划"
          rules={[{ required: true, message: '请选择巡察计划' }]}
        >
          <Select
            placeholder="请选择巡察计划"
            options={planOptions}
            loading={loading}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item name="target_unit_id" label="被巡察单位">
          <Select
            placeholder="请选择被巡察单位"
            options={unitOptions}
            loading={loading}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            allowClear
          />
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select placeholder="请选择状态" options={STATUS_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default GroupDetail;
