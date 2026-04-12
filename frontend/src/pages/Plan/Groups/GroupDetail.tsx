import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Button, Space, Table, Tag, message } from 'antd';
import { createGroup, updateGroup, getGroup } from '@/api/groups';
import { getPlans } from '@/api/plans';
import { getUnits } from '@/api/units';
import { getGroupMembers, removeMember } from '@/api/groups';

interface GroupDetailProps {
  open: boolean;
  editingId?: string | null;
  mode: 'create' | 'view' | 'edit';
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

const GroupDetail: React.FC<GroupDetailProps> = ({ open, editingId, mode, onCancel, onSuccess }) => {
  const [form] = Form.useForm<GroupFormData>();
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [, setGroupData] = useState<any>(null);

  const isEdit = mode === 'edit';
  const isView = mode === 'view';
  const isCreate = mode === 'create';

  useEffect(() => {
    if (open) {
      loadOptions();
      if (mode === 'view' || mode === 'edit') {
        loadGroupData(editingId!);
        loadGroupMembers(editingId!);
      } else {
        form.resetFields();
        setMembers([]);
        setGroupData(null);
      }
    }
  }, [open, mode, editingId]);

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
      setGroupData(res);
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

  const loadGroupMembers = async (id: string) => {
    try {
      const res = await getGroupMembers(id);
      setMembers(Array.isArray(res) ? res : res.items || []);
    } catch (e) {
      console.error('Failed to load members', e);
    }
  };

  const handleRemoveMember = async (cadreId: string) => {
    if (!editingId) return;
    try {
      await removeMember(editingId, cadreId);
      message.success('移除成功');
      loadGroupMembers(editingId);
    } catch (e: any) {
      message.error(e.response?.data?.detail || '移除失败');
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

  const roleColors: Record<string, string> = {
    '组长': 'red',
    '副组长': 'orange',
    '联络员': 'blue',
    '组员': 'green',
    '专项负责人': 'purple',
  };

  const memberColumns = [
    { title: '姓名', dataIndex: 'cadre_name', key: 'cadre_name' },
    { title: '角色', dataIndex: 'role', key: 'role', render: (r: string) => <Tag color={roleColors[r] || 'default'}>{r}</Tag> },
    { title: '单位', dataIndex: 'unit_name', key: 'unit_name' },
    { title: '操作', key: 'action', render: (_: any, record: any) => (
      <Button type="link" danger size="small" onClick={() => handleRemoveMember(record.cadre_id)}>移除</Button>
    )},
  ];

  const modalTitle = isCreate ? '新建巡察组' : isView ? '查看巡察组' : '编辑巡察组';

  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={onCancel}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onCancel}>关闭</Button>
            {isCreate && (
              <Button type="primary" onClick={handleSubmit} disabled={initialLoading || submitLoading} loading={submitLoading}>
                新建
              </Button>
            )}
          </Space>
        </div>
      }
      destroyOnHidden
      width={700}
    >
      <Form form={form} layout="vertical" disabled={initialLoading || isView}>
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

      {(isEdit || isView) && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>巡察组成员</div>
          <Table
            columns={memberColumns}
            dataSource={members}
            rowKey="id"
            size="small"
            pagination={false}
          />
        </div>
      )}
    </Modal>
  );
};

export default GroupDetail;
