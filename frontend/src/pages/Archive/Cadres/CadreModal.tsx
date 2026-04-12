import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, Switch, Space, message } from 'antd';
import { getUnits } from '@/api/units';
import { getCadre, createCadre, updateCadre } from '@/api/cadres';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface CadreModalProps {
  open: boolean;
  cadreId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CadreModal: React.FC<CadreModalProps> = ({ open, cadreId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form] = Form.useForm();
  const [unitOptions, setUnitOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetchUnits();
      if (cadreId) {
        fetchCadreData(cadreId);
        setEditMode(false); // 查看模式
      } else {
        form.resetFields();
        setEditMode(true); // 新建默认编辑模式
      }
    }
  }, [open, cadreId]);

  const fetchUnits = async () => {
    try {
      const res = await getUnits({ page: 1, page_size: 200 });
      const units = res.items || [];
      setUnitOptions(units.map((u: any) => ({ label: u.name, value: u.id })));
    } catch {
      // 单位列表获取失败不影响主流程
    }
  };

  const fetchCadreData = async (id: string) => {
    try {
      const res = await getCadre(id);
      const data = { ...res };
      if (data.birth_date) {
        data.birth_date = dayjs(data.birth_date);
      }
      form.setFieldsValue(data);
    } catch {
      message.error('获取干部详情失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (values.birth_date) {
        values.birth_date = values.birth_date.format('YYYY-MM-DD');
      }
      setLoading(true);
      if (cadreId) {
        await updateCadre(cadreId, values);
        message.success('保存成功');
      } else {
        await createCadre(values);
        message.success('新建干部成功');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.detail || (cadreId ? '保存失败' : '新建失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={cadreId ? '干部档案' : '新建干部'}
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={700}
      destroyOnHidden
    >
      {cadreId && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Switch
            checkedChildren="编辑模式"
            unCheckedChildren="查看模式"
            checked={editMode}
            onChange={(v) => setEditMode(v)}
          />
        </div>
      )}
      <Form form={form} layout="vertical" style={{ marginTop: cadreId ? 0 : 0 }} disabled={!editMode}>
        <Form.Item
          name="name"
          label="姓名"
          rules={[{ required: true, message: '请输入姓名' }]}
        >
          <Input placeholder="请输入姓名" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="gender" label="性别">
            <Select
              options={[{ label: '男', value: '男' }, { label: '女', value: '女' }]}
              placeholder="请选择性别"
              allowClear
            />
          </Form.Item>

          <Form.Item name="birth_date" label="出生日期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择出生日期" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="ethnicity" label="民族">
            <Input placeholder="请输入民族" />
          </Form.Item>

          <Form.Item name="native_place" label="籍贯">
            <Input placeholder="请输入籍贯" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="political_status" label="政治面貌">
            <Select
              options={[
                { label: '中共党员', value: '中共党员' },
                { label: '中共预备党员', value: '中共预备党员' },
                { label: '共青团员', value: '共青团员' },
                { label: '群众', value: '群众' },
              ]}
              placeholder="请选择政治面貌"
              allowClear
              showSearch
            />
          </Form.Item>

          <Form.Item name="education" label="学历">
            <Select
              options={[
                { label: '博士研究生', value: '博士研究生' },
                { label: '硕士研究生', value: '硕士研究生' },
                { label: '大学本科', value: '大学本科' },
                { label: '大学专科', value: '大学专科' },
                { label: '中专', value: '中专' },
                { label: '高中', value: '高中' },
                { label: '初中及以下', value: '初中及以下' },
              ]}
              placeholder="请选择学历"
              allowClear
              showSearch
            />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="degree" label="学位">
            <Select
              options={[
                { label: '博士学位', value: '博士学位' },
                { label: '硕士学位', value: '硕士学位' },
                { label: '学士学位', value: '学士学位' },
              ]}
              placeholder="请选择学位"
              allowClear
              showSearch
            />
          </Form.Item>

          <Form.Item name="is_available" label="是否可用" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="可用" unCheckedChildren="不可用" />
          </Form.Item>
        </div>

        <Form.Item name="unit_id" label="所属单位">
          <Select
            options={unitOptions}
            placeholder="请选择所属单位"
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="position" label="职务">
            <Input placeholder="请输入职务" />
          </Form.Item>

          <Form.Item name="rank" label="职级">
            <Input placeholder="请输入职级" />
          </Form.Item>
        </div>

        <Form.Item name="tags" label="标签" extra="多个标签用逗号分隔">
          <Input
            placeholder="如：优秀干部,后备干部"
            onChange={(e) => {
              const val = e.target.value;
              const tags = val.split(',').map(t => t.trim()).filter(Boolean);
              form.setFieldValue('tags', tags);
            }}
          />
        </Form.Item>

        <Form.Item name="profile" label="简历">
          <TextArea rows={3} placeholder="请输入简历" />
        </Form.Item>

        <Form.Item name="resume" label="工作经历">
          <TextArea rows={3} placeholder="请输入工作经历" />
        </Form.Item>

        <div style={{ textAlign: 'right', marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Space>
            <button type="button" onClick={handleCancel} style={{ padding: '4px 16px', borderRadius: 6, border: '1px solid #d9d9d9', background: '#fff', cursor: 'pointer' }}>
              取消
            </button>
            {editMode && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  background: '#1677ff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 16px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? '保存中...' : '保存'}
              </button>
            )}
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default CadreModal;
