import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, Space, Button, message } from 'antd';
import { createClue, updateClue, getClue } from '@/api/clues';

interface ClueModalProps {
  open: boolean;
  clueId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ClueModal: React.FC<ClueModalProps> = ({ open, clueId, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(false);

  useEffect(() => {
    if (open && clueId) {
      setFetching(true);
      getClue(clueId)
        .then((res: any) => {
          form.setFieldsValue(res);
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
      setLoading(true);
      if (clueId) {
        await updateClue(clueId, values);
        message.success('更新成功');
      } else {
        await createClue(values);
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
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="请输入标题" />
        </Form.Item>
        <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
          <Input.TextArea placeholder="请输入内容" rows={4} />
        </Form.Item>
        <Form.Item name="source" label="来源">
          <Input placeholder="请输入来源" />
        </Form.Item>
        <Form.Item name="source_detail" label="来源详情">
          <Input placeholder="请输入来源详情" />
        </Form.Item>
        <Form.Item name="category" label="类别">
          <Input placeholder="请输入类别" />
        </Form.Item>
        <Form.Item name="severity" label="严重程度">
          <Select placeholder="请选择严重程度">
            <Select.Option value="low">低</Select.Option>
            <Select.Option value="medium">中</Select.Option>
            <Select.Option value="high">高</Select.Option>
            <Select.Option value="critical">严重</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="is_high_confidential" label="高度机密" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ClueModal;
