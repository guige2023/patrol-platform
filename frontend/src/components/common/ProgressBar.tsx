import React from 'react';
import { Progress } from 'antd';

interface ProgressBarProps {
  current: number;
  total: number;
  status?: 'active' | 'completed' | 'pending';
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, status = 'pending' }) => {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  const getStrokeColor = () => {
    switch (status) {
      case 'completed':
        return '#52c41a';
      case 'active':
        return '#1677ff';
      default:
        return '#d9d9d9';
    }
  };

  const getFormat = () => (
    <span style={{ fontSize: 12 }}>
      第{current}天/共{total}天
    </span>
  );

  return (
    <Progress
      percent={percent}
      size="small"
      strokeColor={getStrokeColor()}
      format={getFormat}
    />
  );
};

export default ProgressBar;
