import React, { useCallback, useEffect, useState } from 'react';
import { Folder, File as FileIcon, RefreshCw, ChevronRight } from 'lucide-react';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import PageHeader from '../../components/bigdata/PageHeader';
import { Button, Card, Chip, Drawer } from '@/components/ui';
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

const crumbLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--smc-primary)',
  cursor: 'pointer',
  fontSize: 'var(--smc-fs-md)',
};

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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {record.type === 'directory' ? (
            <Folder size={16} color="var(--smc-warning)" />
          ) : (
            <FileIcon size={16} color="var(--smc-text-2)" />
          )}
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--smc-primary)',
              cursor: 'pointer',
              fontSize: 'var(--smc-fs-md)',
            }}
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
          </button>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 110,
      render: (value) => (
        <Chip tone={value === 'directory' ? 'warning' : 'default'} outlined>
          {value === 'directory' ? '目录' : '文件'}
        </Chip>
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
    <div>
      <PageHeader
        title="HDFS 浏览"
        description="浏览 HDFS 文件系统的目录结构与文件内容"
      />

      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexWrap: 'wrap',
              minWidth: 0,
            }}
          >
            <button type="button" style={crumbLinkStyle} onClick={() => setPath('/')}>
              root
            </button>
            {segments.map((segment, index) => {
              const next = '/' + segments.slice(0, index + 1).join('/');
              const isLast = index === segments.length - 1;
              return (
                <span
                  key={next}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <ChevronRight size={14} color="var(--smc-text-3)" />
                  {isLast ? (
                    <span style={{ color: 'var(--smc-text)', fontWeight: 600 }}>{segment}</span>
                  ) : (
                    <button type="button" style={crumbLinkStyle} onClick={() => setPath(next)}>
                      {segment}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {path !== '/' && (
              <Button size="sm" variant="outlined" onClick={() => setPath(parentPath(path))}>
                返回上级
              </Button>
            )}
            <Button
              size="sm"
              variant="outlined"
              startIcon={<RefreshCw size={14} />}
              onClick={() => fetchEntries(path)}
            >
              刷新
            </Button>
          </div>
        </div>
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
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        placement="right"
        width={720}
        title="文件预览"
      >
        <div
          style={{
            fontSize: 'var(--smc-fs-sm)',
            color: 'var(--smc-text-2)',
            marginBottom: 16,
            fontFamily: 'monospace',
            wordBreak: 'break-all',
          }}
        >
          {previewPath}
        </div>

        {previewLoading ? (
          <div style={{ color: 'var(--smc-text-2)' }}>加载中...</div>
        ) : (
          <pre
            style={{
              margin: 0,
              padding: 16,
              background: '#0f172a',
              color: '#e2e8f0',
              borderRadius: 'var(--smc-r-md)',
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 1.6,
              maxHeight: '70vh',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {previewContent || '文件为空或不可预览'}
          </pre>
        )}
      </Drawer>
    </div>
  );
};

export default HdfsBrowserPage;
