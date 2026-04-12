import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { getUnitDetail, updateUnit } from '@/api/units';

const UnitDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (id) {
      getUnitDetail(id).then((res: any) => {
        form.setFieldsValue(res);
      }).catch(console.error);
    }
  }, [id]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await updateUnit(id!, values);
      message.success('保存成功');
      navigate('/archive/units');
    } catch (e: any) {
      message.error(e.response?.data?.detail || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="单位详情" breadcrumbs={[{ name: '档案管理' }, { name: '单位档案', path: '/archive/units' }, { name: '单位详情' }]} />
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="单位名称" rules={[{ required: true, message: '请输入单位名称' }]}>
            <Input placeholder="请输入单位名称" />
          </Form.Item>
          <Form.Item name="org_code" label="组织编码" rules={[{ required: true, message: '请输入组织编码' }]}>
            <Input placeholder="请输入组织编码" />
          </Form.Item>
          <Form.Item name="unit_type" label="类型">
            <Input placeholder="请输入类型" />
          </Form.Item>
          <Form.Item name="level" label="级别">
            <Input type="number" placeholder="请输入级别" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate('/archive/units')}>取消</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default UnitDetail;
