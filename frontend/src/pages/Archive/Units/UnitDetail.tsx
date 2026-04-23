import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Select, InputNumber, Space, Tabs, Table, Tag } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { TeamOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getUnitDetail, updateUnit, getUnits } from '@/api/units';
import { getCadres } from '@/api/cadres';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import { getErrorMessage } from '@/utils/error';

interface Unit {
  id: string;
  name: string;
  org_code: string;
  parent_id?: string;
  unit_type?: string;
  level?: string;
  sort_order?: number;
  tags?: Record<string, string>;
  business_tags?: string[];
  profile?: string;
  leadership?: Record<string, string>;
  contact?: Record<string, string>;
  last_inspection_year?: number;
  inspection_history?: string;
  is_active: boolean;
}

const UnitDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [form] = Form.useForm();
  const { getOptions } = useFieldOptions();
  const unitTypeOptions = getOptions('unit_type');
  const unitLevelOptions = getOptions('unit_level');
  const [activeTab, setActiveTab] = useState('info');

  // 关联干部
  const [cadres, setCadres] = useState<any[]>([]);
  const [cadresLoading, setCadresLoading] = useState(false);

  // Parent unit options
  const [parentOptions, setParentOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (id) {
      getUnitDetail(id).then((res: Unit) => {
        setUnit(res);
        const values: any = { ...res };
        // Flatten tags dict
        if (res.tags && typeof res.tags === 'object') {
          Object.entries(res.tags).forEach(([k, v]) => {
            values[`tag_${k}`] = v;
          });
        }
        // Flatten leadership dict
        if (res.leadership && typeof res.leadership === 'object') {
          Object.entries(res.leadership).forEach(([k, v]) => {
            values[`leadership_${k}`] = v;
          });
        }
        // Flatten contact dict
        if (res.contact && typeof res.contact === 'object') {
          Object.entries(res.contact).forEach(([k, v]) => {
            values[`contact_${k}`] = v;
          });
        }
        form.setFieldsValue(values);
      }).catch(console.error);
    }
  }, [id]);

  useEffect(() => {
    // Load all units for parent dropdown
    getUnits({ page: 1, page_size: 999 }).then(res => {
      setParentOptions(
        res.items
          .filter((u: Unit) => u.id !== id)
          .map((u: Unit) => ({ label: u.name, value: u.id }))
      );
    }).catch(console.error);
  }, [id]);

  // 加载关联干部
  const loadCadres = async () => {
    if (!id) return;
    setCadresLoading(true);
    try {
      const res = await getCadres({ unit_id: id as string, page: 1, page_size: 999 });
      setCadres(res.items || []);
    } catch {
      message.error('加载干部列表失败');
    } finally {
      setCadresLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'cadres') {
      loadCadres();
    }
  }, [activeTab, id]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // Reconstruct complex fields
      const result: any = { ...values };
      const tagKeys = ['has_party', 'party_form', 'party_members'];
      const tagFields: Record<string, string> = {};
      tagKeys.forEach(k => {
        if (result[`tag_${k}`] !== undefined) {
          tagFields[k] = result[`tag_${k}`];
          delete result[`tag_${k}`];
        }
      });
      if (Object.keys(tagFields).length > 0) result.tags = tagFields;

      const leadKeys = ['name', 'position'];
      const leadFields: Record<string, string> = {};
      leadKeys.forEach(k => {
        if (result[`leadership_${k}`] !== undefined) {
          leadFields[k] = result[`leadership_${k}`];
          delete result[`leadership_${k}`];
        }
      });
      if (Object.keys(leadFields).length > 0) result.leadership = leadFields;

      const contactKeys = ['person', 'phone', 'staff_count'];
      const contactFields: Record<string, string> = {};
      contactKeys.forEach(k => {
        if (result[`contact_${k}`] !== undefined) {
          contactFields[k] = result[`contact_${k}`];
          delete result[`contact_${k}`];
        }
      });
      if (Object.keys(contactFields).length > 0) result.contact = contactFields;

      await updateUnit(id!, result);
      message.success('保存成功');
      navigate('/archive/units');
    } catch (e: any) {
      message.error(getErrorMessage(e) || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const cadreColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '职务', dataIndex: 'position', key: 'position', render: (v: string) => v || '-' },
    { title: '职级', dataIndex: 'rank', key: 'rank', render: (v: string) => v || '-' },
    { title: '类别', dataIndex: 'category', key: 'category', render: (v: string) => v || '-' },
    {
      title: '是否可用',
      dataIndex: 'is_available',
      key: 'is_available',
      render: (v: boolean) => v ? <Tag color="green">可用</Tag> : <Tag color="red">不可用</Tag>,
    },
  ];

  const formItemRow = (children: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{children}</div>
  );

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: (
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="单位名称" rules={[{ required: true, message: '请输入单位名称' }]}>
            <Input placeholder="请输入单位名称" />
          </Form.Item>
          <Form.Item name="org_code" label="组织编码" rules={[{ required: true, message: '请输入组织编码' }]}>
            <Input placeholder="请输入组织编码" />
          </Form.Item>
          {formItemRow(
            <>
              <Form.Item name="unit_type" label="单位类型" style={{ marginBottom: 0 }}>
                <Select options={unitTypeOptions} placeholder="请选择单位类型" />
              </Form.Item>
              <Form.Item name="level" label="级别" style={{ marginBottom: 0 }}>
                <Select options={unitLevelOptions} placeholder="请选择级别" allowClear />
              </Form.Item>
            </>
          )}
          {formItemRow(
            <>
              <Form.Item name="parent_id" label="上级单位" style={{ marginBottom: 0 }}>
                <Select options={parentOptions} placeholder="请选择上级单位（可选）" allowClear showSearch />
              </Form.Item>
              <Form.Item name="sort_order" label="排序" style={{ marginBottom: 0 }}>
                <InputNumber style={{ width: '100%' }} placeholder="数字越小越靠前" min={0} />
              </Form.Item>
            </>
          )}
          <Form.Item name="profile" label="单位简介">
            <Input.TextArea rows={2} placeholder="请输入单位简介" />
          </Form.Item>

          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#262626' }}>业务标签</div>
          <Form.Item name="business_tags" label="业务标签" style={{ marginBottom: 12 }}>
            <Select
              mode="tags"
              placeholder="输入业务标签后按回车添加，如：财务、审计、纪检监察等"
              style={{ width: '100%' }}
              tokenSeparators={[',', '，']}
            />
          </Form.Item>

          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#262626' }}>党组织情况</div>
          {formItemRow(
            <>
              <Form.Item name="tag_has_party" label="是否具有党组织" style={{ marginBottom: 0 }}>
                <Select options={[{label:'是',value:'是'},{label:'否',value:'否'}]} placeholder="请选择" allowClear />
              </Form.Item>
              <Form.Item name="tag_party_form" label="党组织形式" style={{ marginBottom: 0 }}>
                <Input placeholder="如党委/党支部/党总支" />
              </Form.Item>
            </>
          )}
          <Form.Item name="tag_party_members" label="党员数">
            <Input placeholder="请输入党员数量" />
          </Form.Item>

          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#262626' }}>负责人信息</div>
          {formItemRow(
            <>
              <Form.Item name="leadership_name" label="负责人姓名" style={{ marginBottom: 0 }}>
                <Input placeholder="请输入负责人姓名" />
              </Form.Item>
              <Form.Item name="leadership_position" label="职务" style={{ marginBottom: 0 }}>
                <Input placeholder="请输入职务" />
              </Form.Item>
            </>
          )}

          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#262626' }}>联系信息</div>
          {formItemRow(
            <>
              <Form.Item name="contact_person" label="联系人" style={{ marginBottom: 0 }}>
                <Input placeholder="请输入联系人姓名" />
              </Form.Item>
              <Form.Item name="contact_phone" label="联系电话" style={{ marginBottom: 0 }}>
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </>
          )}
          <Form.Item name="contact_staff_count" label="编制人数">
            <InputNumber style={{ width: '100%' }} placeholder="请输入编制人数" min={0} />
          </Form.Item>

          {formItemRow(
            <>
              <Form.Item name="last_inspection_year" label="最近巡察年份" style={{ marginBottom: 0 }}>
                <InputNumber style={{ width: '100%' }} placeholder="如 2021" min={1900} max={2100} />
              </Form.Item>
              <Form.Item name="inspection_history" label="巡察历史" style={{ marginBottom: 0 }}>
                <Input placeholder="如 2021年第一轮、2023年第二轮" />
              </Form.Item>
            </>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
              <Button onClick={() => navigate('/archive/units')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'cadres',
      label: (
        <span>
          <TeamOutlined /> 关联干部（{cadres.length > 0 ? cadres.length : ''}）
        </span>
      ),
      children: (
        <Table
          rowKey="id"
          loading={cadresLoading}
          dataSource={cadres}
          columns={cadreColumns}
          pagination={{ pageSize: 20, size: 'small' }}
          size="small"
          locale={{ emptyText: '暂无关联干部' }}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="单位详情"
        breadcrumbs={[
          { name: '档案管理' },
          { name: '单位档案', path: '/archive/units' },
          { name: unit?.name || '单位详情' },
        ]}
      />
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
    </div>
  );
};

export default UnitDetail;
