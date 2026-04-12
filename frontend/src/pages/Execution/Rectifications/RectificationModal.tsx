import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, Button, Space, message } from 'antd';
import { getUnits } from '@/api/units';
import { getClues } from '@/api/clues';
import { getDrafts } from '@/api/drafts';
import { createRectification, updateRectification, getRectification } from '@/api/rectifications';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface RectificationModalProps {
  open: boolean;
  rectificationId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const RectificationModal: React.FC<RectificationModalProps> = ({ open, rectificationId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [unitOptions, setUnitOptions] = useState<{ label: string; value: string }[]>([]);
  const [clueOptions, setClueOptions] = useState<{ label: string; value: string }[]>([]);
  const [draftOptions, setDraftOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetchUnits();
      fetchClues();
      fetchDrafts();
      if (rectificationId) {
        fetchRectificationData(rectificationId);
      } else {
        form.resetFields();
      }
    }
  }, [open, rectificationId]);

  const fetchUnits = async () => {
    try {
      const res = await getUnits({ page: 1, page_size: 100 });
      const units = res.items || [];
      setUnitOptions(units.map((u: any) => ({ label: u.name, value: u.id })));
    } catch {
      message.error('获取单位失败');
    }
  };

  const fetchClues = async () => {
    try {
      const res = await getClues({ page: 1, page_size: 100 });
      const clues = res.items || [];
      setClueOptions(clues.map((c: any) => ({ label: c.title, value: c.id })));
    } catch {
      message.error('获取线索失败');
    }
  };

  const fetchDrafts = async () => {
    try {
      const res = await getDrafts({ page: 1, page_size: 100 });
      const drafts = res.items || [];
      setDraftOptions(drafts.map((d: any) => ({ label: d.title, value: d.id })));
    } catch {
      message.error('获取底稿失败');
    }
  };

  const fetchRectificationData = async (id: string) => {
    try {
      const res = await getRectification(id);
      const data = res;
      if (data.deadline) {
        data.deadline = dayjs(data.deadline);
      }
      form.setFieldsValue(data);
    } catch {
      message.error('获取整改详情失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (values.deadline) {
        values.deadline = values.deadline.format('YYYY-MM-DD');
      }
      setLoading(true);
      if (rectificationId) {
        await updateRectification(rectificationId, values);
        message.success('编辑整改成功');
      } else {
        await createRectification(values);
        message.success('派发整改成功');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.detail || (rectificationId ? '编辑整改失败' : '派发整改失败'));
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
      title={rectificationId ? '查看/编辑整改' : '派发整改'}
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={600}
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
          name="unit_id"
          label="被整改单位"
          rules={[{ required: true, message: '请选择被整改单位' }]}
        >
          <Select options={unitOptions} placeholder="请选择被整改单位" allowClear showSearch />
        </Form.Item>

        <Form.Item name="clue_id" label="关联线索">
          <Select options={clueOptions} placeholder="请选择关联线索" allowClear showSearch />
        </Form.Item>

        <Form.Item name="draft_id" label="关联底稿">
          <Select options={draftOptions} placeholder="请选择关联底稿" allowClear showSearch />
        </Form.Item>

        <Form.Item
          name="problem_description"
          label="问题描述"
          rules={[{ required: true, message: '请输入问题描述' }]}
        >
          <TextArea rows={4} placeholder="请输入问题描述" />
        </Form.Item>

        <Form.Item name="rectification_requirement" label="整改要求">
          <TextArea rows={4} placeholder="请输入整改要求" />
        </Form.Item>

        <Form.Item name="deadline" label="截止日期">
          <DatePicker style={{ width: '100%' }} placeholder="请选择截止日期" />
        </Form.Item>

        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Space>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              {rectificationId ? '保存' : '派发'}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default RectificationModal;
