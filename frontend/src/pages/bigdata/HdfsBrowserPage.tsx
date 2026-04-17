import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  Chip,
  Drawer,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import PageHeader from '../../components/bigdata/PageHeader';
import { listHdfs, previewHdfs } from '../../api/bigdata';
import { formatDateTime } from '../../utils/formatter';
import { message } from '../../utils/message';
import type { HdfsEntry } from '../../types/bigdata';

function joinPath(base: string, name: string): string {
  if (base === '/' || base === '') return `/${name}`;
  return `${base.replace(/\/$/, '')}/${name}`;
}

function parentPath(path: string): string {
  if (!path || path === '/') return '/';
  const segments = path.split('/').filter(Boolean);
  segments.pop();
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

const HdfsBrowserPage: React.FC = () => {
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState<HdfsEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPath, setPreviewPath] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchEntries = useCallback(async (target: string) => {
    setLoading(true);
    try {
      const res = await listHdfs(target);
      setEntries(res.data.entries);
    } catch (err) {
      setEntries([]);
      message.error(err instanceof Error ? err.message : '加载目录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(path);
  }, [path, fetchEntries]);

  const openPreview = async (target: string) => {
    setPreviewPath(target);
    setPreviewContent('');
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await previewHdfs(target, 200);
      setPreviewContent(res.data.content);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const columns: AppTableColumn<HdfsEntry>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (_, record) => (
        <Stack direction="row" spacing={1.5} alignItems="center">
          {record.type === 'directory' ? (
            <FolderRoundedIcon fontSize="small" sx={{ color: '#d9822b' }} />
          ) : (
            <InsertDriveFileRoundedIcon fontSize="small" color="action" />
          )}
          <MuiLink
            component="button"
            underline="hover"
            onClick={() => {
              const next = joinPath(path, record.name);
              if (record.type === 'directory') {
                setPath(next);
              } else {
                openPreview(next);
              }
            }}
          >
            {record.name}
          </MuiLink>
        </Stack>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 110,
      render: (value) => (
        <Chip
          size="small"
          variant="outlined"
          label={value === 'directory' ? '目录' : '文件'}
          color={value === 'directory' ? 'warning' : 'default'}
        />
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 120,
      render: (value, record) => (record.type === 'directory' ? '-' : formatSize(Number(value ?? 0))),
    },
    {
      title: '修改时间',
      dataIndex: 'modified',
      width: 180,
      render: (value) => formatDateTime(value as string),
    },
  ];

  const segments = path === '/' ? [] : path.split('/').filter(Boolean);

  return (
    <Box>
      <PageHeader
        title="HDFS 浏览"
        description="浏览 HDFS 文件系统的目录结构与文件内容"
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Breadcrumbs>
            <MuiLink component="button" underline="hover" onClick={() => setPath('/')}>
              root
            </MuiLink>
            {segments.map((segment, index) => {
              const next = '/' + segments.slice(0, index + 1).join('/');
              const isLast = index === segments.length - 1;
              return isLast ? (
                <Typography key={next} color="text.primary" fontWeight={600}>
                  {segment}
                </Typography>
              ) : (
                <MuiLink
                  key={next}
                  component="button"
                  underline="hover"
                  onClick={() => setPath(next)}
                >
                  {segment}
                </MuiLink>
              );
            })}
          </Breadcrumbs>
          <Stack direction="row" spacing={1}>
            {path !== '/' && (
              <Button size="small" variant="outlined" onClick={() => setPath(parentPath(path))}>
                返回上级
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => fetchEntries(path)}
            >
              刷新
            </Button>
          </Stack>
        </Stack>
      </Card>

      <AppTable<HdfsEntry>
        columns={columns}
        dataSource={entries}
        loading={loading}
        rowKey="name"
        pagination={false}
        emptyText="当前目录为空"
      />

      <Drawer
        anchor="right"
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', md: 720 } } }}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            文件预览
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}
          >
            {previewPath}
          </Typography>

          {previewLoading ? (
            <Typography color="text.secondary">加载中...</Typography>
          ) : (
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: '#0f172a',
                color: '#e2e8f0',
                borderRadius: 2,
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                lineHeight: 1.6,
                maxHeight: '70vh',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {previewContent || '文件为空或不可预览'}
            </Box>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};

export default HdfsBrowserPage;
