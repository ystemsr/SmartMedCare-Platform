import React, { useState } from 'react';
import { Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile as AntUploadFile, UploadChangeParam } from 'antd/es/upload';
import { getToken } from '../utils/storage';

interface UploadFileProps {
  category?: string;
  elderId?: number;
  onSuccess?: (fileInfo: { file_id: number; file_name: string; url: string }) => void;
  accept?: string;
  maxCount?: number;
}

/**
 * File upload component backed by the /files/upload API.
 */
const UploadFile: React.FC<UploadFileProps> = ({
  category,
  elderId,
  onSuccess,
  accept,
  maxCount = 1,
}) => {
  const [fileList, setFileList] = useState<AntUploadFile[]>([]);

  const handleChange = (info: UploadChangeParam) => {
    setFileList(info.fileList);
    if (info.file.status === 'done') {
      const res = info.file.response;
      if (res?.code === 0) {
        message.success('上传成功');
        onSuccess?.(res.data);
      } else {
        message.error(res?.message || '上传失败');
      }
    } else if (info.file.status === 'error') {
      message.error('上传失败');
    }
  };

  const data: Record<string, string> = {};
  if (category) data.category = category;
  if (elderId) data.elder_id = String(elderId);

  return (
    <Upload
      action="/api/v1/files/upload"
      headers={{ Authorization: `Bearer ${getToken() || ''}` }}
      data={data}
      fileList={fileList}
      onChange={handleChange}
      accept={accept}
      maxCount={maxCount}
    >
      <Button icon={<UploadOutlined />}>上传文件</Button>
    </Upload>
  );
};

export default UploadFile;
