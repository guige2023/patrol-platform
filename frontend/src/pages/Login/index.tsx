import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import api from '@/api/client';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { login: _login } = useAuthStore();
  const formRef = useRef<HTMLFormElement>(null);

  // 支持自动化登录：URL 参数或 localStorage 预填
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get('u');
    const p = params.get('p');
    if (u && p) {
      setUsername(u);
      setPassword(p);
      // 自动提交
      setTimeout(() => {
        handleSubmit(u, p);
      }, 100);
    }
  }, []);

  const handleSubmit = async (user?: string, pwd?: string) => {
    const u = user ?? username;
    const p = pwd ?? password;
    console.log('[Login] handleSubmit called:', { user, pwd, u, p, username, password });
    if (!u || !p) {
      message.error('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ access_token: string; token_type: string; user: any }>('/auth/login', { username: u, password: p });
      const { access_token } = res.data;
      localStorage.setItem('token', access_token);
      message.success('登录成功');
      navigate('/');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>徐圩新区巡察工作管理平台</h1>
          <p style={{ color: '#666' }}>请登录您的账号</p>
        </div>
        <form ref={formRef} onSubmit={onFormSubmit}>
          <div style={{ marginBottom: 16 }}>
            <Input
              id="login-username"
              prefix={<UserOutlined />}
              placeholder="用户名"
              size="large"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Input.Password
              id="login-password"
              prefix={<LockOutlined />}
              placeholder="密码"
              size="large"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loading}
          >
            登录
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Login;
