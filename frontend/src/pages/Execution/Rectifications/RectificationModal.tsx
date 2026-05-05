import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, Button, Space, Slider, message, Descriptions, Switch, Upload, List } from 'antd';
import { FileTextOutlined, UploadOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { getUnits } from '@/api/units';
import { getClues } from '@/api/clues';
import { getDrafts } from '@/api/drafts';
import { createRectification, updateRectification, getRectification, updateRectificationProgress, rejectRectification, getRectificationAttachments, uploadRectificationAttachment, deleteRectificationAttachment } from '@/api/rectifications';
import DraftDetail from '@/pages/Execution/Drafts/DraftDetail';
import dayjs from 'dayjs';
import { getErrorMessage } from '@/utils/error';
import { useAuthStore, hasPermission } from '@/store/auth';

const { TextArea } = Input;

const ALERT_LEVEL_OPTIONS = [
  { label: '绿色', value: 'green' },
  { label: '黄色', value: 'yellow' },
  { label: '橙色', value: 'orange' },
  { label: '红色', value: 'red' },
];

const STATUS_OPTIONS = [
  { label: '已派发', value: 'dispatched' },
  { label: '已签收', value: 'signed' },
  { label: '整改中', value: 'progressing' },
  { label: '已完成', value: 'completed' },
  { label: '待验收', value: 'submitted' },
  { label: '已验收', value: 'verified' },
  { label: '已驳回', value: 'rejected' },
];

interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at?: string;
}

