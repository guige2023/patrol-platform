import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Spin, message } from 'antd'
import {
  BankOutlined,
  ProjectOutlined,
  FileTextOutlined,
  WarningOutlined,
  ExceptionOutlined,
  AuditOutlined,
} from '@ant-design/icons'
import { getOverview, getIssueProfile } from '../../api/dashboard'

interface Overview {
  unit_count: number
  plan_count: number
  draft_count: number
  rectification_count: number
  clue_count: number
  pending_rectification: number
  overdue_rectification: number
}

interface IssueProfile {
  drafts_by_category: { category: string; count: number }[]
  clues_by_source: { source: string; count: number }[]
  rectifications_by_alert_level: { level: string; count: number }[]
}

export default function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [issues, setIssues] = useState<IssueProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getOverview(), getIssueProfile()])
      .then(([ov, iss]) => {
        setOverview(ov)
        setIssues(iss)
      })
      .catch(() => message.error('加载数据失败'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ marginTop: 80, textAlign: 'center' }}>
      <Spin />
      <div style={{ marginTop: 8, color: '#999' }}>加载中...</div>
    </div>
  )

  const cards = [
    { title: '单位档案', value: overview?.unit_count ?? 0, icon: <BankOutlined />, color: '#1890ff' },
    { title: '巡察计划', value: overview?.plan_count ?? 0, icon: <ProjectOutlined />, color: '#52c41a' },
    { title: '底稿数量', value: overview?.draft_count ?? 0, icon: <FileTextOutlined />, color: '#faad14' },
    { title: '线索数量', value: overview?.clue_count ?? 0, icon: <ExceptionOutlined />, color: '#f5222d' },
    { title: '整改数量', value: overview?.rectification_count ?? 0, icon: <WarningOutlined />, color: '#722ed1' },
    {
      title: '待整改',
      value: overview?.pending_rectification ?? 0,
      icon: <WarningOutlined />,
      color: '#fa8c16',
    },
    {
      title: '超期整改',
      value: overview?.overdue_rectification ?? 0,
      icon: <AuditOutlined />,
      color: '#cf1322',
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={12} sm={8} md={6} lg={4} key={c.title}>
            <Card hoverable>
              <Statistic
                title={c.title}
                value={c.value}
                prefix={<span style={{ color: c.color }}>{c.icon}</span>}
                valueStyle={{ color: c.color, fontSize: 28 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={8}>
          <Card title="底稿分类统计" size="small">
            {issues?.drafts_by_category.length ? (
              <ul style={{ paddingLeft: 20 }}>
                {issues.drafts_by_category.map((d) => (
                  <li key={d.category}>
                    {d.category}: <b>{d.count}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#999' }}>暂无数据</div>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="线索来源统计" size="small">
            {issues?.clues_by_source.length ? (
              <ul style={{ paddingLeft: 20 }}>
                {issues.clues_by_source.map((d) => (
                  <li key={d.source}>
                    {d.source}: <b>{d.count}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#999' }}>暂无数据</div>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="整改预警统计" size="small">
            {issues?.rectifications_by_alert_level.length ? (
              <ul style={{ paddingLeft: 20 }}>
                {issues.rectifications_by_alert_level.map((d) => (
                  <li key={d.level}>
                    {d.level}: <b>{d.count}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#999' }}>暂无数据</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
