import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, Button, Space, Slider, message, Descriptions, Switch } from 'antd';
import { getUnits } from '@/api/units';
import { getClues } from '@/api/clues';
import { getDrafts } from '@/api/drafts';
import { createRectification, updateRectification, getRectification, updateProgress } from '@/api/rectifications';
import dayjs from 'dayjs';
import { getErrorMessage } from '@/utils/error';

const { TextArea } = Input;

const ALERT_LEVEL_OPTIONS = [
  { label: '红色', value: 'red' },
  { label: '橙色', value: 'orange' },
  { label: '黄色', value: 'yellow' },
  { label: '蓝色', value: 'blue' },
];

const STATUS_OPTIONS = [
  { label: '待整改', value: 'pending' },
  { label: '整改中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '已验收', value: 'verified' },
];

interface RectificationModalProps {
  open: boolean;
  rectificationId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const RectificationModal: React.FC<RectificationModalProps> = ({ open, rectificationId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [form] = Form.useForm();
  const [unitOptions, setUnitOptions] = useState<{ label: string; value: string }[]>([]);
  const [clueOptions, setClueOptions] = useState<{ label: string; value: string }[]>([]);
  const [draftOptions, setDraftOptions] = useState<{ label: string; value: string }[]>([]);
  const [rectificationData, setRectificationData] = useState<any>(null);

  useEffect(() => {
    if (open) {
      fetchUnits();
      fetchClues();
      fetchDrafts();
      if (rectificationId) {
        setIsViewMode(true);
        fetchRectificationData(rectificationId);
      } else {
        setIsViewMode(false);
        setRectificationData(null);
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
      if (data.rectification_date) {
        data.rectification_date = dayjs(data.rectification_date);
      }
      if (data.completion_date) {
        data.completion_date = dayjs(data.completion_date);
      }
      setRectificationData(res);
      form.setFieldsValue(data);
    } catch {
      message.error('获取整改详情失败');
    }
  };

  const handleUpdateProgress = async () => {
    if (!rectificationId) return;
    try {
      const values = form.getFieldsValue();
      await updateProgress(rectificationId, values.progress || 0);
      message.success('进度更新成功');
    } catch (err: any) {
      message.error(getErrorMessage(err) || '进度更新失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = { ...values };
      if (payload.deadline) {
        payload.deadline = payload.deadline.format('YYYY-MM-DD');
      }
      if (payload.rectification_date) {
        payload.rectification_date = payload.rectification_date.format('YYYY-MM-DD');
      }
      if (payload.completion_date) {
        payload.completion_date = payload.completion_date.format('YYYY-MM-DD');
      }
      setLoading(true);
      if (rectificationId) {
        await updateRectification(rectificationId, payload);
        message.success('编辑整改成功');
      } else {
        await createRectification(payload);
        message.success('派发整改成功');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(getErrorMessage(err) || (rectificationId ? '编辑整改失败' : '派发整改失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const handleSwitchToEdit = () => {
    if (rectificationData) {
      const data: any = { ...rectificationData };
      if (data.deadline && typeof data.deadline === 'string') {
        data.deadline = dayjs(data.deadline);
      }
      if (data.rectification_date && typeof data.rectification_date === 'string') {
        data.rectification_date = dayjs(data.rectification_date);
      }
      if (data.completion_date && typeof data.completion_date === 'string') {
        data.completion_date = dayjs(data.completion_date);
      }
      form.setFieldsValue(data);
    }
    setIsViewMode(false);
  };

  const getUnitName = (id: string) => unitOptions.find(u => u.value === id)?.label || id;
  const getClueTitle = (id: string) => clueOptions.find(c => c.value === id)?.label || id;
  const getDraftTitle = (id: string) => draftOptions.find(d => d.value === id)?.label || id;

  const renderViewMode = () => (
    <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
      <Descriptions.Item label="标题">{rectificationData?.title || '-'}</Descriptions.Item>
      <Descriptions.Item label="被整改单位">{rectificationData?.unit_name || getUnitName(rectificationData?.unit_id) || '-'}</Descriptions.Item>
      <Descriptions.Item label="预警级别">
        {ALERT_LEVEL_OPTIONS.find(a => a.value === rectificationData?.alert_level)?.label || rectificationData?.alert_level || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="关联线索">{getClueTitle(rectificationData?.clue_id) || '-'}</Descriptions.Item>
      <Descriptions.Item label="关联底稿">{getDraftTitle(rectificationData?.draft_id) || '-'}</Descriptions.Item>
      <Descriptions.Item label="整改状态">
        {STATUS_OPTIONS.find(s => s.value === rectificationData?.status)?.label || rectificationData?.status || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="问题描述">{rectificationData?.problem_description || '-'}</Descriptions.Item>
      <Descriptions.Item label="整改要求">{rectificationData?.rectification_requirement || '-'}</Descriptions.Item>
      <Descriptions.Item label="整改日期">
        {rectificationData?.rectification_date ? dayjs(rectificationData.rectification_date).format('YYYY-MM-DD') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="截止日期">
        {rectificationData?.deadline ? dayjs(rectificationData.deadline).format('YYYY-MM-DD') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="完成日期">
        {rectificationData?.completion_date ? dayjs(rectificationData.completion_date).format('YYYY-MM-DD') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="进度">{rectificationData?.progress !== undefined ? `${rectificationData.progress}%` : '-'}</Descriptions.Item>
      <Descriptions.Item label="验收意见">{rectificationData?.verification_comment || '-'}</Descriptions.Item>
    </Descriptions>
  );

  return (
    <Modal
      title={rectificationId ? '整改详情' : '派发整改'}
      open={open}
      onCancel={handleCancel}
      width={700}
      footer={null}
    >
      {rectificationId && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Switch
            checkedChildren="编辑模式"
            unCheckedChildren="查看模式"
            checked={!isViewMode}
            onChange={(v) => v ? handleSwitchToEdit() : setIsViewMode(true)}
          />
        </div>
      )}
      {rectificationId && isViewMode ? renderViewMode() : (
        <Form form={form} layout="vertical" style={{ marginTop: rectificationId ? 0 : 0 }}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入标题" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="unit_id" label="被整改单位" rules={[{ required: true, message: '请选择被整改单位' }]}>
              <Select options={unitOptions} placeholder="请选择被整改单位" allowClear showSearch />
            </Form.Item>
            <Form.Item name="alert_level" label="预警级别">
              <Select options={ALERT_LEVEL_OPTIONS} placeholder="请选择预警级别" allowClear />
            </Form.Item>
          </div>

          <Form.Item name="clue_id" label="关联线索">
            <Select options={clueOptions} placeholder="请选择关联线索" allowClear showSearch />
          </Form.Item>

          <Form.Item name="draft_id" label="关联底稿">
            <Select options={draftOptions} placeholder="请选择关联底稿" allowClear showSearch />
          </Form.Item>

          <Form.Item name="status" label="整改状态">
            <Select options={STATUS_OPTIONS} placeholder="请选择整改状态" allowClear />
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item name="rectification_date" label="整改日期">
              <DatePicker style={{ width: '100%' }} placeholder="请选择整改日期" />
            </Form.Item>
            <Form.Item name="deadline" label="截止日期">
              <DatePicker style={{ width: '100%' }} placeholder="请选择截止日期" />
            </Form.Item>
            <Form.Item name="completion_date" label="完成日期">
              <DatePicker style={{ width: '100%' }} placeholder="请选择完成日期" />
            </Form.Item>
          </div>

          <Form.Item name="progress" label="进度">
            <Slider min={0} max={100} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
          </Form.Item>

          <Form.Item name="verification_comment" label="验收意见">
            <TextArea rows={3} placeholder="请输入验收意见" />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <Space>
              <Button onClick={handleCancel}>取消</Button>
              {rectificationId && !isViewMode && (
                <Button onClick={handleUpdateProgress}>更新进度</Button>
              )}
              <Button type="primary" onClick={handleSubmit} loading={loading}>
                {rectificationId ? '保存' : '派发'}
              </Button>
            </Space>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default RectificationModal;