interface RectificationModalProps {
  open: boolean;
  rectificationId?: string | null;
  defaultEditMode?: boolean;
  defaultClueId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const RectificationModal: React.FC<RectificationModalProps> = ({ open, rectificationId, defaultEditMode = false, defaultClueId = null, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [isViewMode, setIsViewMode] = useState(!defaultEditMode);
  const [form] = Form.useForm();
  const [unitOptions, setUnitOptions] = useState<{ label: string; value: string }[]>([]);
  const [clueOptions, setClueOptions] = useState<{ label: string; value: string }[]>([]);
  const [draftOptions, setDraftOptions] = useState<{ label: string; value: string }[]>([]);
  const [rectificationData, setRectificationData] = useState<any>(null);
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftModalId, setDraftModalId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  // 权限检查
  const { user } = useAuthStore();
  const canApprove = hasPermission(user, 'rectification:approve');

  useEffect(() => {
    if (open) {
      fetchUnits();
      fetchClues();
      fetchDrafts();
      if (rectificationId) {
        setIsViewMode(!defaultEditMode);
        fetchRectificationData(rectificationId);
        fetchAttachments(rectificationId);
      } else {
        setIsViewMode(false);
        setRectificationData(null);
        setAttachments([]);
        form.resetFields();
      }
    }
  }, [open, rectificationId]);

  const fetchUnits = async () => {
    try {
      const res = await getUnits({ page: 1, page_size: 100 });
      const units = (res && Array.isArray(res.items)) ? res.items : [];
      setUnitOptions(units.map((u: any) => ({ label: u.name, value: u.id })));
    } catch {
      message.error('获取单位失败');
    }
  };

  const fetchClues = async () => {
    try {
      const res = await getClues({ page: 1, page_size: 100 });
      const clues = (res && Array.isArray(res.items)) ? res.items : [];
      setClueOptions(clues.map((c: any) => ({ label: c.title, value: c.id })));
    } catch {
      message.error('获取线索失败');
    }
  };

  useEffect(() => {
    if (open && defaultClueId && clueOptions.length > 0) {
      form.setFieldsValue({ clue_id: defaultClueId });
    }
  }, [open, defaultClueId, clueOptions]);

  const fetchDrafts = async () => {
    try {
      const res = await getDrafts({ page: 1, page_size: 100 });
      const drafts = (res && Array.isArray(res.items)) ? res.items : [];
      setDraftOptions(drafts.map((d: any) => ({ label: d.title, value: d.id })));
    } catch {
      message.error('获取底稿失败');
    }
  };

  const fetchRectificationData = async (id: string) => {
    try {
      const res = await getRectification(id);
      const data = res?.data || res;
      if (data.deadline) {
        data.deadline = dayjs(data.deadline);
      }
      if (data.completion_date) {
        data.completion_date = dayjs(data.completion_date);
      }
      setRectificationData(data);
    } catch {
      message.error('获取整改详情失败');
    }
  };

  const fetchAttachments = async (id: string) => {
    try {
      const res = await getRectificationAttachments(id);
      setAttachments(Array.isArray(res) ? res : []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (rectificationData && unitOptions.length > 0) {
      form.setFieldsValue(rectificationData);
    }
  }, [rectificationData, unitOptions]);

  const handleUpdateProgress = async () => {
    if (!rectificationId) return;
    try {
      const values = form.getFieldsValue();
      let details;
      if (values.progress_details) {
        try {
          details = typeof values.progress_details === 'string'
            ? JSON.parse(values.progress_details)
            : values.progress_details;
        } catch {
          message.warning('进度详情格式不正确，请输入有效的JSON数组');
          return;
        }
      }
      await updateRectificationProgress(rectificationId, values.progress || 0, details);
      message.success('进度更新成功');
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(getErrorMessage(err) || '进度更新失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = { ...values };
      if (payload.deadline) {
        payload.deadline = payload.deadline.format('YYYY-MM-DD');
      }
      if (payload.completion_date) {
        payload.completion_date = payload.completion_date.format('YYYY-MM-DD');
      }
      setLoading(true);
      if (rectificationId) {
        await updateRectification(rectificationId, payload);
        message.success('编辑整改成功');
      } else {
        await createRectification(payload);
        message.success('派发整改成功');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(getErrorMessage(err) || (rectificationId ? '编辑整改失败' : '派发整改失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const handleSwitchToEdit = () => {
    setIsViewMode(false);
  };

  const getUnitName = (id: string) => unitOptions.find(u => u.value === id)?.label || id;
  const getClueTitle = (id: string) => clueOptions.find(c => c.value === id)?.label || id;
  const getDraftTitle = (id: string) => draftOptions.find(d => d.value === id)?.label || id;

  const handleUploadAttachment = async (file: File) => {
    if (!rectificationId) {
      message.warning('请先保存整改记录后再上传附件');
      return false;
    }
    setUploading(true);
    try {
      await uploadRectificationAttachment(rectificationId, file);
      message.success('附件上传成功');
      await fetchAttachments(rectificationId);
    } catch (err: any) {
      message.error(getErrorMessage(err) || '上传失败');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!rectificationId) return;
    try {
      await deleteRectificationAttachment(rectificationId, attachmentId);
      message.success('附件已删除');
      await fetchAttachments(rectificationId);
    } catch (err: any) {
      message.error(getErrorMessage(err) || '删除失败');
    }
  };

  const handleReject = async () => {
    if (!rejectTargetId || !rejectReason.trim()) {
      message.warning('请输入驳回原因');
      return;
    }
    setRejectLoading(true);
    try {
      await rejectRectification(rejectTargetId, rejectReason.trim());
      message.success('整改已驳回');
      setRejectModalOpen(false);
      setRejectReason('');
      setRejectTargetId(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(getErrorMessage(err) || '驳回失败');
    } finally {
      setRejectLoading(false);
    }
  };

  const downloadAttachment = (attachment: Attachment) => {
    if (!rectificationId) return;
    window.open(`/api/v1/rectifications/${rectificationId}/attachments/${attachment.id}/download`, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderViewMode = () => (
    <>
      <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
        <Descriptions.Item label="标题">{rectificationData?.title || '-'}</Descriptions.Item>
        <Descriptions.Item label="被整改单位">{rectificationData?.unit_name || getUnitName(rectificationData?.unit_id) || '-'}</Descriptions.Item>
        <Descriptions.Item label="预警级别">
          {ALERT_LEVEL_OPTIONS.find(a => a.value === rectificationData?.alert_level)?.label || rectificationData?.alert_level || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="关联线索">{getClueTitle(rectificationData?.clue_id) || '-'}</Descriptions.Item>
        <Descriptions.Item label="关联底稿">
          {rectificationData?.draft_id ? (
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => { setDraftModalId(rectificationData.draft_id); setDraftModalOpen(true); }}
            >
              {getDraftTitle(rectificationData.draft_id) || '查看底稿'}
            </Button>
          ) : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="整改状态">
          {STATUS_OPTIONS.find(s => s.value === rectificationData?.status)?.label || rectificationData?.status || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="问题描述">{rectificationData?.problem_description || '-'}</Descriptions.Item>
        <Descriptions.Item label="整改要求">{rectificationData?.rectification_requirement || '-'}</Descriptions.Item>
        <Descriptions.Item label="截止日期">
          {rectificationData?.deadline ? dayjs(rectificationData.deadline).format('YYYY-MM-DD') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="完成日期">
          {rectificationData?.completion_date ? dayjs(rectificationData.completion_date).format('YYYY-MM-DD') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="进度">{rectificationData?.progress !== undefined ? `${rectificationData.progress}%` : '-'}</Descriptions.Item>
        <Descriptions.Item label="进度详情">{rectificationData?.progress_details ? (typeof rectificationData.progress_details === 'string' ? rectificationData.progress_details : JSON.stringify(rectificationData.progress_details)) : '-'}</Descriptions.Item>
        <Descriptions.Item label="整改完成报告">{rectificationData?.completion_report || '-'}</Descriptions.Item>
        <Descriptions.Item label="验收意见">{rectificationData?.verification_comment || '-'}</Descriptions.Item>
        {rectificationData?.status === 'rejected' && (
          <>
            <Descriptions.Item label="驳回原因" style={{ color: '#ff4d4f' }}>
              {rectificationData?.rejection_reason || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="驳回时间">
              {rectificationData?.rejected_at ? dayjs(rectificationData.rejected_at).format('YYYY-MM-DD HH:mm') : '-'}
            </Descriptions.Item>
          </>
        )}
      </Descriptions>

      {/* 证据文件列表 */}
      {rectificationId && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <b>证据附件（{attachments.length}）</b>
            <Upload
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
              showUploadList={false}
              beforeUpload={handleUploadAttachment}
              disabled={uploading}
            >
              <Button icon={<UploadOutlined />} size="small" loading={uploading}>上传证据</Button>
            </Upload>
          </div>
          {attachments.length === 0 ? (
            <div style={{ color: '#999', textAlign: 'center', padding: '16px 0' }}>暂无证据附件</div>
          ) : (
            <List
              size="small"
              bordered
              dataSource={attachments}
              renderItem={(att: Attachment) => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" icon={<DownloadOutlined />} key="download" onClick={() => downloadAttachment(att)}>下载</Button>,
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} key="delete" onClick={() => handleDeleteAttachment(att.id)}>删除</Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={att.file_name}
                    description={`${formatFileSize(att.file_size)} · ${att.created_at ? dayjs(att.created_at).format('YYYY-MM-DD HH:mm') : ''}`}
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      )}

      {/* 驳回操作区（仅 submitted/completed 状态 + 有审批权限的用户显示驳回按钮） */}
      {canApprove && (rectificationData?.status === 'submitted' || rectificationData?.status === 'completed') ? (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fff2e6', borderRadius: 4, border: '1px solid #ffbb80' }}>
          <div style={{ color: '#d46b08', marginBottom: 8 }}>对整改结果有异议？</div>
          <Button
            danger
            size="small"
            onClick={() => { setRejectTargetId(rectificationId ?? null); setRejectModalOpen(true); }}
          >
            驳回整改
          </Button>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <Modal
        title={rectificationId ? '整改详情' : '派发整改'}
        open={open}
        onCancel={handleCancel}
        width={800}
        footer={null}
      >
        {rectificationId && (
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <Switch
              checkedChildren="编辑模式"
              unCheckedChildren="查看模式"
              checked={!isViewMode}
              onChange={(v) => v ? handleSwitchToEdit() : setIsViewMode(true)}
            />
          </div>
        )}
        {rectificationId && isViewMode ? renderViewMode() : (
          <Form form={form} layout="vertical" style={{ marginTop: rectificationId ? 0 : 0 }}>
            <Form.Item
              name="title"
              label="标题"
              rules={[{ required: true, message: '请输入标题' }]}
            >
              <Input placeholder="请输入标题" />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item name="unit_id" label="被整改单位" rules={[{ required: true, message: '请选择被整改单位' }]}>
                <Select placeholder="请选择被整改单位" options={unitOptions} showSearch filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
              </Form.Item>
              <Form.Item name="alert_level" label="预警级别">
                <Select placeholder="请选择预警级别" options={ALERT_LEVEL_OPTIONS} />
              </Form.Item>
            </div>

            <Form.Item name="clue_id" label="关联线索">
              <Select placeholder="请选择关联线索" options={clueOptions} />
            </Form.Item>

            <Form.Item name="draft_id" label="关联底稿">
              <Select placeholder="请选择关联底稿" options={draftOptions} />
            </Form.Item>

            <Form.Item name="status" label="整改状态">
              <Select placeholder="请选择整改状态" options={STATUS_OPTIONS} />
            </Form.Item>

            <Form.Item
              name="problem_description"
              label="问题描述"
              rules={[{ required: true, message: '请输入问题描述' }]}
            >
              <TextArea rows={4} placeholder="请输入问题描述" />
            </Form.Item>

            <Form.Item name="rectification_requirement" label="整改要求">
              <TextArea rows={4} placeholder="请输入整改要求" />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item name="deadline" label="截止日期">
                <DatePicker style={{ width: '100%' }} placeholder="请选择截止日期" />
              </Form.Item>
              <Form.Item name="completion_date" label="完成日期">
                <DatePicker style={{ width: '100%' }} placeholder="请选择完成日期" />
              </Form.Item>
            </div>

            <Form.Item name="progress" label="进度">
              <Slider min={0} max={100} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
            </Form.Item>

            <Form.Item
              name="progress_details"
              label="进度详情"
              extra={<span>格式：JSON数组，示例：[&#123;"date": "2026-04-01", "content": "已完成部分整改", "percentage": 30&#125;]</span>}
            >
              <TextArea rows={3} placeholder="JSON数组格式" />
            </Form.Item>

            <Form.Item name="completion_report" label="整改完成报告">
              <TextArea rows={4} placeholder="请输入整改完成报告" />
            </Form.Item>

            <Form.Item name="verification_comment" label="验收意见">
              <TextArea rows={3} placeholder="请输入验收意见" />
            </Form.Item>

            <div style={{ textAlign: 'right', marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
              <Space>
                <Button onClick={handleCancel}>取消</Button>
                {rectificationId && !isViewMode && (
                  <Button onClick={handleUpdateProgress}>更新进度</Button>
                )}
                <Button type="primary" onClick={handleSubmit} loading={loading}>
                  {rectificationId ? '保存' : '派发'}
                </Button>
              </Space>
            </div>
          </Form>
        )}
      </Modal>

      {/* 驳回弹窗 */}
      <Modal
        title="驳回整改"
        open={rejectModalOpen}
        onCancel={() => { setRejectModalOpen(false); setRejectReason(''); setRejectTargetId(null); }}
        onOk={handleReject}
        confirmLoading={rejectLoading}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 8, color: '#ff4d4f' }}>请输入驳回原因（必填）：</div>
        <TextArea
          rows={4}
          placeholder="请详细说明驳回原因，以便整改单位重新整改"
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
        />
      </Modal>

      <DraftDetail
        open={draftModalOpen}
        editingId={draftModalId}
        onClose={() => { setDraftModalOpen(false); setDraftModalId(null); }}
        onSuccess={() => { setDraftModalOpen(false); setDraftModalId(null); }}
      />
    </>
  );
};

export default RectificationModal;
