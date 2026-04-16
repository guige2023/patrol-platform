import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Switch, Modal, message, Card, Popconfirm, Alert, Row, Col, Statistic } from 'antd';
import { DownloadOutlined, DeleteOutlined, DatabaseOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getBackups, createBackup, restoreBackup, deleteBackup, downloadBackup, getBackupSettings, updateBackupSettings } from '@/api/backup';
import { getErrorMessage } from '@/utils/error';
import type { ColumnsType } from 'antd/es/table';

interface BackupRecord {
  id: string;
  filename: string;
  type: 'auto' | 'manual';
  size: number;
  created_at: string;
}

const BackupPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BackupRecord[]>([]);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [backups, settings] = await Promise.all([
        getBackups(),
        getBackupSettings(),
      ]);
      setData(backups || []);
      setAutoBackupEnabled(settings?.auto_backup_enabled ?? false);
    } catch (e: any) {
      message.error(getErrorMessage(e) || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await createBackup();
      message.success('备份创建成功');
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    setRestoring(true);
    try {
      await restoreBackup(selectedBackup.id);
      message.success('数据恢复成功');
      setRestoreModalVisible(false);
    } catch (e: any) {
      message.error(getErrorMessage(e) || '恢复失败');
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBackup(id);
      message.success('删除成功');
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '删除失败');
    }
  };

  const handleDownload = (record: BackupRecord) => {
    downloadBackup(record.id).catch(() => message.error('下载失败'));
  };

  const handleAutoBackupChange = async (checked: boolean) => {
    try {
      await updateBackupSettings(checked);
      setAutoBackupEnabled(checked);
      message.success('设置成功');
    } catch {
      message.error('设置失败');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const columns: ColumnsType<BackupRecord> = [
    {
      title: '备份时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: '备份类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <span style={{ color: type === 'auto' ? '#888' : '#1677ff' }}>
          {type === 'auto' ? '自动' : '手动'}
        </span>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => formatSize(size),
    },
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: BackupRecord) => (
        <Space>
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)}>
            下载
          </Button>
          <Button type="link" size="small" onClick={() => {
            setSelectedBackup(record);
            setRestoreModalVisible(true);
          }}>
            恢复
          </Button>
          <Popconfirm title="确认删除该备份？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="备份与恢复"
        breadcrumbs={[
          { name: '系统管理' },
          { name: '备份与恢复' },
        ]}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="备份总数"
              value={data.length}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="自动备份"
              value={autoBackupEnabled ? '已启用' : '已禁用'}
              valueStyle={{ color: autoBackupEnabled ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="最近备份"
              value={data.length > 0 ? new Date(data[0].created_at).toLocaleDateString() : '暂无'}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<DatabaseOutlined />}
            onClick={handleCreateBackup}
            loading={creating}
          >
            创建备份
          </Button>
          <span style={{ color: '#888' }}>
            自动备份：
            <Switch
              checked={autoBackupEnabled}
              onChange={handleAutoBackupChange}
              style={{ marginLeft: 8 }}
            />
          </span>
        </Space>

        <Alert
          message="提示：恢复数据将覆盖当前所有数据，请谨慎操作。建议在恢复前先创建新的备份。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="恢复数据"
        open={restoreModalVisible}
        onCancel={() => {
          setRestoreModalVisible(false);
          setSelectedBackup(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => setRestoreModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="restore"
            type="primary"
            danger
            loading={restoring}
            onClick={handleRestore}
          >
            确认恢复
          </Button>,
        ]}
      >
        {selectedBackup && (
          <div>
            <p>确认要恢复以下备份吗？</p>
            <p style={{ fontWeight: 'bold' }}>{selectedBackup.filename}</p>
            <p style={{ color: '#888' }}>
              创建时间：{new Date(selectedBackup.created_at).toLocaleString()}
            </p>
            <Alert
              message="警告：恢复操作将覆盖当前所有数据，此操作不可逆！"
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BackupPage;
