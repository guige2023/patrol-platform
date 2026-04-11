import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, theme } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  DashboardOutlined,
  BankOutlined,
  TeamOutlined,
  BookOutlined,
  ProjectOutlined,
  FileTextOutlined,
  AlertOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '数据看板' },
    { key: '/archive', icon: <BankOutlined />, label: '档案管理', children: [
      { key: '/archive/units', label: '单位档案' },
      { key: '/archive/cadres', label: '干部人才' },
      { key: '/archive/knowledge', label: '知识库' },
    ]},
    { key: '/plan', icon: <ProjectOutlined />, label: '巡察计划', children: [
      { key: '/plan/plans', label: '计划管理' },
      { key: '/plan/groups', label: '巡察组' },
    ]},
    { key: '/execution', icon: <FileTextOutlined />, label: '执纪执行', children: [
      { key: '/execution/drafts', label: '底稿管理' },
      { key: '/execution/clues', label: '线索管理' },
      { key: '/execution/rectifications', label: '整改督办' },
    ]},
    { key: '/admin', icon: <SettingOutlined />, label: '系统管理', children: [
      { key: '/admin/users', label: '用户管理' },
      { key: '/admin/modules', label: '模块配置' },
      { key: '/admin/audit', label: '审计日志' },
    ]},
  ];

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
    ],
    onClick: ({ key }: any) => {
      if (key === 'logout') {
        logout();
        navigate('/login');
      }
    },
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 'bold' }}>
          {collapsed ? '巡' : '巡察工作管理平台'}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Dropdown menu={userMenu}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1890ff' }}>{user?.full_name?.[0] || 'U'}</Avatar>
              <span>{user?.full_name || '用户'}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;