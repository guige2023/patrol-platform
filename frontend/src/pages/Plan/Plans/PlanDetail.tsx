import React, { useEffect, useRef } from 'react';
import { Form, Input, Button, Space, Modal, message } from 'antd';
import { getPlan, createPlan, updatePlan } from '@/api/plans';

interface PlanDetailProps {
  open: boolean;
  planId?: string | null;
  mode: 'create' | 'view' | 'edit';
  onClose: () => void;
  onSuccess: () => void;
}

const PlanDetail: React.FC<PlanDetailProps> = ({ open, planId, mode, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const isSettingValues = useRef(false);

  // When modal opens in create mode, set default year
  useEffect(() => {
    if (open && mode === 'create') {
      isSettingValues.current = true;
      form.setFieldsValue({ year: new Date().getFullYear() });
      isSettingValues.current = false;
    }
  }, [open, mode]);

  // Load existing plan for edit/view
  useEffect(() => {
    if (open && planId && (mode === 'edit' || mode === 'view')) {
      isSettingValues.current = true;
      getPlan(planId).then((res: any) => {
        const data = res.data;
        if (data.planned_start_date || data.planned_end_date) {
          data.planned_date_range = [
            data.planned_start_date ? new Date(data.planned_start_date) : null,
            data.planned_end_date ? new Date(data.planned_end_date) : null,
          ];
        }
        form.setFieldsValue(data);
        isSettingValues.current = false;
      }).catch(() => {
        isSettingValues.current = false;
      });
    }
  }, [open, planId, mode]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Build payload - only include fields that exist
      const payload: any = {
        name: values.name,
        year: values.year,
      };
      if (values.round_name) payload.round_name = values.round_name;
      if (values.scope) payload.scope = values.scope;

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
      if (err.errorFields) {
        console.log('Validation:', err.errorFields.map((f: any) => f.errors.join(', ')).join('; '));
        return;
      }
      message.error(err.response?.data?.detail || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const isView = mode === 'view';
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
      width={600}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="计划名称" rules={[{ required: true, message: '请输入计划名称' }]}>
          <Input placeholder="请输入计划名称" disabled={isView} />
        </Form.Item>

        <Form.Item name="year" label="年份" rules={[{ required: true, message: '请输入年份' }]}>
          <Input type="number" placeholder="如：2026" disabled={isView} style={{ width: 200 }} />
        </Form.Item>

        <Form.Item name="round_name" label="轮次">
          <Input placeholder="如：第一轮巡察" disabled={isView} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PlanDetail;
