import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, Switch, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getUsers, createUser, updateUser } from '@/api/admin';
import { getErrorMessage } from '@/utils/error';

const UserList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getUsers();
      setData(Array.isArray(res) ? res : res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, values);
        message.success('更新成功');
      } else {
        await createUser(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || (editingUser ? '更新失败' : '创建失败'));
    }
  };

  const handleEdit = (record: any) => {
    setEditingUser(record);
    form.setFieldsValue({
      ...record,
      is_active: record.is_active,
    });
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingUser(null);
    form.resetFields();
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '姓名', dataIndex: 'full_name', key: 'full_name' },
    { title: '状态', dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => <span style={{ color: v ? '#52c41a' : '#ff4d4f' }}>{v ? '启用' : '禁用'}</span> },
    { title: '操作', key: 'action', render: (_: any, record: any) => <Space><Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button></Space> },
  ];

  return (
    <div>
      <PageHeader title="用户管理" breadcrumbs={[{ name: '系统管理' }, { name: '用户管理' }]} />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>新建用户</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />
      <Modal title={editingUser ? '编辑用户' : '新建用户'} open={modalVisible} onCancel={handleModalClose} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input disabled={!!editingUser} />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="密码" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="full_name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select placeholder="请选择角色" allowClear>
              <Select.Option value="管理员">管理员</Select.Option>
              <Select.Option value="操作员">操作员</Select.Option>
              <Select.Option value="数据员">数据员</Select.Option>
              <Select.Option value="审核员">审核员</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>{editingUser ? '更新' : '创建'}</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default UserList;
