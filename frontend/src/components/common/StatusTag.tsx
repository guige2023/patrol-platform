import React from 'react';
import { Tag } from 'antd';

interface StatusTagProps {
  status: string;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'gold', label: '待整改' },
  rectifying: { color: 'processing', label: '整改中' },
  completed: { color: 'success', label: '已完成' },
  overdue: { color: 'error', label: '已逾期' },
};

const StatusTag: React.FC<StatusTagProps> = ({ status }) => {
  const config = statusConfig[status] || { color: 'default', label: status };
  return <Tag color={config.color}>{config.label}</Tag>;
};

export default StatusTag;
