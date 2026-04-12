import React, { useState, useEffect } from 'react';
import { Modal, Form, Select } from 'antd';
import { getCadres } from '@/api/cadres';
import { addMember } from '@/api/groups';

interface GroupMemberModalProps {
  open: boolean;
  groupId: string;
  groupName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_OPTIONS = [
  { label: '组长', value: '组长' },
  { label: '副组长', value: '副组长' },
  { label: '联络员', value: '联络员' },
  { label: '组员', value: '组员' },
  { label: '专项负责人', value: '专项负责人' },
];

const GroupMemberModal: React.FC<GroupMemberModalProps> = ({
  open, groupId, groupName, onClose, onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [cadreOptions, setCadreOptions] = useState<{ label: string; value: string }[]>([]);
  const [form] = Form.useForm();
  useEffect(() => {
    if (open) {
      getCadres({ page: 1, page_size: 100 })
        .then((res: any) => {
          const cadres = res.items || [];
          setCadreOptions(
            cadres.map((c: any) => ({
              label: `${c.name}${c.position ? ` (${c.position})` : ''}`,
              value: c.id,
            }))
          );
        })
        .catch(() => { /* ignore errors */ });

    }
  }, [open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await addMember(groupId, values.cadre_id, values.role);
      form.resetFields();
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.errorFields) return;
      // silently fail - list refresh on next open will reflect true state
      setLoading(false);
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
      title={`添加成员 - ${groupName}`}
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={480}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="cadre_id"
          label="选择干部"
          rules={[{ required: true, message: '请选择干部' }]}
        >
          <Select
            showSearch
            placeholder="请搜索并选择干部"
            options={cadreOptions}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          name="role"
          label="担任角色"
          rules={[{ required: true, message: '请选择角色' }]}
          initialValue="组员"
        >
          <Select placeholder="请选择角色" options={ROLE_OPTIONS} />
        </Form.Item>

        <div style={{ textAlign: 'right', marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{ padding: '4px 16px', borderRadius: 6, border: '1px solid #d9d9d9', background: '#fff', cursor: 'pointer', marginRight: 8 }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background: '#1677ff',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '4px 16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '添加中...' : '添加'}
          </button>
        </div>
      </Form>
    </Modal>
  );
};

export default GroupMemberModal;
