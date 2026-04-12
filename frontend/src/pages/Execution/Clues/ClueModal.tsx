import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, Space, Button, DatePicker, message } from 'antd';
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

const ClueModal: React.FC<ClueModalProps> = ({ open, clueId, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(false);

  useEffect(() => {
    if (open && clueId) {
      setFetching(true);
      getClue(clueId)
        .then((res: any) => {
          const data = { ...res };
          if (data.transfer_date) {
            data.transfer_date = dayjs(data.transfer_date);
          }
          form.setFieldsValue(data);
        })
        .catch(console.error)
        .finally(() => setFetching(false));
    } else if (open && !clueId) {
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

  return (
    <Modal
      title={clueId ? '查看线索' : '登记线索'}
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading || fetching}>
            {clueId ? '保存' : '创建'}
          </Button>
        </Space>
      }
      width={700}
    >
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
      </Form>
    </Modal>
  );
};

export default ClueModal;
