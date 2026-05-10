import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Switch, Checkbox, message, Space } from 'antd';
import { createRole, updateRole } from '@/api/admin';
import { getErrorMessage } from '@/utils/error';

interface Role {
  id?: string;
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
  permissions?: string[];
}

// Predefined permission options for display
const PERMISSION_OPTIONS: { code: string; name: string }[] = [
  // 用户/角色/审计
  { code: 'user:read', name: '查看用户' },
  { code: 'user:write', name: '管理用户' },
  { code: 'role:read', name: '查看角色' },
  { code: 'role:write', name: '管理角色' },
  { code: 'audit:read', name: '查看审计日志' },
  // 单位
  { code: 'unit:read', name: '查看单位' },
  { code: 'unit:write', name: '管理单位' },
  { code: 'unit:approve', name: '审批单位' },
  // 干部
  { code: 'cadre:read', name: '查看干部' },
  { code: 'cadre:write', name: '管理干部' },
  { code: 'cadre:approve', name: '审批干部' },
  // 线索
  { code: 'clue:read', name: '查看线索' },
  { code: 'clue:write', name: '管理线索' },
  { code: 'clue:approve', name: '审批线索' },
  // 巡察计划
  { code: 'plan:read', name: '查看计划' },
  { code: 'plan:write', name: '管理计划' },
  { code: 'plan:approve', name: '审批计划' },
  // 底稿
  { code: 'draft:read', name: '查看底稿' },
  { code: 'draft:write', name: '管理底稿（提交）' },
  { code: 'draft:approve', name: '审批底稿（初审/终审/驳回）' },
  // 整改
  { code: 'rectification:read', name: '查看整改' },
  { code: 'rectification:write', name: '管理整改（签收/提交）' },
  { code: 'rectification:approve', name: '审批整改（验收/确认/驳回）' },
  // 知识库
  { code: 'knowledge:read', name: '查看知识库' },
  { code: 'knowledge:write', name: '管理知识库' },
];

interface RoleModalProps {
  open: boolean;
  role: Role | null;
  onClose: () => void;
  onSuccess: () => void;
}

const RoleModal: React.FC<RoleModalProps> = ({ open, role, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      if (role) {
        const perms = role.permissions || [];
        form.setFieldsValue({
          name: role.name,
          code: role.code,
          description: role.description,
          is_active: role.is_active,
          permissions: perms,
        });
        setSelectedPerms(perms);
      } else {
        form.resetFields();
        form.setFieldsValue({ is_active: true, permissions: [] });
        setSelectedPerms([]);
      }
    }
  }, [open, role]);

  // Handle "全部权限" checkbox
  const handleAllPermsChange = (checked: boolean) => {
    if (checked) {
      setSelectedPerms(['*']);
      form.setFieldsValue({ permissions: ['*'] });
    } else {
      setSelectedPerms([]);
      form.setFieldsValue({ permissions: [] });
    }
  };

  // Handle individual permission checkbox
  const handlePermChange = (checkedValues: string[]) => {
    // If user checks "全部权限" (*), keep it; otherwise filter it out
    const filtered = checkedValues.includes('*')
      ? ['*']
      : checkedValues.filter(v => v !== '*');
    setSelectedPerms(filtered);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      if (role?.id) {
        await updateRole(role.id, values);
        message.success('更新成功');
      } else {
        await createRole(values);
        message.success('创建成功');
      }
      onClose();
      onSuccess();
    } catch (e: any) {
      if (!e.errorFields) {
        message.error(getErrorMessage(e) || (role?.id ? '更新失败' : '创建失败'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={role?.id ? '编辑角色' : '新建角色'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={520}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
          <Input placeholder="如：超级管理员" />
        </Form.Item>
        <Form.Item
          name="code"
          label="角色编码"
          rules={[
            { required: true, message: '请输入角色编码' },
            { pattern: /^[a-z_0-9]+$/, message: '只能输入小写字母、下划线、数字' },
          ]}
          extra={role?.id ? undefined : '编码一旦创建不可修改'}
        >
          <Input placeholder="如：super_admin" disabled={!!role?.id} />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="角色描述（可选）" />
        </Form.Item>
        <Form.Item name="is_active" label="启用状态" valuePropName="checked" initialValue={true}>
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>
        <Form.Item label="权限" name="permissions">
          <Space direction="vertical" size={[4, 4]} style={{ width: '100%' }}>
            {/*
              全部权限：独立Checkbox，不在CheckGroup内
              勾选时 selectedPerms=['*']；取消时清空
            */}
            <Checkbox
              checked={selectedPerms.includes('*')}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedPerms(['*']);
                  form.setFieldsValue({ permissions: ['*'] });
                } else {
                  setSelectedPerms([]);
                  form.setFieldsValue({ permissions: [] });
                }
              }}
            >
              全部权限
            </Checkbox>
            {/*
              细粒度权限：独立Checkbox（不用CheckGroup）
              checked 状态由 selectedPerms 决定，不受 Group 控制
            */}
            {PERMISSION_OPTIONS.map(opt => (
              <Checkbox
                key={opt.code}
                checked={selectedPerms.includes('*') || selectedPerms.includes(opt.code)}
                onChange={(e) => {
                  if (selectedPerms.includes('*')) {
                    // 全部权限模式下，取消单个权限
                    const newPerms = [opt.code];
                    setSelectedPerms(newPerms);
                    form.setFieldsValue({ permissions: newPerms });
                  } else {
                    handlePermChange(
                      e.target.checked
                        ? [...selectedPerms, opt.code]
                        : selectedPerms.filter(v => v !== opt.code)
                    );
                  }
                }}
              >
                {opt.name} <span style={{ color: '#999', fontSize: 12 }}>({opt.code})</span>
              </Checkbox>
            ))}
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RoleModal;
