import { useEffect, useState } from 'react'
import { Card, Row, Col, Spin, message, Timeline, Progress, Tag, Badge } from 'antd'
import {
  BankOutlined,
  ProjectOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ExceptionOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { getOverview, getIssueProfile } from '../../api/dashboard'

interface Overview {
  unit_count: number
  plan_count: number
  draft_count: number
  rectification_count: number
  clue_count: number
  pending_rectification: number
  overdue_rectification: number
  completed_rectification?: number
}

interface IssueProfile {
  drafts_by_category: { category: string; count: number }[]
  clues_by_source: { source: string; count: number }[]
  rectifications_by_alert_level: { level: string; count: number; type?: string }[]
  recent_activities?: { id: number; type: string; title: string; time: string }[]
  plan_progress?: { name: string; progress: number; status: string }[]
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

  // 获取当前日期
  const now = new Date()
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const fullDateStr = `${dateStr} ${weekDays[now.getDay()]}`

  // 核心指标卡片数据
  const statCards = [
    { 
      title: '单位档案', 
      value: overview?.unit_count ?? 0, 
      icon: <BankOutlined />, 
      color: '#C80000', 
      path: '/archive/units',
      subTitle: '已建档单位数量',
    },
    { 
      title: '巡察计划', 
      value: overview?.plan_count ?? 0, 
      icon: <ProjectOutlined />, 
      color: '#9B1C1C', 
      path: '/plan/plans',
      subTitle: '进行中/已完成',
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
  ]

  // 模拟进度数据
  const progressData = issues?.plan_progress || [
    { name: '2024年第一轮巡察', progress: 85, status: '进行中' },
    { name: '专项监督检查', progress: 100, status: '已完成' },
    { name: '整改落实督查', progress: 60, status: '进行中' },
    { name: '第二轮巡察准备', progress: 30, status: '准备中' },
  ]

  // 最新动态（时间线）
  const recentActivities = issues?.recent_activities || [
    { id: 1, type: 'plan', title: '2024年第一轮巡察进入实施阶段', time: '2小时前' },
    { id: 2, type: 'draft', title: '底稿「财务管理制度审查」已提交', time: '5小时前' },
    { id: 3, type: 'rectification', title: '「公车管理不规范」问题已整改', time: '昨天' },
    { id: 4, type: 'clue', title: '新增线索：群众举报某单位违规发放福利', time: '2天前' },
    { id: 5, type: 'plan', title: '2024年巡察工作计划已下达', time: '3天前' },
  ]

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'plan': return <ProjectOutlined style={{ color: '#9B1C1C' }} />
      case 'draft': return <FileTextOutlined style={{ color: '#C80000' }} />
      case 'rectification': return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'clue': return <ExceptionOutlined style={{ color: '#FA8C16' }} />
      default: return <ClockCircleOutlined style={{ color: '#999' }} />
    }
  }

  // 底稿分类数据
  const draftStats = issues?.drafts_by_category || [
    { category: '制度建设类', count: 12 },
    { category: '财务管理类', count: 8 },
    { category: '人事管理类', count: 5 },
    { category: '业务规范类', count: 15 },
  ]
  const maxDraftCount = Math.max(...draftStats.map(d => d.count), 1)

  // 线索来源数据
  const clueStats = issues?.clues_by_source || [
    { source: '群众举报', count: 15 },
    { source: '审计移交', count: 8 },
    { source: '巡视发现', count: 5 },
    { source: '自查发现', count: 3 },
  ]

  // 整改预警数据
  const alertStats: { level: string; count: number; type: string }[] = (issues?.rectifications_by_alert_level || [
    { level: '超期未整改', count: 2, type: 'danger' },
    { level: '即将超期', count: 3, type: 'warning' },
    { level: '整改中', count: 8, type: 'normal' },
    { level: '已催办', count: 1, type: 'warning' },
  ]).map(item => ({ ...item, type: item.type || 'normal' }))

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
            <Link to={card.path} style={{ textDecoration: 'none' }}>
              <Card 
                className="stat-card" 
                style={{ borderTop: `4px solid ${card.color}` }}
                styles={{ body: { padding: '20px 24px' } }}
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
            </Link>
          </Col>
        ))}
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
              {progressData.map((item, index) => (
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
              ))}
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
          </Card>
        </Col>
      </Row>

      {/* 底部统计区 */}
      <Row gutter={16}>
        {/* 底稿分类统计 */}
        <Col xs={24} md={8}>
          <Card 
            className="panel-card"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined />
                底稿分类统计
              </span>
            }
          >
            <div style={{ padding: '8px 0' }}>
              {draftStats.map((item, index) => (
                <div key={index} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#666', fontSize: 13 }}>{item.category}</span>
                    <span style={{ color: '#C80000', fontWeight: 'bold' }}>{item.count}</span>
                  </div>
                  <div style={{ 
                    height: 8, 
                    background: '#FFE5E5', 
                    borderRadius: 4, 
                    overflow: 'hidden' 
                  }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${(item.count / maxDraftCount) * 100}%`,
                      background: 'linear-gradient(90deg, #C80000, #9B1C1C)',
                      borderRadius: 4,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* 线索来源统计 */}
        <Col xs={24} md={8}>
          <Card 
            className="panel-card"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExceptionOutlined />
                线索来源统计
              </span>
            }
          >
            <div style={{ padding: '8px 0' }}>
              {clueStats.map((item, index) => {
                const total = clueStats.reduce((sum, i) => sum + i.count, 0)
                const percent = total > 0 ? Math.round((item.count / total) * 100) : 0
                const colors = ['#C80000', '#9B1C1C', '#A60000', '#8B0000']
                return (
                  <div key={index} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#666', fontSize: 13 }}>{item.source}</span>
                      <span style={{ color: colors[index % colors.length], fontWeight: 'bold' }}>
                        {item.count} ({percent}%)
                      </span>
                    </div>
                    <div style={{ 
                      height: 8, 
                      background: '#FFE5E5', 
                      borderRadius: 4, 
                      overflow: 'hidden' 
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${percent}%`,
                        background: colors[index % colors.length],
                        borderRadius: 4,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </Col>

        {/* 整改预警统计 */}
        <Col xs={24} md={8}>
          <Card 
            className="panel-card"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WarningOutlined />
                整改预警统计
              </span>
            }
          >
            <div style={{ padding: '8px 0' }}>
              {alertStats.map((item, index) => (
                <div 
                  key={index}
                  className={`alert-item ${item.type}`}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: '#333', marginBottom: 2 }}>{item.level}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {item.type === 'danger' ? '需立即处理' : item.type === 'warning' ? '需尽快处理' : '正常进行中'}
                    </div>
                  </div>
                  <Badge 
                    count={item.count} 
                    style={{ 
                      backgroundColor: item.type === 'danger' ? '#C80000' : item.type === 'warning' ? '#FA8C16' : '#52c41a',
                    }}
                  />
                </div>
              ))}
            </div>
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
              <Link to="/archive/units"><Tag color="red" icon={<BankOutlined />}>单位档案</Tag></Link>
              <Link to="/plan/plans"><Tag color="red" icon={<ProjectOutlined />}>巡察计划</Tag></Link>
              <Link to="/plan/groups"><Tag color="red">巡察组</Tag></Link>
              <Link to="/archive/cadres"><Tag color="red">干部管理</Tag></Link>
              <Link to="/execution/drafts"><Tag color="red" icon={<FileTextOutlined />}>底稿管理</Tag></Link>
              <Link to="/execution/clues"><Tag color="red" icon={<ExceptionOutlined />}>线索管理</Tag></Link>
              <Link to="/execution/rectifications"><Tag color="red" icon={<WarningOutlined />}>整改管理</Tag></Link>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
