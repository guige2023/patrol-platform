import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Switch, Button, Card, Space, message, Modal, Table, Tag } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '@/components/common/PageHeader';
import { getCadreDetail, updateCadre, getCadreGroups } from '@/api/cadres';
import { getUnits } from '@/api/units';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import { getErrorMessage } from '@/utils/error';

const { TextArea } = Input;

const CadreDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { getOptions } = useFieldOptions();
  const categoryOptions = getOptions('cadre_category');
  const rankOptions = getOptions('cadre_rank');
  const tagsOptions = getOptions('cadre_tags');

  const [unitOptions, setUnitOptions] = useState<{ label: string; value: string }[]>([]);
  const [originalData, setOriginalData] = useState<any>(null);

  // 关联巡察组
  const [groupsModalOpen, setGroupsModalOpen] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsData, setGroupsData] = useState<any[]>([]);

  useEffect(() => {
    getUnits({ page: 1, page_size: 999 }).then(res => {
      setUnitOptions(res.items.map((u: any) => ({ label: u.name, value: u.id })));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (id) {
      getCadreDetail(id).then((res: any) => {
        setOriginalData(res);
        const vals: any = { ...res };
        if (res.birth_date) vals.birth_date = dayjs(res.birth_date);
        // tags dict -> string[]
        if (res.tags && typeof res.tags === 'object' && !Array.isArray(res.tags)) {
          const expertise = res.tags["熟悉领域"];
          vals.tags = expertise ? expertise.split("、").filter(Boolean) : [];
        }
        // achievements list -> text
        const ach = res.achievements;
        if (Array.isArray(ach) && ach.length > 0) {
          vals.achievements = ach.map((a: any) => typeof a === 'string' ? a : a.content || '').join('；');
        } else {
          vals.achievements = '';
        }
        form.setFieldsValue(vals);
      }).catch(console.error);
    }
  }, [id]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const payload: any = { ...values };
      if (payload.birth_date) payload.birth_date = payload.birth_date.format('YYYY-MM-DD');
      // tags string[] -> dict
      if (payload.tags && Array.isArray(payload.tags)) {
        payload.tags = { "熟悉领域": payload.tags.join("、") };
      }
      // achievements text -> list
      if (payload.achievements && typeof payload.achievements === 'string') {
        payload.achievements = [{ "content": payload.achievements }];
      }
      await updateCadre(id!, payload);
      message.success('保存成功');
      navigate('/archive/cadres');
    } catch (e: any) {
      message.error(getErrorMessage(e) || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const openGroupsModal = async () => {
    if (!id) return;
    setGroupsModalOpen(true);
    setGroupsLoading(true);
    try {
      const data = await getCadreGroups(id);
      setGroupsData(data || []);
    } catch {
      message.error('加载关联巡察组失败');
    } finally {
      setGroupsLoading(false);
    }
  };

  const groupColumns = [
    { title: '巡察组名称', dataIndex: 'group_name', key: 'group_name' },
    { title: '巡察计划', dataIndex: 'plan_name', key: 'plan_name', render: (v: string) => v || '-' },
    {
      title: '角色',
      dataIndex: 'is_leader',
      key: 'is_leader',
      render: (leader: boolean, record: any) =>
        leader ? <Tag color="blue">组长</Tag> : <Tag>{record.role || '组员'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'group_status',
      key: 'group_status',
      render: (s: string) => {
        const colorMap: Record<string, string> = { draft: 'default', authorized: 'blue', active: 'green', completed: 'gray' };
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>;
      },
    },
  ];

  const formItemRow = (children: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{children}</div>
  );

  return (
    <div>
      <PageHeader
        title="干部详情"
        breadcrumbs={[
          { name: '档案管理' },
          { name: '干部人才库', path: '/archive/cadres' },
          { name: originalData?.name || '干部详情' },
        ]}
        extra={
          <Button icon={<TeamOutlined />} onClick={openGroupsModal}>
            查看关联巡察组
          </Button>
        }
      />
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>基本信息</div>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          {formItemRow(
            <>
              <Form.Item name="gender" label="性别">
                <Select options={[{label:'男',value:'男'},{label:'女',value:'女'}]} placeholder="请选择" allowClear />
              </Form.Item>
              <Form.Item name="birth_date" label="出生日期">
                <Input type="date" placeholder="YYYY-MM-DD" />
              </Form.Item>
            </>
          )}
          {formItemRow(
            <>
              <Form.Item name="ethnicity" label="民族">
                <Input placeholder="如 汉" />
              </Form.Item>
              <Form.Item name="native_place" label="籍贯">
                <Input placeholder="如 浙江杭州" />
              </Form.Item>
            </>
          )}
          {formItemRow(
            <>
              <Form.Item name="political_status" label="政治面貌">
                <Select
                  options={[
                    { label: '中共党员', value: '中共党员' },
                    { label: '中共预备党员', value: '中共预备党员' },
                    { label: '共青团员', value: '共青团员' },
                    { label: '群众', value: '群众' },
                  ]}
                  placeholder="请选择" allowClear showSearch />
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
                  placeholder="请选择" allowClear showSearch />
              </Form.Item>
            </>
          )}
          {formItemRow(
            <>
              <Form.Item name="degree" label="学位">
                <Select
                  options={[
                    { label: '博士学位', value: '博士学位' },
                    { label: '硕士学位', value: '硕士学位' },
                    { label: '学士学位', value: '学士学位' },
                  ]}
                  placeholder="请选择" allowClear showSearch />
              </Form.Item>
              <Form.Item name="is_available" label="是否可用" valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="可用" unCheckedChildren="不可用" />
              </Form.Item>
            </>
          )}

          <div style={{ fontSize: 14, fontWeight: 500, margin: '20px 0 12px' }}>职务信息</div>
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
          {formItemRow(
            <>
              <Form.Item name="position" label="职务">
                <Input placeholder="请输入职务（选填）" />
              </Form.Item>
              <Form.Item name="rank" label="职级">
                <Select options={rankOptions} placeholder="请选择职级" allowClear showSearch />
              </Form.Item>
            </>
          )}
          {formItemRow(
            <>
              <Form.Item name="category" label="类别">
                <Select options={categoryOptions} placeholder="请选择类别" allowClear showSearch />
              </Form.Item>
              <Form.Item name="tags" label="熟悉领域">
                <Select mode="multiple" options={tagsOptions} placeholder="请选择熟悉领域" allowClear maxTagCount={5} />
              </Form.Item>
            </>
          )}

          <div style={{ fontSize: 14, fontWeight: 500, margin: '20px 0 12px' }}>简历信息</div>
          <Form.Item name="profile" label="简历">
            <TextArea rows={3} placeholder="请输入个人简历" />
          </Form.Item>
          <Form.Item name="resume" label="工作经历">
            <TextArea rows={3} placeholder="请输入工作经历" />
          </Form.Item>
          <Form.Item name="achievements" label="工作成果">
            <TextArea rows={2} placeholder="请输入主要工作成果或业绩" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
              <Button onClick={() => navigate('/archive/cadres')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        title="关联巡察组"
        open={groupsModalOpen}
        onCancel={() => setGroupsModalOpen(false)}
        footer={null}
        width={640}
      >
        <Table
          rowKey="group_id"
          loading={groupsLoading}
          dataSource={groupsData}
          columns={groupColumns}
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无关联巡察组' }}
        />
      </Modal>
    </div>
  );
};

export default CadreDetail;
