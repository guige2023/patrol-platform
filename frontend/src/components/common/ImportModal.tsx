import React, { useState } from 'react';
import { Modal, Steps, Button, Upload, List, Alert, Space, message } from 'antd';
import { DownloadOutlined, UploadOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

interface ImportModalProps {
  open: boolean;
  title: string;
  templateUrl: string;
  importApiUrl: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({
  open,
  title,
  templateUrl,
  importApiUrl,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);

  const steps = [
    { title: '下载模板', description: '下载导入模板文件' },
    { title: '上传文件', description: '上传填写好的Excel文件' },
    { title: '预览数据', description: '确认导入数据预览' },
    { title: '确认导入', description: '执行导入操作' },
  ];

  const handleDownloadTemplate = () => {
    window.open(templateUrl, '_blank');
  };

  const handleUploadChange = ({ fileList: newFileList }: { fileList: UploadFile[] }) => {
    setFileList(newFileList);
    if (newFileList.length > 0 && newFileList[0].originFileObj) {
      // 读取文件进行预览
      const reader = new FileReader();
      reader.onload = () => {
        try {
          // 简单预览：显示文件名
          setPreviewData([{ fileName: newFileList[0].name }]);
        } catch {
          message.error('文件读取失败');
        }
      };
      reader.readAsText(newFileList[0].originFileObj as Blob);
    }
  };

  const handleConfirmImport = async () => {
    if (!fileList[0]?.originFileObj) {
      message.error('请先上传文件');
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', fileList[0].originFileObj as Blob);

      const api = (await import('@/api/client')).default;
      const response = await api.post(importApiUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const result = response.data;
      setImportResult({
        success: result.created || 0,
        failed: result.skipped || 0,
        errors: result.errors || [],
      });
      setCurrentStep(3);
      onSuccess?.();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      if (detail && typeof detail === 'object' && Array.isArray(detail.errors)) {
        setImportResult({
          success: 0,
          failed: 0,
          errors: detail.errors as string[],
        });
        setCurrentStep(3);
      } else {
        message.error('导入失败');
      }
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setFileList([]);
    setPreviewData([]);
    setImportResult(null);
    onClose();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              size="large"
              onClick={handleDownloadTemplate}
            >
              下载导入模板
            </Button>
            <p style={{ marginTop: 16, color: '#666' }}>
              请下载模板文件，填写完成后上传
            </p>
          </div>
        );
      case 1:
        return (
          <div style={{ padding: '20px 0' }}>
            <Upload
              fileList={fileList}
              onChange={handleUploadChange}
              beforeUpload={() => false}
              accept=".xlsx"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择 Excel 文件</Button>
            </Upload>
            <p style={{ marginTop: 16, color: '#666', fontSize: 12 }}>
              支持 .xlsx 格式文件
            </p>
          </div>
        );
      case 2:
        return (
          <div style={{ padding: '20px 0' }}>
            {previewData.length > 0 ? (
              <Alert
                message="文件已准备就绪"
                description={`文件：${previewData[0].fileName}`}
                type="success"
                showIcon
              />
            ) : (
              <Alert message="请先上传文件" type="warning" showIcon />
            )}
          </div>
        );
      case 3:
        return (
          <div style={{ padding: '20px 0' }}>
            {importResult ? (
              <>
                <Alert
                  message={`导入完成：成功 ${importResult.success} 条，跳过 ${importResult.failed} 条`}
                  type={importResult.errors.length > 0 ? 'warning' : 'success'}
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                {importResult.errors.length > 0 && (
                  <List
                    size="small"
                    bordered
                    dataSource={importResult.errors}
                    style={{ maxHeight: 200, overflow: 'auto' }}
                    renderItem={(item: string) => (
                      <List.Item style={{ padding: '8px 12px' }}>
                        <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                        {item}
                      </List.Item>
                    )}
                  />
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                <p style={{ marginTop: 16 }}>导入成功！</p>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const renderFooter = () => {
    return (
      <Space>
        {currentStep > 0 && currentStep < 3 && (
          <Button onClick={() => setCurrentStep(currentStep - 1)}>上一步</Button>
        )}
        {currentStep < 2 && (
          <Button type="primary" disabled={currentStep === 1 && fileList.length === 0} onClick={() => setCurrentStep(currentStep + 1)}>
            下一步
          </Button>
        )}
        {currentStep === 2 && (
          <Button type="primary" onClick={handleConfirmImport} loading={importing}>
            确认导入
          </Button>
        )}
        {currentStep === 3 && (
          <Button type="primary" onClick={handleClose}>
            完成
          </Button>
        )}
      </Space>
    );
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={handleClose}
      footer={renderFooter()}
      width={600}
    >
      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />
      {renderStepContent()}
    </Modal>
  );
};

export default ImportModal;
