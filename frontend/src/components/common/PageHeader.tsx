import React from 'react';
import { Breadcrumb } from 'antd';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  breadcrumbs?: { name: string; path?: string }[];
  extra?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, breadcrumbs = [], extra }) => {
  return (
    <div style={{ marginBottom: 16 }}>
      {breadcrumbs.length > 0 && (
        <Breadcrumb style={{ marginBottom: 8 }}>
          {breadcrumbs.map((b, i) => (
            <Breadcrumb.Item key={i}>
              {b.path ? <Link to={b.path}>{b.name}</Link> : b.name}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {extra && <div>{extra}</div>}
      </div>
    </div>
  );
};

export default PageHeader;