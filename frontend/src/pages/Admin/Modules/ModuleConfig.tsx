import React, { useState, useEffect } from 'react';
import { Table, Switch, message } from 'antd';
import PageHeader from '@/components/common/PageHeader';
import { getModules, updateModule } from '@/api/admin';

const ModuleConfig: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getModules();
      setData(Array.isArray(res) ? res : res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await updateModule(id, !current);
      message.success('更新成功');
      fetchData();
    } catch {
      message.error('更新失败');
    }
  };

  const columns = [
    { title: '模块代码', dataIndex: 'module_code', key: 'module_code' },
    { title: '模块名称', dataIndex: 'module_name', key: 'module_name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '启用状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      render: (v: boolean, record: any) => <Switch checked={v} onChange={() => handleToggle(record.id, v)} />,
    },
  ];

  return (
    <div>
      <PageHeader title="模块配置" breadcrumbs={[{ name: '系统管理' }, { name: '模块配置' }]} />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />
    </div>
  );
};

export default ModuleConfig;
