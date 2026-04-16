import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Steps, Form, Input, Button, Card, Upload, message, Alert, Space } from 'antd';
import { UserOutlined, BankOutlined, TeamOutlined, CheckCircleOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import api from '@/api/client';

const { Password } = Input;

interface InitWizardProps {
  onComplete?: () => void;
}

const InitWizard: React.FC<InitWizardProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [adminForm] = Form.useForm();
  const [cadreFileList, setCadreFileList] = useState<UploadFile[]>([]);
  const [unitFileList, setUnitFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [importingCadres, setImportingCadres] = useState(false);
  const [importingUnits, setImportingUnits] = useState(false);

  const steps = [
    { title: '创建管理员', description: '创建系统管理员账号', icon: <UserOutlined /> },
    { title: '导入干部', description: '导入干部人才数据（可选）', icon: <TeamOutlined /> },
    { title: '导入单位', description: '导入单位档案数据（可选）', icon: <BankOutlined /> },
    { title: '完成', description: '完成系统初始化', icon: <CheckCircleOutlined /> },
  ];

  const handleCreateAdmin = async () => {
    try {
      const values = await adminForm.validateFields();
      if (values.password !== values.confirm_password) {
        message.error('两次输入的密码不一致');
        return;
      }
      setSubmitting(true);
      await api.post('/auth/init', {
        username: values.username,
        password: values.password,
        full_name: values.full_name,
      });
      message.success('管理员账号创建成功');
      setCurrentStep(1);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportCadres = async () => {
    if (cadreFileList.length === 0 || !cadreFileList[0]?.originFileObj) {
      setCurrentStep(2);
      return;
    }
    setImportingCadres(true);
    try {
      const formData = new FormData();
      formData.append('file', cadreFileList[0].originFileObj as Blob);
      await api.post('/cadres/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('干部数据导入成功');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '导入失败');
    } finally {
      setImportingCadres(false);
      setCurrentStep(2);
    }
  };

  const handleImportUnits = async () => {
    if (unitFileList.length === 0 || !unitFileList[0]?.originFileObj) {
      handleComplete();
      return;
    }
    setImportingUnits(true);
    try {
      const formData = new FormData();
      formData.append('file', unitFileList[0].originFileObj as Blob);
      await api.post('/units/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('单位数据导入成功');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '导入失败');
    } finally {
      setImportingUnits(false);
      handleComplete();
    }
  };

  const handleComplete = () => {
    const adminValues = adminForm.getFieldsValue();
    api.post('/auth/login', {
      username: adminValues.username,
      password: adminValues.password,
    }).then(res => {
      const { access_token } = res as unknown as { access_token: string };
      localStorage.setItem('token', access_token);
      message.success('系统初始化完成');
      onComplete?.();
      navigate('/');
    }).catch(() => {
      navigate('/login');
    });
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card title="创建系统管理员">
            <Alert
              message="这是系统初始化步骤，请创建管理员账号"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            <Form form={adminForm} layout="vertical" style={{ maxWidth: 400 }}>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" />
              </Form.Item>
              <Form.Item
                name="full_name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Password placeholder="请输入密码" />
              </Form.Item>
              <Form.Item
                name="confirm_password"
                label="确认密码"
                rules={[{ required: true, message: '请确认密码' }]}
              >
                <Password placeholder="请再次输入密码" />
              </Form.Item>
            </Form>
          </Card>
        );
      case 1:
        return (
          <Card title="导入干部人才数据">
            <Alert
              message="您可以选择导入干部人才数据，也可以稍后在系统中手动添加"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            <Upload
              fileList={cadreFileList}
              onChange={({ fileList }) => setCadreFileList(fileList)}
              beforeUpload={() => false}
              accept=".xlsx"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择 Excel 文件</Button>
            </Upload>
            <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
              <p>必填列：姓名*；可选列：性别、职务、职级、类别、所属单位</p>
            </div>
            <div style={{ marginTop: 24 }}>
              <Space>
                <Button onClick={() => setCurrentStep(2)}>跳过</Button>
                <Button type="primary" onClick={handleImportCadres} loading={importingCadres}>
                  导入并继续
                </Button>
              </Space>
            </div>
          </Card>
        );
      case 2:
        return (
          <Card title="导入单位档案数据">
            <Alert
              message="您可以选择导入单位档案数据，也可以稍后在系统中手动添加"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            <Upload
              fileList={unitFileList}
              onChange={({ fileList }) => setUnitFileList(fileList)}
              beforeUpload={() => false}
              accept=".xlsx"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择 Excel 文件</Button>
            </Upload>
            <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
              <p>必填列：单位名称*；可选列：单位类型、上级单位、简介</p>
            </div>
            <div style={{ marginTop: 24 }}>
              <Space>
                <Button onClick={() => handleComplete()}>跳过</Button>
                <Button type="primary" onClick={handleImportUnits} loading={importingUnits}>
                  导入并完成
                </Button>
              </Space>
            </div>
          </Card>
        );
      case 3:
        return (
          <Card title="系统初始化完成">
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
              <h2 style={{ marginTop: 24 }}>系统初始化完成！</h2>
              <p style={{ color: '#666', marginTop: 16 }}>
                管理员账号已创建，系统已准备就绪。
              </p>
              <Button type="primary" size="large" onClick={handleComplete} style={{ marginTop: 24 }}>
                进入系统
              </Button>
            </div>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f2f5',
      padding: '24px',
    }}>
      <Card style={{ width: 600 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>巡察工作管理平台</h1>
          <p style={{ color: '#666' }}>系统初始化向导</p>
        </div>

        <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />

        {renderStepContent()}

        {currentStep < 3 && currentStep > 0 && (
          <div style={{ marginTop: 24 }}>
            <Space>
              <Button onClick={handleBack}>上一步</Button>
            </Space>
          </div>
        )}

        {currentStep === 0 && (
          <div style={{ marginTop: 24 }}>
            <Button type="primary" onClick={handleCreateAdmin} loading={submitting}>
              创建管理员并继续
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default InitWizard;
