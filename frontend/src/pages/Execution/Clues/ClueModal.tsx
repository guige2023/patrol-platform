import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Switch, Space, Button, DatePicker, message, Descriptions } from 'antd';
import { createClue, updateClue, getClue } from '@/api/clues';
import dayjs from 'dayjs';

interface ClueModalProps {
  open: boolean;
  clueId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  { label: '已登记', value: 'registered' },
  { label: '已移交', value: 'transferred' },
  { label: '已处置', value: 'processed' },
  { label: '已关闭', value: 'closed' },
];

const SEVERITY_OPTIONS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

const ClueModal: React.FC<ClueModalProps> = ({ open, clueId, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [clueData, setClueData] = useState<any>(null);

  useEffect(() => {
    if (open && clueId) {
      setIsViewMode(true);
      setClueData(null);
      getClue(clueId)
        .then((res: any) => {
          const data = { ...res };
          if (data.transfer_date) {
            data.transfer_date = dayjs(data.transfer_date);
          }
          setClueData(res);
          form.setFieldsValue(data);
        })
        .catch(console.error);
    } else if (open && !clueId) {
      setIsViewMode(false);
      setClueData(null);
      form.resetFields();
    }
  }, [open, clueId]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = { ...values };
      if (payload.transfer_date) {
        payload.transfer_date = payload.transfer_date.format('YYYY-MM-DD');
      }
      setLoading(true);
      if (clueId) {
        await updateClue(clueId, payload);
        message.success('更新成功');
      } else {
        await createClue(payload);
        message.success('创建成功');
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      if (!e.errorFields) {
        message.error(e.response?.data?.detail || '操作失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToEdit = () => {
    if (clueData) {
      const data: any = { ...clueData };
      if (data.transfer_date && typeof data.transfer_date === 'string') {
        data.transfer_date = dayjs(data.transfer_date);
      }
      form.setFieldsValue(data);
    }
    setIsViewMode(false);
  };

  const renderViewMode = () => (
    <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
      <Descriptions.Item label="标题">{clueData?.title || '-'}</Descriptions.Item>
      <Descriptions.Item label="线索类型">{clueData?.clue_type || '-'}</Descriptions.Item>
      <Descriptions.Item label="状态">{STATUS_OPTIONS.find(s => s.value === clueData?.status)?.label || clueData?.status || '-'}</Descriptions.Item>
      <Descriptions.Item label="内容">{clueData?.content || '-'}</Descriptions.Item>
      <Descriptions.Item label="来源">{clueData?.source || '-'}</Descriptions.Item>
      <Descriptions.Item label="类别">{clueData?.category || '-'}</Descriptions.Item>
      <Descriptions.Item label="接收单位">{clueData?.receive_unit || '-'}</Descriptions.Item>
      <Descriptions.Item label="联系人">{clueData?.contact || '-'}</Descriptions.Item>
      <Descriptions.Item label="联系电话">{clueData?.contact_phone || '-'}</Descriptions.Item>
      <Descriptions.Item label="严重程度">{SEVERITY_OPTIONS[clueData?.severity] || clueData?.severity || '-'}</Descriptions.Item>
      <Descriptions.Item label="移交日期">
        {clueData?.transfer_date ? dayjs(clueData.transfer_date).format('YYYY-MM-DD') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="移交详情">{clueData?.transfer_details || '-'}</Descriptions.Item>
      <Descriptions.Item label="来源详情">{clueData?.source_detail || '-'}</Descriptions.Item>
      <Descriptions.Item label="高度机密">{clueData?.is_high_confidential ? '是' : '否'}</Descriptions.Item>
    </Descriptions>
  );

  return (
    <Modal
      title={clueId ? '线索详情' : '登记线索'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      {clueId && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Switch
            checkedChildren="编辑模式"
            unCheckedChildren="查看模式"
            checked={!isViewMode}
            onChange={(v) => v ? handleSwitchToEdit() : setIsViewMode(true)}
          />
        </div>
      )}
      {clueId && isViewMode ? renderViewMode() : (
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入标题" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="clue_type" label="线索类型">
              <Select placeholder="请选择线索类型" allowClear>
                <Select.Option value="信访举报">信访举报</Select.Option>
                <Select.Option value="上级交办">上级交办</Select.Option>
                <Select.Option value="监督检查">监督检查</Select.Option>
                <Select.Option value="审查调查">审查调查</Select.Option>
                <Select.Option value="巡视巡察">巡视巡察</Select.Option>
                <Select.Option value="其他">其他</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="status" label="状态">
              <Select options={STATUS_OPTIONS} placeholder="请选择状态" allowClear />
            </Form.Item>
          </div>

          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea placeholder="请输入内容" rows={4} />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="source" label="来源">
              <Input placeholder="请输入来源" />
            </Form.Item>
            <Form.Item name="category" label="类别">
              <Input placeholder="请输入类别" />
            </Form.Item>
          </div>

          <Form.Item name="receive_unit" label="接收单位">
            <Input placeholder="请输入接收单位" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="contact" label="联系人">
              <Input placeholder="请输入联系人" />
            </Form.Item>
            <Form.Item name="contact_phone" label="联系电话">
              <Input placeholder="请输入联系电话" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="severity" label="严重程度">
              <Select placeholder="请选择严重程度" allowClear>
                <Select.Option value="low">低</Select.Option>
                <Select.Option value="medium">中</Select.Option>
                <Select.Option value="high">高</Select.Option>
                <Select.Option value="critical">严重</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="transfer_date" label="移交日期">
              <DatePicker style={{ width: '100%' }} placeholder="请选择移交日期" />
            </Form.Item>
          </div>

          <Form.Item name="transfer_details" label="移交详情">
            <Input.TextArea rows={3} placeholder="请输入移交详情" />
          </Form.Item>

          <Form.Item name="source_detail" label="来源详情">
            <Input.TextArea rows={2} placeholder="请输入来源详情" />
          </Form.Item>

          <Form.Item name="is_high_confidential" label="高度机密" valuePropName="checked">
            <Switch />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <Space>
              <Button onClick={onClose}>取消</Button>
              <Button type="primary" onClick={handleSubmit} loading={loading}>
                {clueId ? '保存' : '创建'}
              </Button>
            </Space>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default ClueModal;
