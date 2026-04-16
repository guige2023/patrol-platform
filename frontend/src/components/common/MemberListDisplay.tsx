import React from 'react';
import { Tag } from 'antd';

interface Member {
  name: string;
  position: string;
  role: '组长' | '副组长' | '组员';
  concurrent_role?: '线索员' | '联络员' | null;
}

interface MemberListDisplayProps {
  members: Member[];
}

const MemberListDisplay: React.FC<MemberListDisplayProps> = ({ members }) => {
  if (!members || members.length === 0) {
    return <span style={{ color: '#999' }}>暂无成员</span>;
  }

  const leader = members.filter(m => m.role === '组长');
  const deputyLeaders = members.filter(m => m.role === '副组长');
  const regularMembers = members.filter(m => m.role === '组员');

  const renderMember = (m: Member) => {
    const concurrentBadge = m.concurrent_role ? (
      <Tag color="blue" style={{ marginLeft: 4 }}>兼{m.concurrent_role}</Tag>
    ) : null;
    return (
      <span key={`${m.name}-${m.position}`}>
        {m.name}（{m.position}）
        {concurrentBadge}
      </span>
    );
  };

  const parts: React.ReactNode[] = [];

  if (leader.length > 0) {
    parts.push(
      <span key="leader">
        <span style={{ fontWeight: 500 }}>组长：</span>
        {leader.map(renderMember)}
      </span>
    );
  }

  if (deputyLeaders.length > 0) {
    if (parts.length > 0) parts.push(<span style={{ marginLeft: 16 }} />);
    parts.push(
      <span key="deputy">
        <span style={{ fontWeight: 500 }}>副组长：</span>
        {deputyLeaders.map(m => renderMember(m))}
      </span>
    );
  }

  if (regularMembers.length > 0) {
    if (parts.length > 0) parts.push(<span style={{ marginLeft: 16 }} />);
    parts.push(
      <span key="member">
        <span style={{ fontWeight: 500 }}>组员：</span>
        {regularMembers.map(m => renderMember(m))}
      </span>
    );
  }

  return (
    <div style={{ lineHeight: 2 }}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>{part}</React.Fragment>
      ))}
    </div>
  );
};

export default MemberListDisplay;
