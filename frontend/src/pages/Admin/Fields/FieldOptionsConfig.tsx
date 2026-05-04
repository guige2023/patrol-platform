import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Switch, Tag, message,
  Popconfirm, Tabs, Drawer, Tooltip, Badge,
} from 'antd';
import {
  EditOutlined, SyncOutlined, PlusOutlined, DeleteOutlined,
  CheckCircleOutlined, StopOutlined, EyeOutlined, EyeInvisibleOutlined,
  FormOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import {
  getFieldOptions, getFieldsByEntity, getEntityTypes,
  discoverFields, syncFields, updateFieldOption, deleteFieldOption,
  FieldOption, FieldOptionSummary, DiscoveredField,
} from '@/api/fieldOptions';
import { getErrorMessage } from '@/utils/error';
import { useFieldOptions as useGlobalFieldOptions } from '@/hooks/useFieldOptions';

const { TextArea } = Input;

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------
const ENTITY_LABELS: Record<string, string> = {
  units:            '单位档案',
  cadres:           '干部人才',
  users:            '用户管理',
  plans:            '巡察计划',
  groups:           '巡察组',
  clues:            '线索管理',
  rectifications:   '整改管理',
  drafts:           '底稿管理',
  documents:        '文档管理',
  knowledge:        '知识库',
};

const ALL_ENTITIES = Object.keys(ENTITY_LABELS);

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------
function dataTypeTag(dt: string) {
  const map: Record<string, { color: string; label: string }> = {
    text:        { color: 'default',  label: '文本' },
    select:      { color: 'blue',     label: '下拉' },
    textarea:    { color: 'orange',  label: '多行文本' },
    varchar:     { color: 'default', label: '文本' },
  };
  const s = map[dt] ?? { color: 'default', label: dt };
  return <Tag color={s.color}>{s.label}</Tag>;
}

// ---------------------------------------------------------------------------
// 选项配置 Modal
// ---------------------------------------------------------------------------
interface OptionsModalProps {
  field: FieldOption | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function OptionsModal({ field, open, onClose, onSaved }: OptionsModalProps) {
  const [form] = Form.useForm();
  const [optionsList, setOptionsList] = useState<{ value: string; label: string; sort_order: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (field) {
      form.setFieldsValue({ label: field.label });
      setOptionsList([...field.options].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    }
  }, [field, form]);

  const addOption = () =>
    setOptionsList(prev => [...prev, { value: '', label: '', sort_order: prev.length }]);

  const updateOption = (idx: number, key: string, val: string) => {
    setOptionsList(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  };

  const removeOption = (idx: number) =>
    setOptionsList(prev => prev.filter((_, i) => i !== idx));

  const moveOption = (idx: number, dir: 'up' | 'down') => {
    setOptionsList(prev => {
      const next = [...prev];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return next;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!field) return;
    try {
      const values = await form.validateFields();
      if (!values.label?.trim()) {
        message.error('显示名称不能为空');
        return;
      }
      const validOpts = optionsList.filter(o => o.value && o.label);
      setSaving(true);
      await updateFieldOption(field.field_key, {
        label: values.label.trim(),
        options: validOpts.map((o, i) => ({ ...o, sort_order: i })),
      });
      message.success('保存成功');
      onSaved();
      onClose();
    } catch (e: any) {
      if (!e.errorFields) message.error(getErrorMessage(e) || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  if (!field) return null;

  return (
    <Modal
      title={`配置选项 — ${field.label}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={620}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="label" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
          <Input placeholder="如：单位类型" />
        </Form.Item>

        <div style={{ marginBottom: 8, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>下拉选项（仅下拉类型有效）</span>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addOption}>添加</Button>
        </div>

        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
          {optionsList.length === 0 && (
            <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>
              暂无选项，点击上方按钮添加
            </div>
          )}
          {optionsList.map((opt, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: idx < optionsList.length - 1 ? 8 : 0 }}>
              <span style={{ color: '#999', minWidth: 20 }}>{idx + 1}</span>
              <Input
                placeholder="值（提交值）"
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
        </div>

        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" loading={saving} onClick={handleSubmit}>保存</Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// 同步新字段 Drawer
// ---------------------------------------------------------------------------
interface SyncDrawerProps {
  entityType: string;
  open: boolean;
  onClose: () => void;
  onSynced: () => void;
}

function SyncDrawer({ entityType, open, onClose, onSynced }: SyncDrawerProps) {
  const [fields, setFields] = useState<DiscoveredField[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (open && entityType) {
      setLoading(true);
      discoverFields(entityType)
        .then((data: DiscoveredField[]) => {
          setFields(data);
          setSelected(new Set(data.map((f: DiscoveredField) => f.field_key)));
        })
        .catch((e: any) => message.error(getErrorMessage(e) || '加载失败'))
        .finally(() => setLoading(false));
    }
  }, [open, entityType]);

  const toggleField = (fk: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(fk)) next.delete(fk);
      else next.add(fk);
      return next;
    });
  };

  const handleSync = async () => {
    if (selected.size === 0) {
      message.warning('请至少选择一个字段');
      return;
    }
    const toSync = fields.filter(f => selected.has(f.field_key));
    setSyncing(true);
    try {
      const result = await syncFields(entityType, toSync);
      message.success(`成功添加 ${result.added} 个字段`);
      onSynced();
      onClose();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const allSelected = fields.length > 0 && selected.size === fields.length;

  return (
    <Drawer
      title={`同步新字段 — ${ENTITY_LABELS[entityType] || entityType}`}
      placement="right"
      width={520}
      open={open}
      onClose={onClose}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              loading={syncing}
              disabled={selected.size === 0}
              onClick={handleSync}
            >
              确认同步 ({selected.size})
            </Button>
          </Space>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
      ) : fields.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#52c41a' }}>
          <CheckCircleOutlined style={{ fontSize: 32 }} />
          <div style={{ marginTop: 8 }}>所有字段已配置，无需同步</div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Button
              type="link"
              size="small"
              onClick={() =>
                setSelected(allSelected ? new Set() : new Set(fields.map((f: DiscoveredField) => f.field_key)))
              }
            >
              {allSelected ? '取消全选' : '全选'}
            </Button>
            <span style={{ color: '#888', fontSize: 12 }}>
              （共 {fields.length} 个未配置字段）
            </span>
          </div>
          {fields.map((f: DiscoveredField) => (
            <div
              key={f.field_key}
              onClick={() => toggleField(f.field_key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                border: '1px solid #f0f0f0',
                borderRadius: 6,
                marginBottom: 8,
                cursor: 'pointer',
                background: selected.has(f.field_key) ? '#f6ffed' : '#fff',
                borderColor: selected.has(f.field_key) ? '#b7eb8f' : '#f0f0f0',
              }}
            >
              <input type="checkbox" checked={selected.has(f.field_key)} readOnly />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{f.column_name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{f.data_type}</div>
              </div>
              {dataTypeTag(f.data_type)}
            </div>
          ))}
        </>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------
const FieldOptionsConfig: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeEntity, setActiveEntity] = useState<string>('units');
  const [fields, setFields] = useState<FieldOptionSummary[]>([]);
  const [allOptions, setAllOptions] = useState<Record<string, FieldOption>>({});
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldOption | null>(null);
  const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);
  const [inlineEditKey, setInlineEditKey] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const { refresh } = useGlobalFieldOptions();

  const fetchFields = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, fullData] = await Promise.all([
        getFieldsByEntity(activeEntity),
        getFieldOptions(),
      ]);
      setFields(summaryData);
      const optionMap: Record<string, FieldOption> = {};
      for (const o of fullData as FieldOption[]) {
        optionMap[o.field_key] = o;
      }
      setAllOptions(optionMap);
    } catch (e: any) {
      message.error(getErrorMessage(e) || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [activeEntity]);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  const handleInlineSave = async (fieldKey: string) => {
    if (!inlineEditValue.trim()) {
      setInlineEditKey(null);
      return;
    }
    setSaving(true);
    try {
      await updateFieldOption(fieldKey, { label: inlineEditValue.trim() });
      message.success('保存成功');
      setInlineEditKey(null);
      fetchFields();
      refresh();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (fieldKey: string, key: string, value: boolean) => {
    try {
      await updateFieldOption(fieldKey, { [key]: value });
      fetchFields();
      refresh();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '更新失败');
    }
  };

  const handleDelete = async (fieldKey: string) => {
    try {
      await deleteFieldOption(fieldKey);
      message.success('已删除');
      fetchFields();
      refresh();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '删除失败');
    }
  };

  const openOptionsModal = (fieldKey: string) => {
    const full = allOptions[fieldKey];
    if (full) {
      setEditingField(full);
      setOptionsModalOpen(true);
    }
  };

  const columns = [
    {
      title: '字段标识',
      dataIndex: 'column_name',
      key: 'column_name',
      width: 160,
      render: (v: string, record: FieldOptionSummary) => (
        <Space>
          <Tag color="blue">{v}</Tag>
          {record.is_picklist && <Tag color="green">下拉</Tag>}
        </Space>
      ),
    },
    {
      title: '显示名称',
      dataIndex: 'label',
      key: 'label',
      width: 180,
      render: (label: string, record: FieldOptionSummary) =>
        inlineEditKey === record.field_key ? (
          <Input
            size="small"
            value={inlineEditValue}
            onChange={e => setInlineEditValue(e.target.value)}
            onPressEnter={() => handleInlineSave(record.field_key)}
            onBlur={() => setInlineEditKey(null)}
            autoFocus
            style={{ width: 140 }}
          />
        ) : (
          <Tooltip title="点击编辑">
            <span
              onClick={() => {
                setInlineEditKey(record.field_key);
                setInlineEditValue(label);
              }}
              style={{ cursor: 'pointer' }}
            >
              {label || <span style={{ color: '#ccc' }}>（未设置）</span>}
            </span>
          </Tooltip>
        ),
    },
    {
      title: '类型',
      dataIndex: 'data_type',
      key: 'data_type',
      width: 100,
      render: dataTypeTag,
    },
    {
      title: '可见',
      dataIndex: 'is_visible',
      key: 'is_visible',
      width: 80,
      render: (v: boolean, record: FieldOptionSummary) => (
        <Switch
          size="small"
          checked={v}
          checkedChildren={<EyeOutlined />}
          unCheckedChildren={<EyeInvisibleOutlined />}
          onChange={val => handleToggle(record.field_key, 'is_visible', val)}
        />
      ),
    },
    {
      title: '可编辑',
      dataIndex: 'is_editable',
      key: 'is_editable',
      width: 80,
      render: (v: boolean, record: FieldOptionSummary) => (
        <Switch
          size="small"
          checked={v}
          checkedChildren={<EditOutlined />}
          unCheckedChildren={<StopOutlined />}
          onChange={val => handleToggle(record.field_key, 'is_editable', val)}
        />
      ),
    },
    {
      title: '必填',
      dataIndex: 'is_required',
      key: 'is_required',
      width: 80,
      render: (v: boolean, record: FieldOptionSummary) => (
        <Switch
          size="small"
          checked={v}
          onChange={val => handleToggle(record.field_key, 'is_required', val)}
        />
      ),
    },
    {
      title: '下拉',
      dataIndex: 'is_picklist',
      key: 'is_picklist',
      width: 80,
      render: (v: boolean, record: FieldOptionSummary) => (
        <Switch
          size="small"
          checked={v}
          onChange={val => handleToggle(record.field_key, 'is_picklist', val)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: FieldOptionSummary) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<FormOutlined />}
            onClick={() => openOptionsModal(record.field_key)}
          >
            选项
          </Button>
          <Popconfirm
            title="确定删除该字段配置？"
            onConfirm={() => handleDelete(record.field_key)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = ALL_ENTITIES.map(entity => ({
    key: entity,
    label: (
      <span>
        {ENTITY_LABELS[entity]}
        {fields.length > 0 && entity === activeEntity ? (
          <Badge count={fields.length} style={{ marginLeft: 6 }} size="small" />
        ) : null}
      </span>
    ),
  }));

  return (
    <div>
      <PageHeader
        title="字段配置"
        breadcrumbs={[{ name: '系统管理' }, { name: '字段配置' }]}
      />
      <div style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
        管理各业务模块的字段属性：显示名称、是否可见、是否可编辑、是否必填、下拉选项。点击显示名称可直接编辑。
      </div>

      <Tabs
        activeKey={activeEntity}
        onChange={setActiveEntity}
        items={tabItems}
        style={{ marginBottom: 16 }}
      />

      <div style={{ marginBottom: 12, textAlign: 'right' }}>
        <Button
          icon={<SyncOutlined />}
          onClick={() => setSyncDrawerOpen(true)}
        >
          同步新字段
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={fields}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 900 }}
        locale={{ emptyText: '暂无配置字段，点击"同步新字段"从数据库自动发现并添加' }}
      />

      <OptionsModal
        field={editingField}
        open={optionsModalOpen}
        onClose={() => { setOptionsModalOpen(false); setEditingField(null); }}
        onSaved={() => { fetchFields(); refresh(); }}
      />

      <SyncDrawer
        entityType={activeEntity}
        open={syncDrawerOpen}
        onClose={() => setSyncDrawerOpen(false)}
        onSynced={() => { fetchFields(); refresh(); }}
      />
    </div>
  );
};

export default FieldOptionsConfig;
