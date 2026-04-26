import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, message, Input } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import RoleModal from './RoleModal';
import { getRoles, deleteRole } from '@/api/admin';
import { getErrorMessage } from '@/utils/error';

interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  permissions: string[];
  created_at: string;
}

const PERMISSION_LABELS: Record<string, string> = {
  '*': '全部权限',
  'user:read': '查看用户',
  'user:write': '管理用户',
  'unit:read': '查看单位',
  'unit:write': '管理单位',
  'cadre:read': '查看干部',
  'cadre:write': '管理干部',
  'clue:read': '查看线索',
  'clue:write': '管理线索',
  'plan:read': '查看计划',
  'plan:write': '管理计划',
  'draft:read': '查看底稿',
  'draft:write': '管理底稿',
  'rectification:read': '查看整改',
  'rectification:write': '管理整改',
  'knowledge:read': '查看知识库',
  'knowledge:write': '管理知识库',
  'audit:read': '查看审计日志',
  'role:read': '查看角色',
  'role:write': '管理角色',
};

const RoleList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Role[]>([]);
  const [filteredData, setFilteredData] = useState<Role[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [searchText, setSearchText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getRoles();
      const roles = Array.isArray(res) ? res : res.data || [];
      setData(roles);
      setFilteredData(roles);
    } catch (e: any) {
      message.error(getErrorMessage(e) || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchText) {
      const filtered = data.filter(r =>
        r.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        r.code?.toLowerCase().includes(searchText.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(data);
    }
  }, [searchText, data]);

  useEffect(() => { fetchData(); }, []);

  const handleEdit = (record: Role) => {
    setEditingRole(record);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRole(id);
      message.success('删除成功');
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '删除失败');
    }
  };

  const columns = [
    { title: '角色名称', dataIndex: 'name', key: 'name' },
    { title: '角色编码', dataIndex: 'code', key: 'code' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (v: boolean) => <span style={{ color: v ? '#52c41a' : '#ff4d4f' }}>{v ? '启用' : '禁用'}</span>,
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (perms: string[]) => (
        <Space wrap size={[4, 4]}>
          {(perms || []).map(p => (
            <Tag key={p} color={p === '*' ? 'red' : 'blue'}>
              {PERMISSION_LABELS[p] || p}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Role) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="角色管理" breadcrumbs={[{ name: '系统管理' }, { name: '角色管理' }]} />
      <div style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索角色名称/编码/描述"
          onSearch={(value) => setSearchText(value)}
          style={{ width: 200, marginRight: 8 }}
          allowClear
          enterButton={<Button icon={<SearchOutlined />}>搜索</Button>}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditingRole(null); setModalOpen(true); }}
        >
          新建角色
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="id"
        loading={loading}
        pagination={false}
      />
      <RoleModal
        open={modalOpen}
        role={editingRole}
        onClose={() => { setModalOpen(false); setEditingRole(null); }}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default RoleList;
