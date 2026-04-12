import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Switch, Button, Card, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { getKnowledgeDetail, updateKnowledge } from '@/api/knowledge';
import { getErrorMessage } from '@/utils/error';

const KnowledgeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (id) {
      getKnowledgeDetail(id).then((data: any) => {
        form.setFieldsValue(data);
      }).catch(console.error);
    }
  }, [id]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await updateKnowledge(id!, values);
      message.success('保存成功');
      navigate('/archive/knowledge');
    } catch (e: any) {
      message.error(getErrorMessage(e) || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="知识详情" breadcrumbs={[{ name: '档案管理' }, { name: '知识库', path: '/archive/knowledge' }, { name: '知识详情' }]} />
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select placeholder="请选择分类">
              <Select.Option value="regulation">法规</Select.Option>
              <Select.Option value="policy">政策</Select.Option>
              <Select.Option value="dict">制度</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="version" label="版本">
            <Input placeholder="请输入版本" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="请输入标签">
            </Select>
          </Form.Item>
          <Form.Item name="is_published" label="已发布" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate('/archive/knowledge')}>取消</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default KnowledgeDetail;
