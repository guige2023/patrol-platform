import { useEffect, useState, useCallback } from 'react'
import { Card, Row, Col, Spin, message, Timeline, Progress, Tag, Select, List, Alert } from 'antd'
import {
  BankOutlined,
  ProjectOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ExceptionOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { getOverview, getIssueProfile, getYearlyStats } from '../../api/dashboard'
import { getWarnings } from '../../api/warnings'

interface Overview {
  unit_count: number
  plan_count: number
  draft_count: number
  rectification_count: number
  clue_count: number
  pending_rectification: number
  overdue_rectification: number
  completed_rectification?: number
  in_progress_plan_count?: number
  pending_plan_count?: number
}

interface IssueProfile {
  drafts_by_category: { category: string; count: number }[]
  clues_by_source: { source: string; count: number }[]
  rectifications_by_alert_level: { level: string; count: number; type?: string }[]
  recent_activities?: { id: number; type: string; title: string; time: string }[]
  plan_progress?: { name: string; progress: number; status: string; days_elapsed?: number; days_total?: number }[]
  uninspected_units?: { id: string; name: string; last_inspected_year?: number }[]
  current_round_progress?: { plan_id: string; plan_name: string; days_elapsed: number; days_total: number; percentage: number }[]
  yearly_coverage?: { year: number; inspected_count: number; total_count: number; percentage: number }[]
}

interface YearlyStats {
  year: number
  months: number[]
  plan_counts: number[]
  group_counts: number[]
}

export default function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [issues, setIssues] = useState<IssueProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [yearlyStats, setYearlyStats] = useState<YearlyStats | null>(null)
  const [statsYear, setStatsYear] = useState(new Date().getFullYear())
  const [warnings, setWarnings] = useState<any[]>([])
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    try {
      const [ov, iss, warnRes] = await Promise.all([
        getOverview(),
        getIssueProfile(),
        getWarnings({ page: 1, page_size: 5 }),
      ])
      setOverview(ov)
      setIssues(iss)
      setWarnings(warnRes?.items || [])
    } catch {
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    getYearlyStats(statsYear)
      .then(setYearlyStats)
      .catch(console.error)
  }, [statsYear])

  if (loading) return (
    <div style={{ marginTop: 80, textAlign: 'center' }}>
      <Spin />
      <div style={{ marginTop: 8, color: '#999' }}>加载中...</div>
    </div>
  )

  // 获取当前日期
  const now = new Date()
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const fullDateStr = `${dateStr} ${weekDays[now.getDay()]}`

  // 核心指标卡片数据
  const statCards = [
    { 
      title: '巡察计划', 
      value: overview?.plan_count ?? 0, 
      icon: <ProjectOutlined />, 
      color: '#9B1C1C', 
      path: '/plans',
      subTitle: `进行中${overview?.in_progress_plan_count ?? 0} / 待整改${overview?.pending_plan_count ?? 0}`,
    },
    { 
      title: '整改完成', 
      value: `${overview?.completed_rectification ?? 0}/${overview?.rectification_count ?? 0}`, 
      icon: <CheckCircleOutlined />, 
      color: '#52c41a', 
      path: '/execution/rectifications',
      subTitle: '已完成/总整改数',
    },
    { 
      title: '超期整改', 
      value: overview?.overdue_rectification ?? 0, 
      icon: <WarningOutlined />, 
      color: overview?.overdue_rectification ? '#C80000' : '#52c41a', 
      path: '/execution/rectifications?filter=overdue',
      subTitle: '需重点关注',
    },
    { 
      title: '单位档案', 
      value: overview?.unit_count ?? 0, 
      icon: <BankOutlined />, 
      color: '#C80000', 
      path: '/archive/units',
      subTitle: '已建档单位数量',
    },
  ]

  // 当前轮次进度数据
  const currentRoundProgress = issues?.current_round_progress || []
  
  // 未巡察单位警告
  const uninspectedUnits = issues?.uninspected_units || []

  // 年度覆盖率
  const yearlyCoverage = issues?.yearly_coverage || []

  // 今日预警
  const todayWarnings = warnings

  // 模拟进度数据（用于备用）
  const progressData = issues?.plan_progress || []

  // 最新动态（时间线）
  const recentActivities = issues?.recent_activities || []

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'plan': return <ProjectOutlined style={{ color: '#9B1C1C' }} />
      case 'draft': return <FileTextOutlined style={{ color: '#C80000' }} />
      case 'rectification': return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'clue': return <ExceptionOutlined style={{ color: '#FA8C16' }} />
      default: return <ClockCircleOutlined style={{ color: '#999' }} />
    }
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#52c41a'
    if (percentage >= 70) return '#1677ff'
    if (percentage >= 30) return '#faad14'
    return '#ff4d4f'
  }

  return (
    <div style={{ padding: 0 }}>
      {/* 欢迎语区域 */}
      <div className="welcome-section">
        <div className="welcome-title">🏛️ 您好，admin！</div>
        <div className="welcome-date">今天是 {fullDateStr}，祝您工作顺利！</div>
      </div>

      {/* 核心指标卡片区 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card) => (
          <Col xs={12} sm={12} md={6} key={card.title}>
            <Card
              className="stat-card"
              style={{ borderTop: `4px solid ${card.color}`, cursor: 'pointer' }}
              styles={{ body: { padding: '20px 24px' } }}
              onClick={() => navigate(card.path)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-card-title">{card.title}</div>
                  <div
                    className="stat-card-value"
                    style={{ color: card.color }}
                  >
                    {card.value}
                  </div>
                  <div className="stat-card-sub">{card.subTitle}</div>
                </div>
                <div style={{
                  fontSize: 32,
                  color: card.color,
                  opacity: 0.8,
                }}>
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 当前轮次进度 + 今日预警 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* 左侧 - 当前轮次进度 */}
        <Col xs={24} md={14}>
          <Card 
            className="panel-card"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ProjectOutlined />
                当前轮次进度
              </span>
            }
          >
            {currentRoundProgress.length > 0 ? (
              currentRoundProgress.map((item, index) => (
                <div key={index} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 500, color: '#333' }}>{item.plan_name}</span>
                    <span style={{ color: '#666', fontSize: 12 }}>
                      第{item.days_elapsed}天/共{item.days_total}天 ({item.percentage}%)
                    </span>
                  </div>
                  <Progress 
                    percent={item.percentage} 
                    strokeColor={getProgressColor(item.percentage)}
                    trailColor="#FFE5E5"
                    size="small"
                  />
                </div>
              ))
            ) : (
              <Alert message="暂无进行中的巡察计划" type="info" showIcon />
            )}
          </Card>
        </Col>

        {/* 右侧 - 今日预警 */}
        <Col xs={24} md={10}>
          <Card 
            className="panel-card"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WarningOutlined style={{ color: '#ff4d4f' }} />
                今日预警
              </span>
            }
          >
            <List
              dataSource={todayWarnings}
              renderItem={(item: any) => (
                <List.Item style={{ padding: '12px 0', cursor: 'pointer' }}>
                  <List.Item.Meta
                    avatar={
                      <WarningOutlined style={{ 
                        color: item.type === 'danger' ? '#ff4d4f' : '#faad14', 
                        fontSize: 20 
                      }} />
                    }
                    title={<span style={{ fontSize: 14 }}>{item.title}</span>}
                    description={<span style={{ fontSize: 12, color: '#888' }}>{item.description}</span>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 年度工作量统计 */}
      <Row style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card
            className="panel-card"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChartOutlined />
                年度工作量统计
              </span>
            }
            extra={
              <Select
                value={statsYear}
                onChange={setStatsYear}
                style={{ width: 120 }}
                options={[
                  { value: new Date().getFullYear(), label: String(new Date().getFullYear()) },
                  { value: new Date().getFullYear() - 1, label: String(new Date().getFullYear() - 1) },
                  { value: new Date().getFullYear() - 2, label: String(new Date().getFullYear() - 2) },
                ]}
              />
            }
          >
            <ReactECharts
              option={{
                tooltip: { trigger: 'axis' },
                legend: {
                  data: ['巡察计划', '巡察组'],
                  bottom: 0,
                },
                grid: { left: 40, right: 20, top: 20, bottom: 50 },
                xAxis: {
                  type: 'category',
                  data: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
                  axisLabel: { fontSize: 11 },
                },
                yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 11 } },
                series: [
                  {
                    name: '巡察计划',
                    type: 'bar',
                    itemStyle: { color: '#C80000', borderRadius: [4, 4, 0, 0] },
                    barMaxWidth: 36,
                    data: yearlyStats?.plan_counts || Array(12).fill(0),
                  },
                  {
                    name: '巡察组',
                    type: 'bar',
                    itemStyle: { color: '#1677FF', borderRadius: [4, 4, 0, 0] },
                    barMaxWidth: 36,
                    data: yearlyStats?.group_counts || Array(12).fill(0),
                  },
                ],
              }}
              style={{ height: 280 }}
              opts={{ renderer: 'canvas' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 年度覆盖率 + 未巡察单位警告 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* 年度覆盖率 */}
        <Col xs={24} md={12}>
          <Card 
            className="panel-card"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircleOutlined />
                年度覆盖率
              </span>
            }
          >
            {yearlyCoverage.length > 0 ? (
              yearlyCoverage.map((item, index) => (
                <div key={index} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#666', fontSize: 13 }}>{item.year}年巡察覆盖率</span>
                    <span style={{ fontWeight: 'bold', color: item.percentage >= 100 ? '#52c41a' : '#C80000' }}>
                      {item.percentage}%
                    </span>
                  </div>
                  <Progress 
                    percent={item.percentage} 
                    strokeColor={item.percentage >= 100 ? '#52c41a' : '#C80000'}
                    trailColor="#FFE5E5"
                    size="small"
                    format={() => `${item.inspected_count}/${item.total_count}`}
                  />
                </div>
              ))
            ) : (
              <Alert message="暂无覆盖率数据" type="info" showIcon />
            )}
          </Card>
        </Col>

        {/* 未巡察单位警告 */}
        <Col xs={24} md={12}>
          <Card 
            className="panel-card"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WarningOutlined style={{ color: '#ff4d4f' }} />
                未巡察单位警告
              </span>
            }
          >
            <List
              size="small"
              dataSource={uninspectedUnits.slice(0, 5)}
              renderItem={(item: any) => (
                <List.Item style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>{item.name}</span>
                    <Tag color="red">上次巡察：{item.last_inspected_year || '从未'}年</Tag>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 巡察进度 + 最新动态 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* 左侧 - 巡察进度概览 */}
        <Col xs={24} md={14}>
          <Card 
            className="panel-card"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ProjectOutlined />
                巡察进度概览
              </span>
            }
          >
            <div style={{ padding: '8px 0' }}>
              {progressData.length > 0 ? progressData.map((item, index) => (
                <div key={index} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 500, color: '#333' }}>{item.name}</span>
                    <Tag color={item.status === '已完成' ? 'success' : item.status === '进行中' ? 'processing' : 'default'}>
                      {item.status}
                    </Tag>
                  </div>
                  <Progress 
                    percent={item.progress} 
                    strokeColor={item.status === '已完成' ? '#52c41a' : '#C80000'}
                    trailColor="#FFE5E5"
                    size="small"
                  />
                </div>
              )) : (
                <Alert message="暂无巡察进度数据" type="info" showIcon />
              )}
            </div>
          </Card>
        </Col>

        {/* 右侧 - 最新动态 */}
        <Col xs={24} md={10}>
          <Card 
            className="panel-card"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClockCircleOutlined />
                最新动态
              </span>
            }
          >
            {recentActivities.length > 0 ? (
            <Timeline 
              items={recentActivities.map((activity) => ({
                dot: getActivityIcon(activity.type),
                children: (
                  <div>
                    <div style={{ color: '#333', fontSize: 14 }}>{activity.title}</div>
                    <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>{activity.time}</div>
                  </div>
                ),
              }))}
            />
            ) : (
              <Alert message="暂无最新动态" type="info" showIcon />
            )}
          </Card>
        </Col>
      </Row>

      {/* 底部快捷入口 */}
      <Row style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card 
            styles={{ 
              body: { 
                padding: '16px 24px',
                background: 'linear-gradient(90deg, #FFF5F5 0%, #FFE5E5 100%)',
                borderRadius: 12,
              } 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#9B1C1C', fontWeight: 'bold', marginRight: 8 }}>快捷入口：</span>
              <Link to="/plans"><Tag color="red" icon={<ProjectOutlined />}>巡察计划</Tag></Link>
              <Link to="/groups"><Tag color="red">巡察组</Tag></Link>
              <Link to="/execution/rectifications"><Tag color="red" icon={<WarningOutlined />}>整改督办</Tag></Link>
              <Link to="/progress"><Tag color="red" icon={<FileTextOutlined />}>进度管理</Tag></Link>
              <Link to="/documents"><Tag color="red">文档管理</Tag></Link>
              <Link to="/archive/cadres"><Tag color="red">干部人才</Tag></Link>
              <Link to="/archive/units"><Tag color="red" icon={<BankOutlined />}>单位档案</Tag></Link>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
