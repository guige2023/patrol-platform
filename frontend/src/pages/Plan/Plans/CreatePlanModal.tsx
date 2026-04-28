import React, { useEffect, useState, useRef } from 'react';
import {
  Modal, Steps, Button, Space, Form, Input, DatePicker,
  Checkbox, message, Descriptions, Tag, Spin, Row, Col, Typography
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { getSystemConfigs } from '@/api/systemConfigs';
import { getUnits } from '@/api/units';
import { getPlans, createPlan } from '@/api/plans';

const { Text } = Typography;

interface Unit {
  id: string;
  name: string;
  unit_type?: string;
  tags?: string[];
  last_inspection_year?: number | null;
}

interface CreatePlanModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Add workdays to a date (skipping weekends only; simple approximation)
function addWorkdays(startDate: Dayjs, days: number): Dayjs {
  let current = startDate.clone();
  let added = 0;
  while (added < days) {
    current = current.add(1, 'day');
    const dow = current.day();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return current;
}

const CreatePlanModal: React.FC<CreatePlanModalProps> = ({ open, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Track whether the Form has been mounted to avoid calling resetFields before mount
  const formMountedRef = useRef(false);

  // System configs
  const [configs, setConfigs] = useState<Record<string, string>>({});
  // Units
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [unitSearch, setUnitSearch] = useState('');
  // Step 2 computed values
  const [round, setRound] = useState(1);

  // Step 3 preview
  const [previewData, setPreviewData] = useState<any>(null);

  // Mark form as mounted when user reaches step 2 (the first step with a Form)
  useEffect(() => {
    if (currentStep >= 1) {
      formMountedRef.current = true;
    }
  }, [currentStep]);

  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setSelectedUnitIds([]);
      setUnitSearch('');
      // Defer resetFields until after the Form is confirmed mounted to avoid antd warning
      if (formMountedRef.current) {
        requestAnimationFrame(() => form.resetFields());
      }
      loadInitialData();
    }
  }, [open]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [configsRes, unitsRes, plansRes] = await Promise.all([
        getSystemConfigs(),
        getUnits({ page_size: 100 }),
        getPlans({ year: new Date().getFullYear(), page_size: 100 }),
      ]);

      const cfgMap: Record<string, any> = {};
      if (Array.isArray(configsRes)) {
        configsRes.forEach((c: any) => { cfgMap[c.key] = c.value; });
      } else if (configsRes && typeof configsRes === 'object') {
        Object.assign(cfgMap, configsRes);
      }
      setConfigs(cfgMap);

      setAllUnits(unitsRes.items || []);

      const publishedThisYear = (plansRes.items || []).filter(
        (p: any) => p.status === 'published' || p.status === 'approved' || p.status === 'submitted'
      ).length;
      setRound(publishedThisYear + 1);
    } catch (e) {
      console.error('Failed to load initial data', e);
      message.error('加载数据失败，请关闭弹窗后重试');
    } finally {
      setLoading(false);
    }
  };

  // Determine which units are "pending inspection" in current cycle
  // 使用统一的巡察周期配置
  const currentYear = new Date().getFullYear();
  const cycleYearsRaw = configs.patrol_cycle_years ?? '5';
  const cycleYears = parseInt(String(cycleYearsRaw), 10) || 5;
  // 从配置读取周期起始年份
  const cycleStartDateRaw = configs.patrol_cycle_start_date ?? `${currentYear - cycleYears + 1}-01-01`;
  const cycleStartYear = parseInt(String(cycleStartDateRaw).substring(0, 4), 10) || (currentYear - cycleYears + 1);

  // 判断某个单位是否应该被标记为 pending（所有单位使用统一周期）
  const isUnitPending = (u: Unit): boolean => {
    return !u.last_inspection_year || u.last_inspection_year < cycleStartYear;
  };

  const pendingUnits = allUnits.filter(isUnitPending);
  const inspectedUnits = allUnits.filter((u) => !isUnitPending(u));

  const filteredPendingUnits = pendingUnits.filter((u) =>
    !unitSearch || u.name.toLowerCase().includes(unitSearch.toLowerCase())
  );
  const filteredInspectedUnits = inspectedUnits.filter((u) =>
    !unitSearch || u.name.toLowerCase().includes(unitSearch.toLowerCase())
  );

  const handleStep1Next = () => {
    if (selectedUnitIds.length === 0) {
      message.warning('请至少选择一个被巡察单位');
      return;
    }
    // Pre-fill step 2 form
    const districtName = configs.district_name || '';
    const planName = `${districtName}党工委${currentYear}年度第${round}轮巡察计划`;
    const durationDaysRaw = configs.patrol_duration_days ?? '30';
    const durationDays = parseInt(String(durationDaysRaw), 10) || 30;
    const defaultStart = dayjs();
    const defaultEnd = addWorkdays(defaultStart, durationDays);
    // key_areas from config is an array; convert to comma-separated string for TextArea
    const keyAreasRaw = configs.key_areas;
    const keyAreas = Array.isArray(keyAreasRaw)
      ? keyAreasRaw.join('、')
      : (typeof keyAreasRaw === 'string' ? keyAreasRaw : '');

    form.setFieldsValue({
      name: planName,
      year: currentYear,
      round_name: `第${round}轮巡察`,
      round_number: round,
      planned_start_date: defaultStart,
      planned_end_date: defaultEnd,
      focus_areas: keyAreas,
      authorization_letter: '',
    });
    setCurrentStep(1);
  };

  const handleStep2Next = async () => {
    try {
      const values = await form.validateFields();
      // Build preview
      const selectedUnits = allUnits.filter((u) => selectedUnitIds.includes(u.id));
      setPreviewData({
        ...values,
        selectedUnits,
        planned_start_date: values.planned_start_date?.format('YYYY-MM-DD'),
        planned_end_date: values.planned_end_date?.format('YYYY-MM-DD'),
        actual_start_date: values.actual_start_date?.format('YYYY-MM-DD'),
        actual_end_date: values.actual_end_date?.format('YYYY-MM-DD'),
      });
      setCurrentStep(2);
    } catch {
      // validation errors handled by form
    }
  };

  const handleStartDateChange = (date: Dayjs | null) => {
    if (date) {
      const durationDaysRaw = configs.patrol_duration_days ?? '30';
      const durationDays = parseInt(String(durationDaysRaw), 10) || 30;
      const computedEnd = addWorkdays(date, durationDays);
      form.setFieldValue('planned_end_date', computedEnd);
    }
  };

  const handleRoundChange = (val: number) => {
    setRound(val);
    const districtName = configs.district_name || '';
    const planName = `${districtName}党工委${currentYear}年度第${val}轮巡察计划`;
    form.setFieldValue('name', planName);
    form.setFieldValue('round_name', `第${val}轮巡察`);
  };

  const handleConfirmCreate = async () => {
    setSubmitting(true);
    try {
      const selectedUnits = allUnits.filter((u) => selectedUnitIds.includes(u.id));
      const focusAreasRaw = previewData.focus_areas;
      // focus_areas can be string[] (from Select) or string (from TextArea), normalize to array
      const focusAreasList = Array.isArray(focusAreasRaw)
        ? focusAreasRaw
        : typeof focusAreasRaw === 'string' && focusAreasRaw
          ? focusAreasRaw.split(/[，,\n]/).map((s: string) => s.trim()).filter(Boolean)
          : [];

      const payload: any = {
        name: previewData.name,
        year: previewData.year,
        round_name: previewData.round_name,
        round_number: previewData.round_number,
        scope: selectedUnits.map((u) => u.name).join('、'),
        focus_areas: focusAreasList,
        target_units: selectedUnitIds,
        planned_start_date: previewData.planned_start_date
          ? `${previewData.planned_start_date}T00:00:00`
          : undefined,
        planned_end_date: previewData.planned_end_date
          ? `${previewData.planned_end_date}T00:00:00`
          : undefined,
      };
      if (previewData.actual_start_date) {
        payload.actual_start_date = `${previewData.actual_start_date}T00:00:00`;
      }
      if (previewData.actual_end_date) {
        payload.actual_end_date = `${previewData.actual_end_date}T00:00:00`;
      }
      if (previewData.authorization_letter) {
        payload.authorization_letter = previewData.authorization_letter;
      }

      await createPlan(payload);
      message.success('计划创建成功');
      onSuccess();
      onClose();
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      let msg = '创建失败';
      if (typeof detail === 'string') msg = detail;
      else if (Array.isArray(detail)) {
        msg = detail.map((err: any) =>
          Array.isArray(err.loc) ? err.loc.join(' › ') + ': ' + err.msg : err.msg || String(err)
        ).join('；');
      }
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="搜索单位名称"
          value={unitSearch}
          onChange={(e) => setUnitSearch(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Text type="secondary" style={{ marginLeft: 12 }}>
          当前周期（{cycleStartYear}年起，{cycleYears}年轮次）：共 {pendingUnits.length} 个单位待巡察
        </Text>
      </div>

      <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 12 }}>
        {filteredPendingUnits.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#1677ff' }}>待巡察单位（可选）</div>
            <Checkbox.Group
              value={selectedUnitIds}
              onChange={(vals) => setSelectedUnitIds(vals as string[])}
              style={{ display: 'block' }}
            >
              <Row gutter={[8, 8]}>
                {filteredPendingUnits.map((u) => (
                  <Col span={12} key={u.id}>
                    <Checkbox value={u.id}>
                      <span>{u.name}</span>
                      {u.last_inspection_year && (
                        <Tag color="orange" style={{ marginLeft: 4, fontSize: 11 }}>
                          上次：{u.last_inspection_year}年
                        </Tag>
                      )}
                      {!u.last_inspection_year && (
                        <Tag color="green" style={{ marginLeft: 4, fontSize: 11 }}>首次</Tag>
                      )}
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </div>
        )}

        {filteredInspectedUnits.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#8c8c8c' }}>本周期已巡察（不可选）</div>
            <Row gutter={[8, 8]}>
              {filteredInspectedUnits.map((u) => (
                <Col span={12} key={u.id}>
                  <div style={{ color: '#bfbfbf', padding: '4px 8px' }}>
                    <span>{u.name}</span>
                    <Tag color="default" style={{ marginLeft: 4, fontSize: 11 }}>
                      最近巡察：{u.last_inspection_year}年
                    </Tag>
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        )}

        {filteredPendingUnits.length === 0 && filteredInspectedUnits.length === 0 && (
          <div style={{ textAlign: 'center', color: '#8c8c8c', padding: 40 }}>暂无数据</div>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <Text>已选 {selectedUnitIds.length} 个单位</Text>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
      <Row gutter={16}>
        <Col span={16}>
          <Form.Item name="name" label="计划名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="year" label="年份" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="round_name" label="轮次名称">
            <Input placeholder="如：第一轮巡察" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="轮次序号（影响计划名称）">
            <Input
              type="number"
              value={round}
              min={1}
              onChange={(e) => handleRoundChange(parseInt(e.target.value, 10) || 1)}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="planned_start_date" label="巡察开始日期" rules={[{ required: true }]}>
            <DatePicker
              style={{ width: '100%' }}
              onChange={handleStartDateChange}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="planned_end_date" label="巡察结束日期（自动计算工作日，可调整）">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="actual_start_date" label="实际开始日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="actual_end_date" label="实际结束日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="focus_areas" label="重点领域（已自动填充预设内容，可修改）">
        <Input.TextArea rows={4} />
      </Form.Item>
      <Form.Item name="authorization_letter" label="授权文书（可留空）">
        <Input placeholder="正式文件下发后填写" />
      </Form.Item>
    </Form>
  );

  const renderStep3 = () => {
    if (!previewData) return null;
    const selectedUnits = allUnits.filter((u) => selectedUnitIds.includes(u.id));
    return (
      <Descriptions column={1} bordered size="small" style={{ marginTop: 8 }}>
        <Descriptions.Item label="计划名称">{previewData.name}</Descriptions.Item>
        <Descriptions.Item label="年份">{previewData.year}</Descriptions.Item>
        <Descriptions.Item label="轮次">{previewData.round_name}</Descriptions.Item>
        <Descriptions.Item label="被巡察单位">
          {selectedUnits.map((u) => <Tag key={u.id}>{u.name}</Tag>)}
        </Descriptions.Item>
        <Descriptions.Item label="巡察开始日期">{previewData.planned_start_date || '-'}</Descriptions.Item>
        <Descriptions.Item label="巡察结束日期">{previewData.planned_end_date || '-'}</Descriptions.Item>
        <Descriptions.Item label="重点领域">
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{previewData.focus_areas || '-'}</pre>
        </Descriptions.Item>
        <Descriptions.Item label="授权文书">{previewData.authorization_letter || '（待填写）'}</Descriptions.Item>
      </Descriptions>
    );
  };

  const steps = [
    { title: '选择被巡察单位' },
    { title: '确认计划信息' },
    { title: '预览确认' },
  ];

  const footer = (
    <Space>
      <Button onClick={onClose}>取消</Button>
      {currentStep > 0 && (
        <Button onClick={() => setCurrentStep((s) => s - 1)}>上一步</Button>
      )}
      {currentStep === 0 && (
        <Button type="primary" onClick={handleStep1Next} loading={loading}>
          下一步
        </Button>
      )}
      {currentStep === 1 && (
        <Button type="primary" onClick={handleStep2Next}>
          下一步（预览）
        </Button>
      )}
      {currentStep === 2 && (
        <Button type="primary" onClick={handleConfirmCreate} loading={submitting}>
          确认创建
        </Button>
      )}
    </Space>
  );

  return (
    <Modal
      title="新建巡察计划"
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
        </>
      )}
    </Modal>
  );
};

export default CreatePlanModal;
