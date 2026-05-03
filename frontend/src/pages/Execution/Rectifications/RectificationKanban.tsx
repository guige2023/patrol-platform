import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Tag, Progress, Badge, Spin, message, Empty, Button, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { getRectifications } from '@/api/rectifications';
import dayjs from 'dayjs';

const STATUS_COLUMNS = [
  { key: 'dispatched', label: '已派发', color: '#8c8c8c', icon: <ClockCircleOutlined /> },
  { key: 'signed', label: '已签收', color: '#1677ff', icon: <SyncOutlined /> },
  { key: 'progressing', label: '整改中', color: '#faad14', icon: <ExclamationCircleOutlined /> },
  { key: 'completed', label: '已完成', color: '#52c41a', icon: <CheckCircleOutlined /> },
  { key: 'submitted', label: '待验收', color: '#722ed1', icon: <FileTextOutlined /> },
  { key: 'verified', label: '已验收', color: '#13c2c2', icon: <CheckCircleOutlined /> },
  { key: 'rejected', label: '已驳回', color: '#ff4d4f', icon: <CloseCircleOutlined /> },
];

const ALERT_COLORS: Record<string, string> = {
  green: '#52c41a',
  yellow: '#faad14',
  orange: '#fa8c16',
  red: '#ff4d4f',
};

const RectificationKanban: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rectifications, setRectifications] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRectifications({ page: 1, page_size: 200 });
      setRectifications(res?.items || []);
    } catch {
      message.error('加载整改数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getColumnRectifications = (status: string) =>
    rectifications.filter(r => r.status === status);

  const getDeadlineStatus = (deadline: string) => {
    if (!deadline) return 'none';
    const now = dayjs();
    const dl = dayjs(deadline);
    const diffDays = dl.diff(now, 'day');
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'critical';
    if (diffDays <= 7) return 'warning';
    return 'normal';
  };

  const formatDeadline = (deadline: string) => {
    if (!deadline) return null;
    const now = dayjs();
    const dl = dayjs(deadline);
    const diffDays = dl.diff(now, 'day');
    if (diffDays < 0) return `已超期${Math.abs(diffDays)}天`;
    if (diffDays === 0) return '今日到期';
    return `${diffDays}天后到期`;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="加载整改看板..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {/* 头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#333' }}>整改看板</div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 2 }}>
            共 {rectifications.length} 条整改记录
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => navigate('/execution/rectifications')}>列表视图</Button>
          <Button type="primary" onClick={fetchData} icon={<SyncOutlined />}>刷新</Button>
        </div>
      </div>

      {/* 看板主体 */}
      <Row gutter={[12, 12]} align="top">
        {STATUS_COLUMNS.map(col => {
          const items = getColumnRectifications(col.key);
          return (
            <Col xs={24} sm={12} md={8} lg={Math.floor(24 / STATUS_COLUMNS.length)} key={col.key}>
              <Card
                size="small"
                headStyle={{
                  background: `${col.color}15`,
                  borderTop: `3px solid ${col.color}`,
                  borderRadius: 4,
                }}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: col.color, fontWeight: 600 }}>
                      {col.icon} {col.label}
                    </span>
                    <Badge count={items.length} style={{ backgroundColor: col.color }} />
                  </div>
                }
                bodyStyle={{ padding: '8px', minHeight: 300, background: '#fafafa' }}
                styles={{ body: { padding: '8px', minHeight: 300, background: '#fafafa' } }}
              >
                {items.length === 0 ? (
                  <Empty description={`暂无${col.label}记录`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map(rect => {
                      const dlStatus = getDeadlineStatus(rect.deadline);
                      const dlText = formatDeadline(rect.deadline);
                      return (
                        <Card
                          key={rect.id}
                          size="small"
                          hoverable
                          onClick={() => navigate(`/execution/rectifications/${rect.id}`)}
                          style={{
                            borderLeft: `3px solid ${ALERT_COLORS[rect.alert_level] || '#d9d9d9'}`,
                            cursor: 'pointer',
                          }}
                          bodyStyle={{ padding: '10px 12px' }}
                        >
                          {/* 标题 */}
                          <div style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: '#333',
                            marginBottom: 6,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            <Tooltip title={rect.title}>{rect.title}</Tooltip>
                          </div>

                          {/* 预警标签 */}
                          <div style={{ marginBottom: 6 }}>
                            <Tag
                              color={ALERT_COLORS[rect.alert_level] || '#d9d9d9'}
                              style={{ marginRight: 0 }}
                            >
                              {rect.alert_level === 'green' ? '绿色' :
                               rect.alert_level === 'yellow' ? '黄色' :
                               rect.alert_level === 'orange' ? '橙色' :
                               rect.alert_level === 'red' ? '红色' : rect.alert_level}
                            </Tag>
                          </div>

                          {/* 进度 */}
                          <div style={{ marginBottom: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 2 }}>
                              <span>进度</span>
                              <span>{rect.progress || 0}%</span>
                            </div>
                            <Progress
                              percent={rect.progress || 0}
                              size="small"
                              strokeColor={col.color}
                              trailColor="#e8e8e8"
                              showInfo={false}
                            />
                          </div>

                          {/* 截止日期 */}
                          {dlText && (
                            <div style={{
                              fontSize: 11,
                              color: dlStatus === 'overdue' ? '#ff4d4f' :
                                     dlStatus === 'critical' ? '#fa8c16' :
                                     dlStatus === 'warning' ? '#faad14' : '#888',
                              marginTop: 4,
                              fontWeight: dlStatus === 'overdue' || dlStatus === 'critical' ? 600 : 400,
                            }}>
                              <WarningOutlined /> {dlText}
                            </div>
                          )}

                          {/* 单位 */}
                          {rect.unit_name && (
                            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                              {rect.unit_name}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

export default RectificationKanban;
