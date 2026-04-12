import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Switch, Button, Card, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { getCadreDetail, updateCadre } from '@/api/cadres';

const CadreDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (id) {
      getCadreDetail(id).then((res: any) => {
        form.setFieldsValue(res);
      }).catch(console.error);
    }
  }, [id]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await updateCadre(id!, values);
      message.success('保存成功');
      navigate('/archive/cadres');
    } catch (e: any) {
      message.error(e.response?.data?.detail || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="干部详情" breadcrumbs={[{ name: '档案管理' }, { name: '干部人才库', path: '/archive/cadres' }, { name: '干部详情' }]} />
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="gender" label="性别">
            <Select placeholder="请选择性别">
              <Select.Option value="男">男</Select.Option>
              <Select.Option value="女">女</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="position" label="职务">
            <Input placeholder="请输入职务" />
          </Form.Item>
          <Form.Item name="rank" label="职级">
            <Input placeholder="请输入职级" />
          </Form.Item>
          <Form.Item name="unit_id" label="所属单位">
            <Input placeholder="请输入单位ID" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="请输入标签">
            </Select>
          </Form.Item>
          <Form.Item name="is_available" label="可用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate('/archive/cadres')}>取消</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CadreDetail;
