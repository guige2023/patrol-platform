import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Popconfirm } from 'antd';
import { SafetyOutlined, LockOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { changePassword } from '@/api/auth';
import { getErrorMessage } from '@/utils/error';

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: { old_password: string; new_password: string; confirm_password: string }) => {
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的新密码不一致');
      return;
    }
    if (values.new_password.length < 6) {
      message.error('新密码长度不能少于6位');
      return;
    }
    setLoading(true);
    try {
      await changePassword(values.old_password, values.new_password);
      message.success('密码修改成功');
      form.resetFields();
    } catch (e: any) {
      const detail = getErrorMessage(e);
      if (detail?.includes('incorrect') || detail?.includes('错误') || detail?.includes('不正确')) {
        message.error('旧密码错误');
      } else {
        message.error(detail || '修改失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="个人设置" breadcrumbs={[{ name: '个人设置' }]} />
      <Card
        title={<><SafetyOutlined /> 修改密码</>}
        style={{ maxWidth: 480 }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="old_password"
            label="旧密码"
            rules={[{ required: true, message: '请输入旧密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '新密码长度不能少于6位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>
          <Form.Item>
            <Popconfirm
              title="确认修改密码？"
              onConfirm={() => form.submit()}
              okText="确认"
              cancelText="取消"
            >
              <Button type="primary" block loading={loading}>
                确认修改
              </Button>
            </Popconfirm>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Settings;
