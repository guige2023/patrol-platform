import React, { useEffect, useState } from 'react';
import {
  Modal, Steps, Button, Space, Form, Input, Select, Checkbox,
  message, Descriptions, Tag, Spin, Row, Col, Table, Typography
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { getPlans } from '@/api/plans';
import { getUnits } from '@/api/units';
import { getCadres } from '@/api/cadres';
import { createGroup } from '@/api/groups';
import { getErrorMessage } from '@/utils/error';

const { Text } = Typography;

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PlanOption {
  id: string;
  name: string;
  status: string;
  target_units?: string[];
}

interface UnitOption {
  id: string;
  name: string;
  tags?: string[];
  last_inspection_year?: number | null;
}

interface CadreOption {
  id: string;
  name: string;
  position?: string;
  category?: string;
  tags?: string[];
  unit_id?: string;
  unit_name?: string;
}

function matchCadres(selectedUnits: UnitOption[], allCadres: CadreOption[]): CadreOption[] {
  // Collect all tags from selected units
  const unitTags: string[] = [];
  const unitNames: string[] = selectedUnits.map((u) => u.name);
  const unitIds: string[] = selectedUnits.map((u) => u.id);
  selectedUnits.forEach((u) => {
    if (u.tags) unitTags.push(...u.tags);
  });

  // Determine target categories
  const targetCategories: string[] = [];
  const tagStr = unitTags.join('');
  if (tagStr.includes('财务')) targetCategories.push('财务干部');
  if (tagStr.includes('审计')) targetCategories.push('审计干部');
  if (tagStr.includes('纪检监察')) targetCategories.push('纪检监察干部');
  if (targetCategories.length === 0) {
    targetCategories.push('综合干部', '后备干部');
  }

  return allCadres.filter((c) => {
    // Exclude cadres from the inspected units themselves
    if (unitIds.includes(c.unit_id || '')) return false;
    if (unitNames.some((n) => c.unit_name && c.unit_name.includes(n))) return false;
    // Exclude cadres tagged as "回避"
    if (c.tags && c.tags.some((t) => t.includes('回避'))) return false;
    // Match category
    if (c.category && targetCategories.some((cat) => c.category!.includes(cat) || cat.includes(c.category!))) {
      return true;
    }
    return false;
  });
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ open, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [allUnits, setAllUnits] = useState<UnitOption[]>([]);
  const [allCadres, setAllCadres] = useState<CadreOption[]>([]);

  // Step 1 (plan id tracked in form)

  // Step 2 - selected units
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

  // Step 3 - matched + manually adjusted members
  const [matchedCadres, setMatchedCadres] = useState<CadreOption[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Preview (step 4)
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setSelectedUnitIds([]);
      setMatchedCadres([]);
      setSelectedMemberIds([]);
      setPreviewData(null);
      form.resetFields();
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, unitsRes, cadresRes] = await Promise.all([
        getPlans({ page_size: 100 }),
        getUnits({ page_size: 100 }),
        getCadres({ page_size: 100 }),
      ]);

      const publishedPlans = (plansRes.items || []).filter(
        (p: any) => ['published', 'approved', 'submitted', 'in_progress'].includes(p.status)
      );
      setPlans(publishedPlans);
      setAllUnits(unitsRes.items || []);

      // Build cadres with unit_name
      const units: UnitOption[] = unitsRes.items || [];
      const unitMap: Record<string, string> = {};
      units.forEach((u) => { unitMap[u.id] = u.name; });
      const cadres = (cadresRes.items || []).map((c: any) => ({
        ...c,
        unit_name: c.unit_id ? unitMap[c.unit_id] : undefined,
      }));
      setAllCadres(cadres);
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStep1Next = async () => {
    try {
      await form.validateFields(['name', 'plan_id', 'leader_id']);
      // 清空步骤2的单位选择，避免旧数据残留
      setSelectedUnitIds([]);
      setMatchedCadres([]);
      setSelectedMemberIds([]);
      setCurrentStep(1);
    } catch {
      // form validation 错误已由 form 自己显示
    }
  };

  const handleStep2Next = () => {
    if (selectedUnitIds.length === 0) {
      message.warning('请至少选择一个被巡察单位');
      return;
    }
    // Match cadres for step 3
    const selUnits = allUnits.filter((u) => selectedUnitIds.includes(u.id));
    const matched = matchCadres(selUnits, allCadres);
    setMatchedCadres(matched);
    setSelectedMemberIds(matched.map((c) => c.id));
    setCurrentStep(2);
  };

  const handleStep3Next = () => {
    // Build preview data
    const formValues = form.getFieldsValue();
    const selectedPlan = plans.find((p) => p.id === formValues.plan_id);
    const selectedUnits = allUnits.filter((u) => selectedUnitIds.includes(u.id));
    const leader = allCadres.find((c) => c.id === formValues.leader_id);
    const viceLeader = formValues.vice_leader_id
      ? allCadres.find((c) => c.id === formValues.vice_leader_id)
      : null;
    const members = allCadres.filter((c) => selectedMemberIds.includes(c.id));

    setPreviewData({
      name: formValues.name,
      plan: selectedPlan,
      leader,
      viceLeader,
      selectedUnits,
      members,
      formValues,
    });
    setCurrentStep(3);
  };

  const handleConfirmCreate = async () => {
    setSubmitting(true);
    try {
      const formValues = form.getFieldsValue();
      const payload: any = {
        name: formValues.name,
        plan_id: formValues.plan_id,
        unit_ids: selectedUnitIds,
        leader_id: formValues.leader_id,
        vice_leader_id: formValues.vice_leader_id || null,
        member_ids: selectedMemberIds.filter(
          (id) => id !== formValues.leader_id && id !== formValues.vice_leader_id
        ),
      };
      await createGroup(payload);
      message.success('巡察组创建成功');
      onSuccess();
      onClose();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const cadreOptions = allCadres.map((c) => ({
    value: c.id,
    label: `${c.name}${c.position ? ` (${c.position})` : ''}`,
  }));

  const renderStep1 = () => (
    <Form form={form} layout="vertical">
      <Form.Item name="plan_id" label="关联巡察计划" rules={[{ required: true, message: '请选择巡察计划' }]}>
        <Select
          placeholder="请选择已发布的巡察计划"
          showSearch
          filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          options={plans.map((p) => ({ value: p.id, label: p.name }))}
          
          loading={loading}
        />
      </Form.Item>
      <Form.Item name="name" label="巡察组名称" rules={[{ required: true, message: '请输入巡察组名称' }]}>
        <Input placeholder="如：第一巡察组" />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="leader_id" label="组长" rules={[{ required: true, message: '请选择组长' }]}>
            <Select
              placeholder="请选择组长"
              showSearch
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={cadreOptions}
              loading={loading}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="vice_leader_id" label="副组长">
            <Select
              placeholder="请选择副组长（可选）"
              showSearch
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={cadreOptions}
              allowClear
              loading={loading}
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );

  const renderStep2 = () => {
    // 获取当前选中计划的 target_units，过滤单位列表
    const formValues = form.getFieldsValue();
    const selectedPlan = plans.find((p) => p.id === formValues.plan_id);
    const targetUnitIds: string[] = selectedPlan?.target_units || [];
    const filteredUnits = targetUnitIds.length > 0
      ? allUnits.filter((u) => targetUnitIds.includes(u.id))
      : allUnits;

    return (
      <div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          选择该巡察组负责巡察的单位（可多选）{selectedPlan?.name && `（${selectedPlan.name}）`}
        </Text>
        <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 12 }}>
          <Checkbox.Group
            value={selectedUnitIds}
            onChange={(vals) => setSelectedUnitIds(vals as string[])}
            style={{ display: 'block' }}
          >
            <Row gutter={[8, 8]}>
              {filteredUnits.map((u) => (
                <Col span={12} key={u.id}>
                  <Checkbox value={u.id}>
                    <span>{u.name}</span>
                    {u.tags && u.tags.length > 0 && u.tags.map((t) => (
                      <Tag key={t} color="blue" style={{ marginLeft: 4, fontSize: 11 }}>{t}</Tag>
                    ))}
                  </Checkbox>
                </Col>
              ))}
              {filteredUnits.length === 0 && (
                <Text type="secondary">该计划暂未指定巡察单位，请返回步骤一修改计划</Text>
              )}
            </Row>
          </Checkbox.Group>
        </div>
        <div style={{ marginTop: 8 }}>
          <Text>已选 {selectedUnitIds.length} 个单位</Text>
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    const memberColumns = [
      { title: '姓名', dataIndex: 'name', key: 'name' },
      { title: '类别', dataIndex: 'category', key: 'category', render: (v: string) => v || '-' },
      { title: '职务', dataIndex: 'position', key: 'position', render: (v: string) => v || '-' },
      {
        title: '操作',
        key: 'action',
        render: (_: any, record: CadreOption) => (
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => setSelectedMemberIds((prev) => prev.filter((id) => id !== record.id))}
          >
            移除
          </Button>
        ),
      },
    ];

    const selectedMembers = allCadres.filter((c) => selectedMemberIds.includes(c.id));
    const unselectedMatched = matchedCadres.filter((c) => !selectedMemberIds.includes(c.id));

    return (
      <div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          系统已根据被巡察单位标签自动匹配合格人员，可手动增删：
        </Text>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            已选成员（{selectedMembers.length}人）
          </div>
          <Table
            columns={memberColumns}
            dataSource={selectedMembers}
            rowKey="id"
            size="small"
            pagination={false}
            style={{ marginBottom: 8 }}
          />
        </div>

        {unselectedMatched.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              其他匹配人员（点击添加）
            </div>
            <Row gutter={[8, 8]}>
              {unselectedMatched.map((c) => (
                <Col span={12} key={c.id}>
                  <div
                    style={{
                      padding: '6px 10px',
                      border: '1px dashed #d9d9d9',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onClick={() => setSelectedMemberIds((prev) => [...prev, c.id])}
                  >
                    <span>
                      {c.name}
                      {c.category && <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>{c.category}</Tag>}
                      {c.position && <Text type="secondary" style={{ fontSize: 12 }}> {c.position}</Text>}
                    </span>
                    <PlusOutlined style={{ color: '#1677ff' }} />
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        )}

        {matchedCadres.length === 0 && (
          <div style={{ color: '#8c8c8c', padding: '20px 0' }}>
            暂无自动匹配人员，请根据被巡察单位标签确认干部类别配置。
          </div>
        )}
      </div>
    );
  };

  const renderStep4 = () => {
    if (!previewData) return null;
    const formVals = form.getFieldsValue();
    const members = allCadres.filter((c) =>
      selectedMemberIds.includes(c.id) &&
      c.id !== formVals.leader_id &&
      c.id !== formVals.vice_leader_id
    );

    return (
      <Descriptions column={1} bordered size="small" style={{ marginTop: 8 }}>
        <Descriptions.Item label="关联计划">{previewData.plan?.name || '-'}</Descriptions.Item>
        <Descriptions.Item label="巡察组名称">{previewData.name}</Descriptions.Item>
        <Descriptions.Item label="组长">{previewData.leader?.name || '-'}</Descriptions.Item>
        <Descriptions.Item label="副组长">{previewData.viceLeader?.name || '（无）'}</Descriptions.Item>
        <Descriptions.Item label="被巡察单位">
          {previewData.selectedUnits.map((u: UnitOption) => <Tag key={u.id}>{u.name}</Tag>)}
        </Descriptions.Item>
        <Descriptions.Item label="成员（{members.length}人）">
          {members.map((c) => (
            <Tag key={c.id}>{c.name}{c.category ? ` · ${c.category}` : ''}</Tag>
          ))}
          {members.length === 0 && '（无普通成员）'}
        </Descriptions.Item>
      </Descriptions>
    );
  };

  const steps = [
    { title: '基本信息' },
    { title: '选择单位' },
    { title: '匹配人员' },
    { title: '确认' },
  ];

  const footer = (
    <Space>
      <Button onClick={onClose}>取消</Button>
      {currentStep > 0 && (
        <Button onClick={() => setCurrentStep((s) => s - 1)}>上一步</Button>
      )}
      {currentStep === 0 && (
        <Button type="primary" onClick={handleStep1Next} loading={loading}>下一步</Button>
      )}
      {currentStep === 1 && (
        <Button type="primary" onClick={handleStep2Next}>下一步</Button>
      )}
      {currentStep === 2 && (
        <Button type="primary" onClick={handleStep3Next}>下一步（预览）</Button>
      )}
      {currentStep === 3 && (
        <Button type="primary" onClick={handleConfirmCreate} loading={submitting}>确认保存</Button>
      )}
    </Space>
  );

  return (
    <Modal
      title="新建巡察组"
      open={open}
      onCancel={onClose}
      footer={footer}
      width={800}
      destroyOnHidden
    >
      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />
      {loading && currentStep === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="加载数据中..." /></div>
      ) : (
        <>
          {currentStep === 0 && renderStep1()}
          {currentStep === 1 && renderStep2()}
          {currentStep === 2 && renderStep3()}
          {currentStep === 3 && renderStep4()}
        </>
      )}
    </Modal>
  );
};

export default CreateGroupModal;
