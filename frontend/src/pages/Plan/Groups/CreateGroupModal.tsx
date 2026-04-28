import React, { useEffect, useState, useRef } from 'react';
import {
  Modal, Steps, Button, Space, Form, Input, Select, Checkbox,
  message, Descriptions, Tag, Spin, Row, Col, Table, Typography
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { getPlans } from '@/api/plans';
import { getUnits } from '@/api/units';
import { getCadres } from '@/api/cadres';
import { createGroup } from '@/api/groups';
import { getSystemConfigs } from '@/api/systemConfigs';
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
  business_tags?: string[];
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

interface MatchRulesConfig {
  match_by_tags?: boolean;
  tag_match_rules?: Record<string, string[]>;
  default_cadre_categories?: string[];
  exclude_same_unit?: boolean;
  exclude_parent_unit?: boolean;
  exclude_child_unit?: boolean;
}

function matchCadres(
  selectedUnits: UnitOption[],
  allCadres: CadreOption[],
  config: MatchRulesConfig
): CadreOption[] {
  const { match_by_tags, tag_match_rules = {}, default_cadre_categories = ['组员库'] } = config;

  // Collect business_tags from selected units (NOT party tags)
  const unitBusinessTags: string[] = [];
  const unitNames: string[] = selectedUnits.map((u) => u.name);
  const unitIds: string[] = selectedUnits.map((u) => u.id);
  selectedUnits.forEach((u) => {
    if (Array.isArray(u.business_tags)) unitBusinessTags.push(...u.business_tags);
  });

  // Determine target categories based on config
  const targetCategories: string[] = [];

  if (match_by_tags && Object.keys(tag_match_rules).length > 0) {
    // 使用配置的标签匹配规则
    for (const tag of unitBusinessTags) {
      if (tag_match_rules[tag]) {
        targetCategories.push(...tag_match_rules[tag]);
      }
    }
    // 如果没有匹配到任何标签，使用默认类别
    if (targetCategories.length === 0) {
      targetCategories.push(...default_cadre_categories);
    }
  } else {
    // 不使用标签匹配，使用默认类别
    targetCategories.push(...default_cadre_categories);
  }

  // Remove duplicates
  const uniqueCategories = [...new Set(targetCategories)];

  return allCadres.filter((c) => {
    // Exclude cadres from the inspected units themselves
    if (unitIds.includes(c.unit_id || '')) return false;
    if (unitNames.some((n) => c.unit_name && c.unit_name.includes(n))) return false;
    // Exclude cadres tagged as "回避"
    if (Array.isArray(c.tags) && c.tags.some((t: string) => t.includes('回避'))) return false;
    // Match category - if uniqueCategories is empty, match all
    if (uniqueCategories.length === 0) return true;
    if (c.category && uniqueCategories.some((cat) => c.category!.includes(cat) || cat.includes(c.category!))) {
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
  // Track whether the Form has been mounted to avoid calling resetFields before mount
  const formMountedRef = useRef(false);

  // Data
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [allUnits, setAllUnits] = useState<UnitOption[]>([]);
  const [allCadres, setAllCadres] = useState<CadreOption[]>([]);

  // 巡察组匹配规则配置（从系统配置读取）
  const [matchRulesConfig, setMatchRulesConfig] = useState<{
    match_by_tags?: boolean;
    tag_match_rules?: Record<string, string[]>;
    default_cadre_categories?: string[];
    exclude_same_unit?: boolean;
    exclude_parent_unit?: boolean;
    exclude_child_unit?: boolean;
  }>({});

  // Step 1 - selected plan id stored in state (not just form) to survive re-renders
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Step 1 - group name, leader/vice-leader stored in state to avoid form timing issues
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);
  const [selectedViceLeaderIds, setSelectedViceLeaderIds] = useState<string[]>([]);

  // Step 2 - selected units
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

  // Step 3 - matched + manually adjusted members
  const [matchedCadres, setMatchedCadres] = useState<CadreOption[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Preview (step 4)
  const [previewData, setPreviewData] = useState<any>(null);

  // Mark form as mounted when user is at step 0 (where the Form lives)
  useEffect(() => {
    if (currentStep === 0) {
      formMountedRef.current = true;
    }
  }, [currentStep]);

  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setSelectedPlanId(null);
      setSelectedGroupName('');
      setSelectedLeaderId(null);
      setSelectedViceLeaderIds([]);
      setSelectedUnitIds([]);
      setMatchedCadres([]);
      setSelectedMemberIds([]);
      setPreviewData(null);
      // Defer resetFields until after the Form is confirmed mounted to avoid antd warning
      if (formMountedRef.current) {
        requestAnimationFrame(() => form.resetFields());
      }
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, unitsRes, cadresRes, configsRes] = await Promise.all([
        getPlans({ page_size: 100 }),
        getUnits({ page_size: 100 }),
        getCadres({ page_size: 100 }),
        getSystemConfigs(),
      ]);

      // Include all non-completed plans (draft, approved, submitted, in_progress, published)
      const activePlans = (plansRes.items || []).filter(
        (p: any) => !['completed', 'cancelled'].includes(p.status)
      );
      setPlans(activePlans);
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

      // 解析系统配置中的匹配规则
      const configMap: Record<string, any> = {};
      if (Array.isArray(configsRes)) {
        configsRes.forEach((item: any) => { configMap[item.key] = item.value; });
      }
      // 解析 tag_match_rules JSON
      let tagMatchRules: Record<string, string[]> = {};
      if (configMap.tag_match_rules) {
        try {
          if (typeof configMap.tag_match_rules === 'string') {
            tagMatchRules = JSON.parse(configMap.tag_match_rules);
          } else {
            tagMatchRules = configMap.tag_match_rules;
          }
        } catch { /* ignore parse errors */ }
      }
      // 解析 default_cadre_categories
      let defaultCategories: string[] = ['组员库'];
      if (configMap.default_cadre_categories) {
        try {
          if (typeof configMap.default_cadre_categories === 'string') {
            defaultCategories = JSON.parse(configMap.default_cadre_categories);
          } else if (Array.isArray(configMap.default_cadre_categories)) {
            defaultCategories = configMap.default_cadre_categories;
          }
        } catch { /* ignore parse errors */ }
      }
      setMatchRulesConfig({
        match_by_tags: configMap.match_by_tags === true || configMap.match_by_tags === 'true',
        tag_match_rules: tagMatchRules,
        default_cadre_categories: defaultCategories,
        exclude_same_unit: configMap.exclude_same_unit === true || configMap.exclude_same_unit === 'true',
        exclude_parent_unit: configMap.exclude_parent_unit === true || configMap.exclude_parent_unit === 'true',
        exclude_child_unit: configMap.exclude_child_unit === true || configMap.exclude_child_unit === 'true',
      });
    } catch (e) {
      console.error('Failed to load data', e);
      message.error('加载数据失败，请关闭弹窗后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleStep1Next = async () => {
    try {
      // validateFields 不带参数，返回所有字段的完整值（包含 vice_leader_ids）
      const values = await form.validateFields();
      setSelectedGroupName(values.name || '');
      setSelectedPlanId(values.plan_id);
      setSelectedLeaderId(values.leader_id);
      setSelectedViceLeaderIds(values.vice_leader_ids || []);
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
    // Match cadres for step 3 using config rules
    const selUnits = allUnits.filter((u) => selectedUnitIds.includes(u.id));
    const matched = matchCadres(selUnits, allCadres, matchRulesConfig);
    setMatchedCadres(matched);
    setSelectedMemberIds([]);  // 不自动选中，让用户手动勾选
    setCurrentStep(2);
  };

  const handleStep3Next = () => {
    // Build preview data entirely from React state (form values stored in state at step 1)
    const selectedPlan = plans.find((p) => p.id === selectedPlanId);
    const selectedUnits = allUnits.filter((u) => selectedUnitIds.includes(u.id));
    const leader = allCadres.find((c) => c.id === selectedLeaderId);
    const viceLeaders = selectedViceLeaderIds
      .map((id: string) => allCadres.find((c) => c.id === id))
      .filter(Boolean);
    const members = allCadres.filter((c) =>
      selectedMemberIds.includes(c.id) &&
      c.id !== selectedLeaderId &&
      !selectedViceLeaderIds.includes(c.id)
    );

    setPreviewData({
      formValues: { name: selectedGroupName },
      plan: selectedPlan,
      leader,
      viceLeaders,
      selectedUnits,
      members,
    });
    setCurrentStep(3);
  };

  const handleConfirmCreate = async () => {
    setSubmitting(true);
    try {
      const payload: any = {
        name: selectedGroupName,  // 使用 state 中的 selectedGroupName
        plan_id: selectedPlanId,
        unit_ids: selectedUnitIds,
        leader_id: selectedLeaderId,
        vice_leader_ids: selectedViceLeaderIds,
        member_ids: selectedMemberIds.filter(
          (id) => id !== selectedLeaderId && !selectedViceLeaderIds.includes(id)
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
          onChange={(val) => setSelectedPlanId(val)}
          loading={loading}
        />
      </Form.Item>
      <Form.Item name="name" label="巡察组名称" rules={[{ required: true, message: '请输入巡察组名称' }]}>
        <Input
          placeholder="如：第一巡察组"
          onChange={(e) => setSelectedGroupName(e.target.value)}
        />
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
              onChange={(val) => setSelectedLeaderId(val)}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="vice_leader_ids" label="副组长">
            <Select
              mode="multiple"
              placeholder="请选择副组长（可多选）"
              showSearch
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={cadreOptions}
              allowClear
              loading={loading}
              maxCount={5}
              onChange={(val) => setSelectedViceLeaderIds(val || [])}
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );

  const renderStep2 = () => {
    // 获取当前选中计划的 target_units，过滤单位列表
    // target_units 可能是 UUID 数组，也可能是单位名称数组（遗留数据），两边都匹配
    // 使用 selectedPlanId state 而非 form.getFieldsValue()，因为 form 重渲染时可能丢失数据
    const selectedPlan = plans.find((p) => p.id === selectedPlanId);
    const targetUnitIds: string[] = selectedPlan?.target_units || [];
    // 建立 name -> id 的映射，处理 target_units 为单位名称的情况
    // target_units 可能是 UUID，也可能是单位名称（旧数据/不完整名称）
    const unitNameToId: Record<string, string> = {};
    allUnits.forEach((u) => { unitNameToId[u.name] = u.id; });
    // 归一化：如果是 UUID 直接用，如果是名称，尝试精确匹配 or 前缀匹配
    const normalizedTargetIds: string[] = [];
    for (const idOrName of targetUnitIds) {
      if (allUnits.some((u) => u.id === idOrName)) {
        normalizedTargetIds.push(idOrName);
      } else if (unitNameToId[idOrName]) {
        normalizedTargetIds.push(unitNameToId[idOrName]);
      } else {
        // 前缀匹配：target_units 里存的是 '纪工委机关' 但实际名称是 '纪工委机关、巡察办'
        const found = allUnits.find((u) => u.name.startsWith(idOrName));
        if (found) normalizedTargetIds.push(found.id);
      }
    }
    const filteredUnits = normalizedTargetIds.length > 0
      ? allUnits.filter((u) => normalizedTargetIds.includes(u.id))
      : [];

    return (
      <div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          选择该巡察组负责巡察的单位（可多选）{selectedPlan?.name && `（${selectedPlan.name}）`}
        </Text>
        {targetUnitIds.length === 0 && (
          <Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
            该计划未设置被巡察单位，请返回步骤一修改计划，或在「计划管理」中编辑该计划的被巡察单位后再试。
          </Text>
        )}
        <div style={{ maxHeight: 420, overflowY: 'auto', border: targetUnitIds.length === 0 ? '1px dashed #ff4d4f' : '1px solid #f0f0f0', borderRadius: 6, padding: 12, opacity: targetUnitIds.length === 0 ? 0.5 : 1 }}>
          <Checkbox.Group
            value={selectedUnitIds}
            onChange={(vals) => setSelectedUnitIds(vals as string[])}
            style={{ display: 'block' }}
            disabled={targetUnitIds.length === 0}
          >
            <Row gutter={[8, 8]}>
              {filteredUnits.map((u) => (
                <Col span={12} key={u.id}>
                  <Checkbox value={u.id}>
                    <span>{u.name}</span>
                    {Array.isArray(u.tags) && u.tags.length > 0 && u.tags.map((t) => (
                      <Tag key={t} color="blue" style={{ marginLeft: 4, fontSize: 11 }}>{t}</Tag>
                    ))}
                  </Checkbox>
                </Col>
              ))}
              {filteredUnits.length === 0 && targetUnitIds.length > 0 && (
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
    // renderStep4 直接使用 handleStep3Next 预计算好的 previewData，
    // 而不再用 plans.find() / allCadres.find() 重新查（避免 loadData 未返回时数组为空导致查找失败）
    if (!previewData) {
      return <div style={{ padding: 20, color: '#999' }}>请先完成前几步填写</div>;
    }
    const { formValues, plan, leader, viceLeaders, selectedUnits, members } = previewData;

    return (
      <Descriptions column={1} bordered size="small" style={{ marginTop: 8 }}>
        <Descriptions.Item label="关联计划">{plan?.name || '-'}</Descriptions.Item>
        <Descriptions.Item label="巡察组名称">{formValues?.name || '-'}</Descriptions.Item>
        <Descriptions.Item label="组长">{leader?.name || '-'}</Descriptions.Item>
        <Descriptions.Item label="副组长">
          {viceLeaders && viceLeaders.length > 0
            ? viceLeaders.map((v: any) => v.name).join('、')
            : '（无）'}
        </Descriptions.Item>
        <Descriptions.Item label="被巡察单位">
          {selectedUnits && selectedUnits.length > 0
            ? selectedUnits.map((u: UnitOption) => <Tag key={u.id}>{u.name}</Tag>)
            : '（无）'}
        </Descriptions.Item>
        <Descriptions.Item label="成员">
          {members && members.length > 0
            ? members.map((c: any) => (
                <Tag key={c.id}>{c.name}{c.category ? ` · ${c.category}` : ''}</Tag>
              ))
            : '（无普通成员）'}
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
    >
      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />
      {loading && currentStep === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, position: 'relative' }}><Spin tip="加载数据中..." /></div>
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
