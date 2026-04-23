import React, { useState, useEffect } from 'react';
import { Tabs, Card, Form, InputNumber, Switch, Select, Button, message, Alert, Space, Input } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getSystemConfigs, updateSystemConfig } from '@/api/systemConfigs';

interface ConfigValue {
  [key: string]: string;
}

type FieldType = 'number' | 'switch' | 'select' | 'json';

interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  min?: number;
  max?: number;
  options?: { label: string; value: string }[];
}

const SystemConfigPage: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('time_nodes');

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const data = await getSystemConfigs();
      // Convert array of {key, value} to object
      const configObj: ConfigValue = {};
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          configObj[item.key] = item.value;
        });
      }
      form.setFieldsValue(configObj);
    } catch {
      message.error('加载配置失败');
    }
  };

  const handleSave = async () => {
    const values = form.getFieldsValue();
    setSaving(true);
    try {
      // Get all field definitions for type checking
      const allFields = [...timeNodesFields, ...matchRulesFields, ...warningRulesFields];
      const fieldTypeMap: Record<string, string> = {};
      allFields.forEach(f => { fieldTypeMap[f.name] = f.type; });

      // Save each config
      const savePromises = Object.entries(values).map(([key, value]) => {
        if (fieldTypeMap[key] === 'json' && typeof value === 'string') {
          // JSON fields: try to parse and store as JSON string, or keep as-is
          try {
            JSON.parse(value); // validate JSON
          } catch {
            // Not valid JSON, keep as-is so user can fix it
          }
          return updateSystemConfig(key, value ?? '');
        }
        return updateSystemConfig(key, String(value ?? ''));
      });
      await Promise.all(savePromises);
      message.success('保存成功');
      fetchConfigs();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 巡察周期配置 - 分类显示
  const cycleConfigGovFields: FieldDef[] = [
    { name: 'gov_cycle_start_date', label: '每轮全覆盖开始时间', type: 'number', min: 2000, max: 2100 },
    { name: 'gov_cycle_years', label: '每轮全覆盖年份数', type: 'number', min: 1, max: 10 },
  ];

  const cycleConfigOtherFields: FieldDef[] = [
    { name: 'other_cycle_start_date', label: '每轮全覆盖开始时间', type: 'number', min: 2000, max: 2100 },
    { name: 'other_cycle_years', label: '每轮全覆盖年份数', type: 'number', min: 1, max: 10 },
  ];

  const timeNodesFields: FieldDef[] = [
    { name: 'regular_inspection_days', label: '常规巡察天数', type: 'number', min: 1, max: 365 },
    { name: 'special_inspection_days', label: '专项巡察天数', type: 'number', min: 1, max: 365 },
    { name: 'supervision_week_min', label: '巡驻时间最小周数', type: 'number', min: 1, max: 52 },
    { name: 'supervision_week_max', label: '巡驻时间最大周数', type: 'number', min: 1, max: 52 },
    { name: 'midterm_week', label: '中期汇报周数', type: 'number', min: 1, max: 52 },
    { name: 'rectification_months_min', label: '整改期限最小月数', type: 'number', min: 1, max: 24 },
    { name: 'rectification_months_max', label: '整改期限最大月数', type: 'number', min: 1, max: 24 },
    { name: 'reinspection_months_min', label: '回头看最小月数', type: 'number', min: 1, max: 24 },
    { name: 'reinspection_months_max', label: '回头看最大月数', type: 'number', min: 1, max: 24 },
  ];

  const matchRulesFields: FieldDef[] = [
    { name: 'leader_min_rank', label: '组长最低职级', type: 'select', options: [
      { label: '科员', value: 'staff' },
      { label: '副科', value: 'deputy_section' },
      { label: '正科', value: 'section' },
      { label: '副处', value: 'deputy_division' },
      { label: '正处', value: 'division' },
      { label: '副厅', value: 'deputy_bureau' },
      { label: '正厅', value: 'bureau' },
    ]},
    { name: 'leader_party_required', label: '组长必须为党员', type: 'switch' },
    { name: 'leader_age_limit_male', label: '组长男性年龄上限', type: 'number', min: 50, max: 70 },
    { name: 'leader_age_limit_female', label: '组长女性年龄上限', type: 'number', min: 50, max: 65 },
    { name: 'deputy_min_rank', label: '副组长最低职级', type: 'select', options: [
      { label: '科员', value: 'staff' },
      { label: '副科', value: 'deputy_section' },
      { label: '正科', value: 'section' },
      { label: '副处', value: 'deputy_division' },
      { label: '正处', value: 'division' },
    ]},
    { name: 'deputy_party_required', label: '副组长必须为党员', type: 'switch' },
    { name: 'max_deputy_count', label: '副组长最大人数', type: 'number', min: 1, max: 5 },
    { name: 'member_party_required', label: '组员必须为党员', type: 'switch' },
    { name: 'member_age_limit_male', label: '组员男性年龄上限', type: 'number', min: 50, max: 70 },
    { name: 'member_age_limit_female', label: '组员女性年龄上限', type: 'number', min: 50, max: 65 },
    { name: 'exclude_same_unit', label: '禁止同单位人员同组', type: 'switch' },
    { name: 'exclude_parent_unit', label: '禁止上级单位人员同组', type: 'switch' },
    { name: 'exclude_child_unit', label: '禁止下级单位人员同组', type: 'switch' },
    { name: 'match_by_tags', label: '按标签匹配', type: 'switch' },
    { name: 'tag_match_rules', label: '标签匹配规则（JSON）', type: 'json' },
    { name: 'default_cadre_categories', label: '默认干部类别', type: 'select', options: [
      { label: '组员库', value: '组员库' },
      { label: '组长库', value: '组长库' },
      { label: '纪委', value: '纪委' },
      { label: '综合干部', value: '综合干部' },
      { label: '后备干部', value: '后备干部' },
    ]},
    { name: 'max_group_members', label: '巡察组最大人数', type: 'number', min: 3, max: 20 },
    { name: 'min_group_members', label: '巡察组最小人数', type: 'number', min: 3, max: 10 },
  ];

  const warningRulesFields: FieldDef[] = [
    { name: 'warning_enabled_pending', label: '待整改预警', type: 'switch' },
    { name: 'warning_enabled_rectifying', label: '整改中预警', type: 'switch' },
    { name: 'warning_enabled_overdue', label: '已逾期预警', type: 'switch' },
    { name: 'warning_enabled_uninspected', label: '未巡察单位预警', type: 'switch' },
    { name: 'uninspected_warning_years', label: '未巡察预警年限', type: 'number', min: 1, max: 10 },
    { name: 'advance_warning_days', label: '提前预警天数', type: 'number', min: 1, max: 30 },
  ];

  const renderFormItems = (fields: FieldDef[]) => {
    return fields.map(field => {
      if (field.type === 'switch') {
        return (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            valuePropName="checked"
            style={{ marginBottom: 16 }}
          >
            <Switch />
          </Form.Item>
        );
      }
      if (field.type === 'select') {
        return (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            style={{ marginBottom: 16 }}
          >
            <Select
              style={{ width: 200 }}
              options={field.options}
            />
          </Form.Item>
        );
      }
      if (field.type === 'json') {
        return (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            style={{ marginBottom: 16 }}
          >
            <Input.TextArea
              rows={4}
              placeholder='如：{"财务": ["财务干部"], "审计": ["审计干部"]}'
              style={{ width: 400, fontFamily: 'monospace' }}
            />
          </Form.Item>
        );
      }
      return (
        <Form.Item
          key={field.name}
          name={field.name}
          label={field.label}
          style={{ marginBottom: 16 }}
        >
          <InputNumber
            min={field.min}
            max={field.max}
            style={{ width: 200 }}
          />
        </Form.Item>
      );
    });
  };

  const tabItems = [
    {
      key: 'time_nodes',
      label: '巡察时间节点',
      children: (
        <Card>
          <Alert
            message="提示：以下配置用于计算巡察各阶段的时间节点，请根据实际情况设置。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form form={form} layout="vertical">
            {renderFormItems(timeNodesFields)}
          </Form>
        </Card>
      ),
    },
    {
      key: 'match_rules',
      label: '巡察组匹配规则',
      children: (
        <Card>
          <Alert
            message="提示：以下配置用于自动匹配巡察组成员时的资格校验规则。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form form={form} layout="vertical">
            {renderFormItems(matchRulesFields)}
          </Form>
        </Card>
      ),
    },
    {
      key: 'warning_rules',
      label: '预警规则',
      children: (
        <Card>
          <Alert
            message="提示：以下配置用于控制各类预警的开关和阈值。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form form={form} layout="vertical">
            {renderFormItems(warningRulesFields)}
          </Form>
        </Card>
      ),
    },
    {
      key: 'cycle_config',
      label: '巡察周期配置',
      children: (
        <Card>
          <Alert
            message="提示：以下配置用于计算被巡察单位的全覆盖预警时间。管委会/政府部门和其他单位使用独立的巡察周期配置。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form form={form} layout="vertical">
            <div style={{ marginBottom: 24, padding: '12px 16px', background: '#f5f5f5', borderRadius: 6 }}>
              <div style={{ fontWeight: 500, marginBottom: 12, color: '#1890ff' }}>管委会/政府部门</div>
              {renderFormItems(cycleConfigGovFields)}
            </div>
            <div style={{ marginBottom: 24, padding: '12px 16px', background: '#f5f5f5', borderRadius: 6 }}>
              <div style={{ fontWeight: 500, marginBottom: 12, color: '#52c41a' }}>其他单位</div>
              {renderFormItems(cycleConfigOtherFields)}
            </div>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="系统配置"
        breadcrumbs={[
          { name: '系统管理' },
          { name: '系统配置' },
        ]}
      />

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            保存配置
          </Button>
          <span style={{ color: '#888', fontSize: 12 }}>
            配置修改后将自动保存
          </span>
        </Space>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default SystemConfigPage;
