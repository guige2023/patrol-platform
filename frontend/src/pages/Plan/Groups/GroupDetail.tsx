import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Button, Space, Table, Tag, message, Popconfirm } from 'antd';
import { createGroup, updateGroup, getGroup } from '@/api/groups';
import { getPlans } from '@/api/plans';
import { getUnits } from '@/api/units';
import { removeMember, addMember } from '@/api/groups';
import { getCadres } from '@/api/cadres';
import { getErrorMessage } from '@/utils/error';

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-ignore - kept for future use (authorization_letter, authorization_date)
  const [groupData, setGroupData] = useState<any>(null);
  const [cadreOptions, setCadreOptions] = useState<any[]>([]);
  const [replaceModal, setReplaceModal] = useState<{ visible: boolean; memberId: string; role: string } | null>(null);

  const isEdit = mode === 'edit';
  const isView = mode === 'view';
  const isCreate = mode === 'create';

  useEffect(() => {
    if (open) {
      loadOptions();
      loadCadreOptions();
      if (mode === 'view' || mode === 'edit') {
        loadGroupData(editingId!);
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
    }
  };

  const loadCadreOptions = async () => {
    try {
      const res = await getCadres({ page_size: 500 });
      const items = res.items || res.data?.items || [];
      setCadreOptions(items);
    } catch (e) {
      console.error('Failed to load cadres', e);
    }
  };

  const loadGroupData = async (id: string) => {
    setInitialLoading(true);
    try {
      const res = await getGroup(id);
      setGroupData(res);
      setMembers(res.members || []);
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

  const handleReplaceMember = async (newCadreId: string) => {
    if (!replaceModal || !editingId) return;
    try {
      await removeMember(editingId, replaceModal.memberId);
      await addMember(editingId, newCadreId, replaceModal.role);
      const newCadre = cadreOptions.find((c) => c.id === newCadreId);
      setMembers((prev) =>
        prev.map((m) =>
          m.cadre_id === replaceModal.memberId
            ? { ...m, cadre_id: newCadreId, cadre_name: newCadre?.name || newCadreId }
            : m
        )
      );
      message.success('成员已更换');
      setReplaceModal(null);
    } catch {
      message.error('更换失败');
    }
  };

  const handleRemoveMember = async (cadreId: string) => {
    if (!editingId) return;
    try {
      await removeMember(editingId, cadreId);
      message.success('移除成功');
      loadGroupData(editingId);
    } catch (e: any) {
      message.error(getErrorMessage(e) || '移除失败');
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
      message.error(getErrorMessage(err) || (isEdit ? '更新失败' : '新建失败'));
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
    { title: '操作', key: 'action', render: (_: any, record: any) => (
      <Space size="small">
        <Button type="link" size="small" onClick={() => setReplaceModal({ visible: true, memberId: record.cadre_id, role: record.role })}>更换</Button>
        <Popconfirm title="确认移除该成员？" onConfirm={() => handleRemoveMember(record.cadre_id)}>
          <Button type="link" danger size="small">移除</Button>
        </Popconfirm>
      </Space>
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
          <div style={{ fontWeight: 500, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>巡察组成员（{members.length}人）</span>
            {isEdit && (
              <Button
                size="small"
                type="primary"
                onClick={() => setReplaceModal({ visible: true, memberId: '', role: '组员' })}
              >
                添加成员
              </Button>
            )}
          </div>
          <Table
            columns={memberColumns}
            dataSource={members}
            rowKey="id"
            size="small"
            pagination={false}
          />
        </div>
      )}

      {/* Replace/Add Member Modal */}
      <Modal
        title={replaceModal?.memberId ? '更换成员' : '添加成员'}
        destroyOnClose
        open={!!replaceModal}
        onCancel={() => setReplaceModal(null)}
        footer={null}
        width={400}
      >
        <Form layout="vertical" onFinish={async (values) => {
          if (replaceModal?.memberId) {
            await handleReplaceMember(values.cadre_id);
          } else {
            // Add new member
            if (!editingId) return;
            const { addMember: addM } = await import('@/api/groups');
            await addM(editingId, values.cadre_id, values.role || '组员');
            message.success('成员已添加');
            loadGroupData(editingId);
            setReplaceModal(null);
          }
        }}>
          <Form.Item
            name="cadre_id"
            label="选择人员"
            rules={[{ required: true, message: '请选择人员' }]}
          >
            <Select
              placeholder="搜索人员姓名"
              showSearch
              options={cadreOptions.map(c => ({ label: `${c.name} (${c.category || '未分类'})`, value: c.id }))}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue={replaceModal?.memberId ? replaceModal.role : '组员'}>
            <Select options={[
              { label: '组长', value: '组长' },
              { label: '副组长', value: '副组长' },
              { label: '组员', value: '组员' },
              { label: '专项负责人', value: '专项负责人' },
            ]} />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setReplaceModal(null)}>取消</Button>
              <Button type="primary" htmlType="submit">确认</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </Modal>
  );
};

export default GroupDetail;
