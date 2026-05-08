import { useEffect, useState, useCallback } from 'react'
import { Card, Row, Col, Spin, message, Timeline, Progress, Tag, List, Alert } from 'antd'
import {
  BankOutlined,
  ProjectOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ExceptionOutlined,
  BarChartOutlined,
  RiseOutlined,
  LineChartOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { getOverview, getIssueProfile, getYearlyStats } from '../../api/dashboard'
import { getWarnings } from '../../api/warnings'
import {
  buildDonutOption,
  buildAlertBarOption,
  buildGanttOption,
  buildTrendOption,
  buildYearlyBarOption,
  getProgressColor,
} from './chartOptions'

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
  rectifications_by_status?: { status: string; count: number }[]
  recent_activities?: { id: number; type: string; title: string; time: string }[]
  plan_progress?: { name: string; progress: number; status: string }[]
  uninspected_units?: { id: string; name: string; last_inspected_year?: number }[]
  current_round_progress?: { plan_name: string; days_elapsed: number; days_total: number; percentage: number }[]
  yearly_coverage?: { year: number; inspected_count: number; total_count: number; percentage: number }[]
  rectification_deadlines?: { id: string; title: string; unit_name?: string; deadline: string }[]
  top_problem_types?: { category: string; count: number }[]
  unit_rankings?: { unit_name: string; rectification_count: number; completed_count: number; overdue_count: number }[]
  rectification_trend?: { month: string; completed: number; submitted: number; rejected: number }[]
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

  const now = new Date()
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const fullDateStr = `${dateStr} ${weekDays[now.getDay()]}`

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

  const currentRoundProgress = issues?.current_round_progress || []
  const uninspectedUnits = issues?.uninspected_units || []
  const yearlyCoverage = issues?.yearly_coverage || []
  const todayWarnings = warnings
  const progressData = issues?.plan_progress || []
  const recentActivities = issues?.recent_activities || []
  const rectByStatus = issues?.rectifications_by_status || []
  const rectByLevel = issues?.rectifications_by_alert_level || []
  const deadlines = issues?.rectification_deadlines || []
  const topProblems = issues?.top_problem_types || []
  const unitRankings = issues?.unit_rankings || []
  const rectificationTrend = issues?.rectification_trend || []

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'plan': return <ProjectOutlined style={{ color: '#9B1C1C' }} />
      case 'draft': return <FileTextOutlined style={{ color: '#C80000' }} />
      case 'rectification': return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'clue': return <ExceptionOutlined style={{ color: '#FA8C16' }} />
      default: return <ClockCircleOutlined style={{ color: '#999' }} />
    }
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
                  <div className="stat-card-value" style={{ color: card.color }}>
                    {card.value}
                  </div>
                  <div className="stat-card-sub">{card.subTitle}</div>
                </div>
                <div style={{ fontSize: 32, color: card.color, opacity: 0.8 }}>
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 预警指示器 + 整改状态环形图 + 预警级别分布 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} md={6}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WarningOutlined style={{ color: '#ff4d4f' }} />
              预警指示器
            </span>
          }>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#333' }}>超期整改</span>
                <Tag color={overview?.overdue_rectification ? 'red' : 'green'}>
                  {overview?.overdue_rectification ?? 0} 条
                </Tag>
              </div>
              <Progress
                percent={overview?.rectification_count ? Math.min(100, (overview.overdue_rectification / overview.rectification_count) * 100) : 0}
                strokeColor={overview?.overdue_rectification ? '#ff4d4f' : '#52c41a'}
                showInfo={false}
                size="small"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#333' }}>待处理整改</span>
                <Tag color="orange">{overview?.pending_rectification ?? 0} 条</Tag>
              </div>
              <Progress
                percent={overview?.rectification_count ? Math.min(100, (overview.pending_rectification / overview.rectification_count) * 100) : 0}
                strokeColor="#fa8c16"
                showInfo={false}
                size="small"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#333' }}>整改完成率</span>
                <Tag color="blue">
                  {overview?.rectification_count ? Math.round((overview.completed_rectification || 0) / overview.rectification_count * 100) : 0}%
                </Tag>
              </div>
              <Progress
                percent={overview?.rectification_count ? Math.min(100, ((overview.completed_rectification || 0) / overview.rectification_count) * 100) : 0}
                strokeColor="#1677ff"
                showInfo={false}
                size="small"
              />
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tag color="red" style={{ cursor: 'pointer' }} onClick={() => navigate('/execution/rectifications')}>
                <WarningOutlined /> 整改督办
              </Tag>
              <Tag color="purple" style={{ cursor: 'pointer' }} onClick={() => navigate('/execution/rectifications/kanban')}>
                整改看板
              </Tag>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={9}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChartOutlined />
              整改状态分布
            </span>
          } extra={
            <Link to="/execution/rectifications/kanban">
              <Tag color="purple">看板视图</Tag>
            </Link>
          }>
            {rectByStatus.length > 0 ? (
              <ReactECharts option={buildDonutOption(rectByStatus)} style={{ height: 220 }} opts={{ renderer: 'canvas' }} />
            ) : (
              <Alert message="暂无整改数据" type="info" showIcon />
            )}
          </Card>
        </Col>

        <Col xs={24} md={9}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WarningOutlined style={{ color: '#faad14' }} />
              预警级别分布
            </span>
          }>
            {rectByLevel.length > 0 ? (
              <ReactECharts option={buildAlertBarOption(rectByLevel)} style={{ height: 220 }} opts={{ renderer: 'canvas' }} />
            ) : (
              <Alert message="暂无预警数据" type="info" showIcon />
            )}
          </Card>
        </Col>
      </Row>

      {/* 当前轮次进度 + 今日预警 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} md={14}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ProjectOutlined />
              当前轮次进度
            </span>
          }>
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

        <Col xs={24} md={10}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WarningOutlined style={{ color: '#ff4d4f' }} />
              今日预警
            </span>
          }>
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

      {/* 整改甘特图 + 问题类型排行 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClockCircleOutlined />
              整改截止日期（剩余天数）
            </span>
          }>
            {deadlines.length > 0 ? (
              <ReactECharts option={buildGanttOption(deadlines)} style={{ height: 220 }} opts={{ renderer: 'canvas' }} />
            ) : (
              <Alert message="暂无截止日期数据" type="info" showIcon />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RiseOutlined />
              问题类型排行
            </span>
          }>
            {topProblems.length > 0 ? (
              topProblems.slice(0, 8).map((p: any, i: number) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#333' }}>{p.category || '未分类'}</span>
                    <span style={{ fontSize: 13, color: '#C80000', fontWeight: 600 }}>{p.count}条</span>
                  </div>
                  <Progress
                    percent={topProblems[0]?.count ? Math.round(p.count / topProblems[0].count * 100) : 0}
                    strokeColor="#C80000"
                    trailColor="#FFE5E5"
                    size="small"
                    showInfo={false}
                  />
                </div>
              ))
            ) : (
              <Alert message="暂无问题分类数据" type="info" showIcon />
            )}
          </Card>
        </Col>
      </Row>

      {/* 单位排名 + 整改趋势 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChartOutlined />
              整改单位排名
            </span>
          }>
            {unitRankings.length > 0 ? (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {unitRankings.map((r: any, i: number) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: '#333', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {i + 1}. {r.unit_name || '未知单位'}
                      </span>
                      <span style={{ fontSize: 12, color: '#888' }}>
                        {r.completed_count}/{r.rectification_count} 完成
                        {r.overdue_count > 0 && <Tag color="red" style={{ marginLeft: 6 }}>{r.overdue_count}超期</Tag>}
                      </span>
                    </div>
                    <Progress
                      percent={r.rectification_count > 0 ? Math.round(r.completed_count / r.rectification_count * 100) : 0}
                      strokeColor="#52c41a"
                      size="small"
                      format={(p) => `${p}%`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Alert message="暂无单位排名数据" type="info" showIcon />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LineChartOutlined />
              整改趋势
            </span>
          }>
            {rectificationTrend.length > 0 ? (
              <ReactECharts option={buildTrendOption(rectificationTrend)} style={{ height: 260 }} opts={{ renderer: 'canvas' }} />
            ) : (
              <Alert message="暂无整改趋势数据" type="info" showIcon />
            )}
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
              <select
                value={statsYear}
                onChange={(e) => setStatsYear(Number(e.target.value))}
                style={{ width: 120 }}
              >
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}年</option>
                <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}年</option>
                <option value={new Date().getFullYear() - 2}>{new Date().getFullYear() - 2}年</option>
              </select>
            }
          >
            <ReactECharts
              option={buildYearlyBarOption(yearlyStats)}
              style={{ height: 280 }}
              opts={{ renderer: 'canvas' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 年度覆盖率 + 未巡察单位警告 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleOutlined />
              年度覆盖率
            </span>
          }>
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

        <Col xs={24} md={12}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WarningOutlined style={{ color: '#ff4d4f' }} />
              未巡察单位警告
            </span>
          }>
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
        <Col xs={24} md={14}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ProjectOutlined />
              巡察进度概览
            </span>
          }>
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

        <Col xs={24} md={10}>
          <Card className="panel-card" title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClockCircleOutlined />
              最新动态
            </span>
          }>
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

      {/* 快捷入口 */}
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
              <Link to="/execution/rectifications/kanban"><Tag color="purple">整改看板</Tag></Link>
              <Link to="/execution/progress"><Tag color="red" icon={<FileTextOutlined />}>进度管理</Tag></Link>
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
