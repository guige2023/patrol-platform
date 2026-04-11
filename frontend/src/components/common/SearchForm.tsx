import React from 'react';
import { Form, Input, Button, Space } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';

interface SearchFormProps {
  fields: { name: string; label: string; placeholder?: string; type?: 'input' | 'select' }[];
  onSearch: (values: Record<string, any>) => void;
  onReset?: () => void;
}

const SearchForm: React.FC<SearchFormProps> = ({ fields, onSearch, onReset }) => {
  const [form] = Form.useForm();

  return (
    <Form form={form} layout="inline" onFinish={onSearch} style={{ marginBottom: 16 }}>
      {fields.map((field) => (
        <Form.Item key={field.name} name={field.name} label={field.label}>
          <Input placeholder={field.placeholder || field.label} />
        </Form.Item>
      ))}
      <Form.Item>
        <Space>
          <Button type="primary" icon={<SearchOutlined />} htmlType="submit">搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { form.resetFields(); onReset?.(); }}>重置</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default SearchForm;