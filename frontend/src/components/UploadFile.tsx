import React, { useState } from 'react';
import { Button } from '@mui/material';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import http from '../api/http';
import { message } from '../utils/message';

interface UploadFileProps {
  category?: string;
  elderId?: number;
  onSuccess?: (fileInfo: { file_id: number; file_name: string; url: string }) => void;
  onUpload?: (file: File) => Promise<void> | void;
  accept?: string;
  maxCount?: number;
  buttonText?: string;
}

/**
 * File upload component backed by the /files/upload API.
 */
const UploadFile: React.FC<UploadFileProps> = ({
  category,
  elderId,
  onSuccess,
  onUpload,
  accept,
  maxCount = 1,
  buttonText = '上传文件',
}) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (category) {
      formData.append('category', category);
    }
    if (elderId) {
      formData.append('elder_id', String(elderId));
    }

    setUploading(true);

    try {
      if (onUpload) {
        await onUpload(file);
      } else {
        const response = await http.post('/files/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        message.success('上传成功');
        onSuccess?.(response.data);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '上传失败');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <Button component="label" variant="outlined" startIcon={<UploadRoundedIcon />} disabled={uploading}>
      {uploading ? '处理中...' : buttonText}
      <input hidden type="file" accept={accept} multiple={maxCount > 1} onChange={handleFileChange} />
    </Button>
  );
};

export default UploadFile;
