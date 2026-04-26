import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Steps, Form, Input, Select, Button, Card, Table, Space, message, Modal, Tag, Alert, Descriptions } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { createPlan } from '@/api/plans';
import { getUnits } from '@/api/units';
import { getAvailableCadres } from '@/api/groups';
import type { ColumnsType } from 'antd/es/table';

const { TextArea } = Input;

interface Unit {
  id: string;
  name: string;
  type?: string;
  is_inspected?: boolean;
}

interface Cadre {
  id: string;
  name: string;
  position: string;
  rank?: string;
}

interface SelectedUnit extends Unit {}

interface GroupMember {
  cadre_id: string;
  name: string;
  position: string;
  role: '组长' | '副组长' | '组员';
  concurrent_role?: '线索员' | '联络员';
}

const PlanCreateWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  
  // Step 1: Basic info
  const [basicInfo, setBasicInfo] = useState<any>({});
  
  // Step 2: Selected units
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<SelectedUnit[]>([]);
  const [unitSearchText, setUnitSearchText] = useState('');
  const [unitTypeFilter, setUnitTypeFilter] = useState<string | undefined>();
  
  // Step 3: Group matching
  const [eligibleCadres, setEligibleCadres] = useState<Cadre[]>([]);
  const [excludedCadres, _setExcludedCadres] = useState<{ cadre_id: string; name: string; position: string; reason: string }[]>([]);
  const [selectedLeader, setSelectedLeader] = useState<string | undefined>();
  const [selectedDeputyLeaders, setSelectedDeputyLeaders] = useState<string[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [excludedModalVisible, setExcludedModalVisible] = useState(false);
  const [manuallyExcluded, setManuallyExcluded] = useState<{ cadre_id: string; reason: string }[]>([]);
  
  // Step 4: Confirm
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Load units for step 2
    getUnits({ page: 1, page_size: 999 }).then(res => {
      setAllUnits(res.items || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Load available cadres when entering step 3
    if (currentStep === 2 && selectedUnits.length > 0) {
      // Don't pass plan_id - API returns all cadres when no plan exists yet
      getAvailableCadres().then((data: any) => {
        setEligibleCadres(data || []);
      }).catch(() => {
        setEligibleCadres([]);
      });
    }
  }, [currentStep, selectedUnits]);

  const steps = [
    { title: '基本信息', description: '填写计划基本信息' },
    { title: '选择单位', description: '选择被巡察单位' },
    { title: '匹配巡察组', description: '自动匹配巡察组成员' },
    { title: '确认创建', description: '确认并创建计划' },
  ];

  const filteredUnits = allUnits.filter(unit => {
    const matchesSearch = unit.name.toLowerCase().includes(unitSearchText.toLowerCase());
    const matchesType = !unitTypeFilter || unit.type === unitTypeFilter;
    return matchesSearch && matchesType;
  });

  const unitColumns: ColumnsType<Unit> = [
    {
      title: '单位名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Unit) => (
        <span>
          {name}
          {record.is_inspected && <Tag color="red" style={{ marginLeft: 8 }}>已巡察</Tag>}
        </span>
      ),
    },
    { title: '类型', dataIndex: 'type', key: 'type' },
  ];

  const handleSelectUnit = (unit: Unit) => {
    if (!selectedUnits.find(u => u.id === unit.id)) {
      setSelectedUnits([...selectedUnits, unit]);
    }
  };

  const handleRemoveUnit = (unitId: string) => {
    setSelectedUnits(selectedUnits.filter(u => u.id !== unitId));
  };

  const handleLeaderChange = (cadreId: string) => {
    setSelectedLeader(cadreId);
    updateGroupMembers(cadreId, selectedDeputyLeaders, manuallyExcluded);
  };

  const handleDeputyLeaderChange = (cadreIds: string[]) => {
    setSelectedDeputyLeaders(cadreIds);
    updateGroupMembers(selectedLeader, cadreIds, manuallyExcluded);
  };

  const updateGroupMembers = (leaderId: string | undefined, deputyIds: string[], excluded: { cadre_id: string; reason: string }[]) => {
    const members: GroupMember[] = [];
    const allSelectedIds = [...(leaderId ? [leaderId] : []), ...deputyIds];
    
    // Add leader
    if (leaderId) {
      const cadre = eligibleCadres.find(c => c.id === leaderId);
      if (cadre) {
        members.push({
          cadre_id: cadre.id,
          name: cadre.name,
          position: cadre.position,
          role: '组长',
        });
      }
    }
    
    // Add deputy leaders
    deputyIds.forEach(id => {
      const cadre = eligibleCadres.find(c => c.id === id);
      if (cadre) {
        members.push({
          cadre_id: cadre.id,
          name: cadre.name,
          position: cadre.position,
          role: '副组长',
        });
      }
    });
    
    // Auto-add remaining eligible cadres as members (up to reasonable limit)
    const remainingCadres = eligibleCadres.filter(
      c => !allSelectedIds.includes(c.id) && !excluded.find(e => e.cadre_id === c.id)
    ).slice(0, 10);
    
    remainingCadres.forEach(cadre => {
      members.push({
        cadre_id: cadre.id,
        name: cadre.name,
        position: cadre.position,
        role: '组员',
      });
    });
    
    setGroupMembers(members);
  };

  const handleAddManuallyExcluded = (cadreId: string, reason: string) => {
    setManuallyExcluded([...manuallyExcluded, { cadre_id: cadreId, reason }]);
    updateGroupMembers(selectedLeader, selectedDeputyLeaders, [...manuallyExcluded, { cadre_id: cadreId, reason }]);
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      try {
        const values = await form.validateFields();
        setBasicInfo(values);
        setCurrentStep(1);
      } catch {
        // validation failed
      }
    } else if (currentStep === 1) {
      if (selectedUnits.length === 0) {
        message.error('请至少选择一个被巡察单位');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!selectedLeader) {
        message.error('请选择巡察组组长');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Submit and create
      setSubmitting(true);
      try {
        const planData = {
          ...basicInfo,
          target_units: selectedUnits.map(u => u.id),
          group_leader_id: selectedLeader,
          deputy_leader_ids: selectedDeputyLeaders,
          excluded_cadre_ids: manuallyExcluded,
        };
        await createPlan(planData);
        message.success('计划创建成功');
        navigate('/plans');
      } catch (e: any) {
        message.error(e?.response?.data?.detail || '创建失败');
      } finally {
        setSubmitting(false);
      }
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card title="基本信息">
            <Form form={form} layout="vertical" initialValues={{ year: new Date().getFullYear() }}>
              <Form.Item name="name" label="计划名称" rules={[{ required: true, message: '请输入计划名称' }]}>
                <Input placeholder="请输入计划名称" />
              </Form.Item>
              <Form.Item name="year" label="年份" rules={[{ required: true, message: '请输入年份' }]}>
                <Input type="number" placeholder="如：2026" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="round_name" label="轮次">
                <Input placeholder="如：第一轮巡察" />
              </Form.Item>
              <Form.Item name="priority" label="优先级">
                <Select placeholder="请选择优先级">
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="low">低</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="notes" label="备注">
                <TextArea rows={4} placeholder="请输入备注" />
              </Form.Item>
            </Form>
          </Card>
        );
      case 1:
        return (
          <Card title="选择被巡察单位">
            <Space style={{ marginBottom: 16 }}>
              <Input
                placeholder="搜索单位名称"
                prefix={<SearchOutlined />}
                value={unitSearchText}
                onChange={e => setUnitSearchText(e.target.value)}
                style={{ width: 200 }}
              />
              <Select
                placeholder="按类型筛选"
                allowClear
                style={{ width: 150 }}
                value={unitTypeFilter}
                onChange={setUnitTypeFilter}
                options={[
                  { label: '党委', value: 'party' },
                  { label: '政府', value: 'government' },
                  { label: '事业单位', value: 'institution' },
                  { label: '企业', value: 'enterprise' },
                ]}
              />
            </Space>
            <Table
              columns={unitColumns}
              dataSource={filteredUnits}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              onRow={(record) => ({
                onClick: () => handleSelectUnit(record),
                style: { cursor: 'pointer' },
              })}
              rowClassName={(record) => 
                selectedUnits.find(u => u.id === record.id) ? 'selected-row' : ''
              }
            />
            
            <div style={{ marginTop: 24 }}>
              <h4>已选择单位 ({selectedUnits.length})</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selectedUnits.map(unit => (
                  <Tag
                    key={unit.id}
                    closable
                    onClose={() => handleRemoveUnit(unit.id)}
                    color="blue"
                  >
                    {unit.name}
                  </Tag>
                ))}
              </div>
            </div>
          </Card>
        );
      case 2:
        return (
          <Card title="匹配巡察组成员">
            <Alert
              message="系统将根据规则自动匹配巡察组成员，您也可以手动调整"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <h4>选择组长 *</h4>
                <Select
                  placeholder="请选择组长"
                  style={{ width: 300 }}
                  value={selectedLeader}
                  onChange={handleLeaderChange}
                  options={eligibleCadres.map(c => ({
                    label: `${c.name}（${c.position}）`,
                    value: c.id,
                  }))}
                />
              </div>
              
              <div>
                <h4>选择副组长（最多2名）</h4>
                <Select
                  mode="multiple"
                  placeholder="请选择副组长"
                  style={{ width: 300 }}
                  maxCount={2}
                  value={selectedDeputyLeaders}
                  onChange={handleDeputyLeaderChange}
                  options={eligibleCadres
                    .filter(c => c.id !== selectedLeader)
                    .map(c => ({
                      label: `${c.name}（${c.position}）`,
                      value: c.id,
                    }))}
                />
              </div>
              
              <div>
                <Space>
                  <h4>自动生成的组员</h4>
                  <Button
                    size="small"
                    onClick={() => setExcludedModalVisible(true)}
                  >
                    手动添加被排除人员
                  </Button>
                </Space>
                {groupMembers.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    <p>组长：{groupMembers.find(m => m.role === '组长')?.name}（{groupMembers.find(m => m.role === '组长')?.position}）</p>
                    {groupMembers.filter(m => m.role === '副组长').length > 0 && (
                      <p>副组长：{groupMembers.filter(m => m.role === '副组长').map(m => `${m.name}（${m.position}）`).join('、')}</p>
                    )}
                    {groupMembers.filter(m => m.role === '组员').length > 0 && (
                      <p>组员：{groupMembers.filter(m => m.role === '组员').map(m => `${m.name}（${m.position}）`).join('、')}</p>
                    )}
                  </div>
                ) : (
                  <p style={{ color: '#999' }}>请先选择组长</p>
                )}
              </div>
            </Space>
            
            <Modal
              title="手动添加被排除人员"
              open={excludedModalVisible}
              onCancel={() => setExcludedModalVisible(false)}
              footer={null}
              width={600}
            >
              <Table
                columns={[
                  { title: '姓名', dataIndex: 'name', key: 'name' },
                  { title: '职务', dataIndex: 'position', key: 'position' },
                  { title: '排除原因', dataIndex: 'reason', key: 'reason' },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_: any, record: any) => (
                      <Button
                        size="small"
                        onClick={() => {
                          handleAddManuallyExcluded(record.cadre_id, record.reason);
                          setExcludedModalVisible(false);
                        }}
                      >
                        排除
                      </Button>
                    ),
                  },
                ]}
                dataSource={excludedCadres}
                rowKey="cadre_id"
                size="small"
                pagination={false}
              />
            </Modal>
          </Card>
        );
      case 3:
        return (
          <Card title="确认创建">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="计划名称">{basicInfo.name}</Descriptions.Item>
              <Descriptions.Item label="年份">{basicInfo.year}</Descriptions.Item>
              <Descriptions.Item label="轮次">{basicInfo.round_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="优先级">{basicInfo.priority || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注">{basicInfo.notes || '-'}</Descriptions.Item>
              <Descriptions.Item label="被巡察单位">
                {selectedUnits.map(u => u.name).join('、')}
              </Descriptions.Item>
              <Descriptions.Item label="巡察组">
                组长：{groupMembers.find(m => m.role === '组长')?.name}（{groupMembers.find(m => m.role === '组长')?.position}）
                {groupMembers.filter(m => m.role === '副组长').length > 0 && (
                  <>，副组长：{groupMembers.filter(m => m.role === '副组长').map(m => `${m.name}（${m.position}）`).join('、')}</>
                )}
                {groupMembers.filter(m => m.role === '组员').length > 0 && (
                  <>，组员：{groupMembers.filter(m => m.role === '组员').map(m => `${m.name}（${m.position}）`).join('、')}</>
                )}
              </Descriptions.Item>
            </Descriptions>
            
            {excludedCadres.length > 0 && (
              <Alert
                message="以下人员被排除"
                description={excludedCadres.map(e => `${e.name}：${e.reason}`).join('；')}
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <PageHeader
        title="新建巡察计划"
        breadcrumbs={[
          { name: '巡察计划', path: '/plans' },
          { name: '新建计划' },
        ]}
      />
      
      <Card>
        <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />
        
        {renderStepContent()}
        
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Space>
            {currentStep > 0 && <Button onClick={handleBack}>上一步</Button>}
            <Button type="primary" onClick={handleNext} loading={submitting}>
              {currentStep === 3 ? '确认创建' : '下一步'}
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default PlanCreateWizard;
