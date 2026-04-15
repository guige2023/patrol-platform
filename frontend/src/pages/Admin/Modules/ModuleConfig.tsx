import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Switch, message, Tooltip } from 'antd';
import { CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getModules, updateModule } from '@/api/admin';
import { getErrorMessage } from '@/utils/error';

interface Module {
  id: string;
  module_code: string;
  module_name: string;
  description?: string;
  is_enabled: boolean;
  config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const MODULE_FEATURE_LABELS: Record<string, string[]> = {
  unit: ['单位档案管理', '单位信息维护'],
  cadre: ['干部人才库', '干部档案管理'],
  knowledge: ['知识库管理', '文档分类与检索'],
  plan: ['巡察计划制定', '计划审批流程'],
  inspection_group: ['巡察组管理', '成员分配'],
  draft: ['底稿管理', '谈话记录撰写'],
  clue: ['线索管理', '问题线索登记'],
  rectification: ['整改督办', '整改流程跟踪'],
  alert: ['预警管理', '风险预警推送'],
  dashboard: ['数据看板', '统计分析报表'],
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  unit: '管理被巡察单位的基本信息、巡察历史和问题台账',
  cadre: '管理干部人才库，包含干部基本信息、工作履历和廉政档案',
  knowledge: '巡察知识库管理，支持分类、标签和全文检索',
  plan: '制定年度巡察计划，管理巡察轮次和覆盖范围',
  inspection_group: '组建巡察工作组，分配组长、副组长和成员',
  draft: '巡察谈话记录和调查笔录的撰写与管理',
  clue: '问题线索的收集、登记和移交管理',
  rectification: '整改任务派发、进度跟踪和销号验收',
  alert: '重点领域风险预警，设置红黄蓝预警阈值',
  dashboard: '巡察工作数据统计和可视化展示',
};

const ModuleConfig: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Module[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getModules();
      setData(Array.isArray(res) ? res : res.data || []);
    } catch (e: any) {
      message.error(getErrorMessage(e) || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await updateModule(id, !current);
      message.success(!current ? '模块已启用' : '模块已禁用');
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '更新失败');
    }
  };

  const columns = [
    {
      title: '模块',
      key: 'module',
      render: (_: any, record: Module) => (
        <Space direction="vertical" size={2}>
          <Space>
            <Tag color={record.is_enabled ? 'blue' : 'default'} style={{ fontWeight: 600 }}>
              {record.module_name}
            </Tag>
            {!record.is_enabled && (
              <Tag color="red" icon={<StopOutlined />}>已禁用</Tag>
            )}
          </Space>
          <span style={{ color: '#888', fontSize: 12 }}>
            {record.module_code}
          </span>
        </Space>
      ),
    },
    {
      title: '功能说明',
      key: 'features',
      render: (_: any, record: Module) => {
        const features = MODULE_FEATURE_LABELS[record.module_code] || [];
        const desc = MODULE_DESCRIPTIONS[record.module_code] || record.description || '暂无描述';
        return (
          <Space direction="vertical" size={4}>
            <Tooltip title={desc}>
              <span style={{ color: '#595959', fontSize: 13 }}>{desc}</span>
            </Tooltip>
            {features.map(f => (
              <Tag key={f} color="cyan" style={{ fontSize: 12 }}>{f}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '启用状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 120,
      render: (v: boolean, record: Module) => (
        <Space direction="vertical" size={0}>
          <Switch
            checked={v}
            onChange={() => handleToggle(record.id, v)}
            checkedChildren="启用"
            unCheckedChildren="禁用"
            size="small"
          />
          {v && (
            <span style={{ fontSize: 11, color: '#52c41a', display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
              <CheckCircleOutlined /> 运行中
            </span>
          )}
        </Space>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-',
    },
  ];

  return (
    <div>
      <PageHeader
        title="模块配置"
        subTitle="管理系统功能模块，启用/禁用模块将影响对应菜单的显示"
        breadcrumbs={[{ name: '系统管理' }, { name: '模块配置' }]}
      />
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={false}
        style={{ background: '#fff' }}
        size="middle"
      />
    </div>
  );
};

export default ModuleConfig;
