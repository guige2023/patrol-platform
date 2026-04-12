import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Tag } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import {
  getFieldOptions, updateFieldOption, FieldOption, OptionItem,
} from '@/api/fieldOptions';
import { getErrorMessage } from '@/utils/error';
import { useFieldOptions as useGlobalFieldOptions } from '@/hooks/useFieldOptions';

const FieldOptionsConfig: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FieldOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldOption | null>(null);
  const [form] = Form.useForm();
  const [optionsList, setOptionsList] = useState<OptionItem[]>([]);
  const { refresh } = useGlobalFieldOptions();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getFieldOptions();
      setData(res || []);
    } catch (e: any) {
      message.error(getErrorMessage(e) || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openEdit = (record: FieldOption) => {
    setEditingField(record);
    form.setFieldsValue({ label: record.label });
    setOptionsList([...record.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!editingField) return;
    try {
      const values = await form.validateFields();
      const opts = optionsList.map((o, i) => ({ ...o, sort_order: i }));
      if (!values.label.trim()) {
        message.error('显示名称不能为空');
        return;
      }
      if (opts.length === 0) {
        message.error('请至少添加一个选项');
        return;
      }
      await updateFieldOption(editingField.field_key, { label: values.label, options: opts });
      message.success('更新成功');
      setModalOpen(false);
      fetchData();
      refresh(); // 刷新全局上下文，使表单下拉实时更新
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(getErrorMessage(e) || '操作失败');
    }
  };

  const addOption = () => {
    const newOpt: OptionItem = { value: '', label: '', sort_order: optionsList.length };
    setOptionsList([...optionsList, newOpt]);
  };

  const updateOption = (index: number, field: keyof OptionItem, val: string) => {
    const updated = [...optionsList];
    updated[index] = { ...updated[index], [field]: val };
    setOptionsList(updated);
  };

  const removeOption = (index: number) => {
    setOptionsList(optionsList.filter((_, i) => i !== index));
  };

  const moveOption = (index: number, direction: 'up' | 'down') => {
    const newList = [...optionsList];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setOptionsList(newList);
  };

  const columns = [
    {
      title: '字段KEY',
      dataIndex: 'field_key',
      key: 'field_key',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    { title: '显示名称', dataIndex: 'label', key: 'label' },
    {
      title: '选项',
      dataIndex: 'options',
      key: 'options',
      render: (opts: OptionItem[]) => (
        <Space wrap>
          {opts.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(o => (
            <Tag key={o.value} color="green">{o.label}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: FieldOption) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="字段配置"
        breadcrumbs={[{ name: '系统管理' }, { name: '字段配置' }]}
      />
      <div style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
        管理各业务模块下拉选项。只允许编辑已有字段的选项，如需新增字段请联系管理员在数据库中添加。
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="field_key"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={'编辑字段配置'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="label"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="如 单位类型" />
          </Form.Item>

          <div style={{ marginBottom: 8, fontWeight: 600 }}>选项列表（可拖拽排序）</div>
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
            {optionsList.length === 0 && (
              <div style={{ color: '#999', textAlign: 'center', padding: '8px 0' }}>
                暂无选项，请点击下方按钮添加
              </div>
            )}
            {optionsList.map((opt, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: idx < optionsList.length - 1 ? 8 : 0,
                }}
              >
                <span style={{ color: '#999', minWidth: 20 }}>{idx + 1}</span>
                <Input
                  placeholder="值"
                  value={opt.value}
                  onChange={e => updateOption(idx, 'value', e.target.value)}
                  style={{ flex: 1 }}
                />
                <Input
                  placeholder="显示文本"
                  value={opt.label}
                  onChange={e => updateOption(idx, 'label', e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button size="small" onClick={() => moveOption(idx, 'up')} disabled={idx === 0}>↑</Button>
                <Button size="small" onClick={() => moveOption(idx, 'down')} disabled={idx === optionsList.length - 1}>↓</Button>
                <Button size="small" danger onClick={() => removeOption(idx)}>×</Button>
              </div>
            ))}
            <Button type="dashed" onClick={addOption} style={{ marginTop: 8, width: '100%' }}>
              + 添加选项
            </Button>
          </div>

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button type="primary" onClick={handleSubmit}>保存</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default FieldOptionsConfig;
