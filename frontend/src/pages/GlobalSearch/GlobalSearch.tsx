import React, { useState, useEffect, useCallback } from 'react';
import { Input, Tabs, Table, Tag, Card, Space, Empty } from 'antd';
import { SearchOutlined, BankOutlined, UserOutlined, FileTextOutlined, SnippetsOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { globalSearch, SearchResult } from '@/api/search';

const { Search } = Input;

const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const data = await globalSearch(q);
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handleNavigate = (type: string, id: string) => {
    const routes: Record<string, string> = {
      unit: `/archive/units`,
      cadre: `/archive/cadres`,
      knowledge: `/archive/knowledge`,
      draft: `/execution/drafts`,
    };
    if (routes[type]) {
      navigate(`${routes[type]}/${id}`);
    }
  };

  const unitColumns = [
    {
      title: '单位名称', dataIndex: 'name', key: 'name',
      render: (name: string, record: any) => (
        <a onClick={() => handleNavigate('unit', record.id)}>{name}</a>
      ),
    },
    { title: '组织编码', dataIndex: 'org_code', key: 'org_code' },
  ];

  const cadreColumns = [
    {
      title: '姓名', dataIndex: 'name', key: 'name',
      render: (name: string, record: any) => (
        <a onClick={() => handleNavigate('cadre', record.id)}>{name}</a>
      ),
    },
    { title: '职务', dataIndex: 'position', key: 'position' },
  ];

  const knowledgeColumns = [
    {
      title: '标题', dataIndex: 'title', key: 'title',
      render: (title: string, record: any) => (
        <a onClick={() => handleNavigate('knowledge', record.id)}>{title}</a>
      ),
    },
    { title: '分类', dataIndex: 'category', key: 'category' },
  ];

  const draftColumns = [
    {
      title: '标题', dataIndex: 'title', key: 'title',
      render: (title: string, record: any) => (
        <a onClick={() => handleNavigate('draft', record.id)}>{title}</a>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag>{s}</Tag>,
    },
  ];

  const totalResults = results
    ? (results.units?.length || 0) +
      (results.cadres?.length || 0) +
      (results.knowledge?.length || 0) +
      (results.drafts?.length || 0)
    : 0;

  const tabItems = [
    {
      key: 'all',
      label: `全部 (${totalResults})`,
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          {results?.units?.length ? (
            <Card size="small" title={<><BankOutlined /> 单位档案</>}>
              <Table size="small" columns={unitColumns} dataSource={results.units} rowKey="id" pagination={false} />
            </Card>
          ) : null}
          {results?.cadres?.length ? (
            <Card size="small" title={<><UserOutlined /> 干部人才</>}>
              <Table size="small" columns={cadreColumns} dataSource={results.cadres} rowKey="id" pagination={false} />
            </Card>
          ) : null}
          {results?.knowledge?.length ? (
            <Card size="small" title={<><FileTextOutlined /> 知识库</>}>
              <Table size="small" columns={knowledgeColumns} dataSource={results.knowledge} rowKey="id" pagination={false} />
            </Card>
          ) : null}
          {results?.drafts?.length ? (
            <Card size="small" title={<><SnippetsOutlined /> 底稿</>}>
              <Table size="small" columns={draftColumns} dataSource={results.drafts} rowKey="id" pagination={false} />
            </Card>
          ) : null}
          {totalResults === 0 && !loading && query && (
            <Empty description="未找到相关内容" />
          )}
        </Space>
      ),
    },
    {
      key: 'unit',
      label: `单位 (${results?.units?.length || 0})`,
      children: results?.units?.length
        ? <Table size="small" columns={unitColumns} dataSource={results.units} rowKey="id" pagination={false} />
        : <Empty description="无结果" />,
    },
    {
      key: 'cadre',
      label: `干部 (${results?.cadres?.length || 0})`,
      children: results?.cadres?.length
        ? <Table size="small" columns={cadreColumns} dataSource={results.cadres} rowKey="id" pagination={false} />
        : <Empty description="无结果" />,
    },
    {
      key: 'knowledge',
      label: `知识 (${results?.knowledge?.length || 0})`,
      children: results?.knowledge?.length
        ? <Table size="small" columns={knowledgeColumns} dataSource={results.knowledge} rowKey="id" pagination={false} />
        : <Empty description="无结果" />,
    },
    {
      key: 'draft',
      label: `底稿 (${results?.drafts?.length || 0})`,
      children: results?.drafts?.length
        ? <Table size="small" columns={draftColumns} dataSource={results.drafts} rowKey="id" pagination={false} />
        : <Empty description="无结果" />,
    },
  ];

  return (
    <div>
      <PageHeader title="全局搜索" breadcrumbs={[{ name: '全局搜索' }]} />
      <Card>
        <Search
          placeholder="搜索单位、干部、知识库、底稿..."
          allowClear
          size="large"
          prefix={<SearchOutlined />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          loading={loading}
          style={{ marginBottom: 24 }}
        />
        {query && (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        )}
        {!query && (
          <Empty description="输入关键词开始搜索" style={{ padding: '48px 0' }} />
        )}
      </Card>
    </div>
  );
};

export default GlobalSearch;