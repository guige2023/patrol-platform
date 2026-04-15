import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, theme } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  DashboardOutlined,
  BankOutlined,
  ProjectOutlined,
  FileTextOutlined,
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
    token: { borderRadiusLG },
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
      { key: '/admin/roles', label: '角色管理' },
      { key: '/admin/modules', label: '模块配置' },
      { key: '/admin/fields', label: '字段配置' },
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

  // 判断当前路径是否被选中
  const getSelectedKeys = () => {
    const path = location.pathname;
    // 精确匹配
    if (menuItems.some(item => item.key === path)) {
      return [path];
    }
    // 处理子菜单路径
    const parentPath = '/' + path.split('/').slice(1, 3).join('/');
    if (menuItems.some(item => item.key === parentPath)) {
      return [parentPath];
    }
    return [location.pathname];
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 - 深红渐变背景 */}
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        style={{
          background: 'linear-gradient(180deg, #9B1C1C 0%, #8B0000 50%, #6B0000 100%)',
          minHeight: '100vh',
          boxShadow: '2px 0 8px rgba(139, 0, 0, 0.3)',
        }}
      >
        {/* Logo 区域 */}
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'white', 
          fontSize: 18, 
          fontWeight: 'bold',
          background: 'rgba(0, 0, 0, 0.1)',
          borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
        }}>
          {collapsed ? (
            <span style={{ fontSize: 24 }}>🏛️</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>🏛️</span>
              <span>徐圩新区巡察工作管理平台</span>
            </div>
          )}
        </div>
        
        {/* 菜单 - 白色文字，选中金色左边框 */}
        <Menu 
          theme="dark" 
          mode="inline" 
          selectedKeys={getSelectedKeys()} 
          items={menuItems} 
          onClick={({ key }) => navigate(key)}
          style={{ 
            background: 'transparent',
            borderRight: 'none',
          }}
        />
      </Sider>
      
      <Layout>
        {/* 顶部栏 - 深红背景 */}
        <Header style={{ 
          padding: '0 24px', 
          background: 'linear-gradient(90deg, #9B1C1C 0%, #8B0000 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-end',
          boxShadow: '0 2px 8px rgba(139, 0, 0, 0.3)',
        }}>
          <Dropdown menu={userMenu}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              cursor: 'pointer',
              color: 'white',
              padding: '8px 12px',
              borderRadius: 8,
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            >
              <Avatar style={{ 
                backgroundColor: '#FFD700', 
                color: '#8B0000',
                fontWeight: 'bold',
                border: '2px solid rgba(255, 215, 0, 0.5)',
              }}>
                {user?.full_name?.[0] || 'U'}
              </Avatar>
              <span style={{ fontWeight: 500 }}>{user?.full_name || '用户'}</span>
            </div>
          </Dropdown>
        </Header>
        
        {/* 内容区域 */}
        <Content style={{ 
          margin: 16, 
          padding: 24, 
          background: '#FFF5F5', 
          borderRadius: borderRadiusLG,
          minHeight: 'calc(100vh - 64px - 32px)',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
