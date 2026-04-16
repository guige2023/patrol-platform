import React from 'react';
import { Badge } from 'antd';
import { BellOutlined } from '@ant-design/icons';

interface WarningBadgeProps {
  count: number;
  onClick?: () => void;
}

const WarningBadge: React.FC<WarningBadgeProps> = ({ count, onClick }) => {
  if (count <= 0) {
    return (
      <span style={{ cursor: 'pointer', fontSize: 20 }} onClick={onClick}>
        <BellOutlined />
      </span>
    );
  }

  return (
    <Badge count={count} size="small" offset={[-2, 2]}>
      <span style={{ cursor: 'pointer', fontSize: 20 }} onClick={onClick}>
        <BellOutlined />
      </span>
    </Badge>
  );
};

export default WarningBadge;
