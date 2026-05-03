import { useState, useEffect } from 'react'
import { Card, Table, Tag, Select, Progress, Typography, Space, Statistic, Row, Col } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, TeamOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import api from '@/api/client'

const { Title } = Typography

interface CoverageUnit {
  unit_id: string
  unit_name: string
  inspection_count: number
}

interface CoverageData {
  year: number
  total_units: number
  inspected_count: number
  not_inspected_count: number
  coverage_rate: number
  units: CoverageUnit[]
}

export default function Coverage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear)
  const [data, setData] = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/dashboard/yearly-coverage', { params: { year } })
      .then(res => setData(res.data ?? res))
      .finally(() => setLoading(false))
  }, [year])

  const columns = [
    {
      title: '单位名称',
      dataIndex: 'unit_name',
      key: 'unit_name',
      render: (name: string, record: CoverageUnit) => (
        <Space>
          {record.inspection_count > 0 ? (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          )}
          {name}
        </Space>
      ),
    },
    {
      title: '巡察次数',
      dataIndex: 'inspection_count',
      key: 'inspection_count',
      width: 120,
      render: (count: number) =>
        count > 0 ? (
          <Tag color="blue">{count} 次</Tag>
        ) : (
          <Tag color="default">未检查</Tag>
        ),
      sorter: (a: CoverageUnit, b: CoverageUnit) => b.inspection_count - a.inspection_count,
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: unknown, record: CoverageUnit) =>
        record.inspection_count > 0 ? (
          <Tag color="success">已覆盖</Tag>
        ) : (
          <Tag color="error">未覆盖</Tag>
        ),
    },
  ]

  // Coverage donut option
  const donutOption = data
    ? {
        tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, textStyle: { fontSize: 12 } },
        series: [
          {
            type: 'pie' as const,
            radius: ['45%', '70%'],
            center: ['50%', '45%'],
            label: { show: false },
            data: [
              { value: data.inspected_count, name: '已覆盖', itemStyle: { color: '#52c41a' } },
              { value: data.not_inspected_count, name: '未覆盖', itemStyle: { color: '#ff4d4f' } },
            ],
          },
        ],
      }
    : {}

  // Inspection count bar chart
  const inspectedUnits = data?.units.filter(u => u.inspection_count > 0) || []
  const barOption =
    inspectedUnits.length > 0
      ? {
          tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
          grid: { left: 120, right: 30, top: 10, bottom: 30 },
          xAxis: { type: 'value' as const },
          yAxis: {
            type: 'category' as const,
            data: inspectedUnits.map(u => u.unit_name).reverse(),
            axisLabel: { fontSize: 11 },
          },
          series: [
            {
              type: 'bar' as const,
              data: inspectedUnits.map(u => u.inspection_count).reverse(),
              itemStyle: { color: '#1677ff' },
              label: { show: true, position: 'right', fontSize: 11 },
            },
          ],
        }
      : {}

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>覆盖率统计</Title>
        <Select value={year} onChange={setYear} style={{ width: 120 }}>
          {[currentYear, currentYear - 1, currentYear - 2].map(y => (
            <Select.Option key={y} value={y}>{y}年</Select.Option>
          ))}
        </Select>
      </div>

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="单位总数"
              value={data?.total_units ?? 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已覆盖单位"
              value={inspectedUnits.length}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未覆盖单位"
              value={data?.not_inspected_count ?? 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="覆盖率"
              value={data?.coverage_rate ?? 0}
              suffix="%"
              valueStyle={{ color: '#1677ff' }}
            />
            <Progress
              percent={data?.coverage_rate ?? 0}
              showInfo={false}
              strokeColor="#1677ff"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card title="覆盖率分布">
            {data && <ReactECharts option={donutOption} style={{ height: 220 }} />}
          </Card>
        </Col>
        <Col span={16}>
          <Card title="各单次巡察次数">
            {inspectedUnits.length > 0 ? (
              <ReactECharts option={barOption} style={{ height: 220 }} />
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Unit Table */}
      <Card title="单位覆盖率明细">
        <Table
          dataSource={data?.units || []}
          columns={columns}
          rowKey="unit_id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          size="small"
        />
      </Card>
    </div>
  )
}
