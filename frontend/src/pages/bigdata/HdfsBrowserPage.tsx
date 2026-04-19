import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Folder,
  File as FileIcon,
  RefreshCw,
  ChevronRight,
  Copy,
  ArrowUpDown,
} from 'lucide-react';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import PageHeader from '../../components/bigdata/PageHeader';
import { Button, Card, Chip, Drawer, Select } from '@/components/ui';
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
  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
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

type SortKey = 'name' | 'size' | 'modified';
type SortDir = 'asc' | 'desc';

const HdfsBrowserPage: React.FC = () => {
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState<HdfsEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPath, setPreviewPath] = useState('');
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lineCount, setLineCount] = useState<number>(200);

  const fetchEntries = useCallback(async (target: string) => {
    setLoading(true);
    try {
      const res = await listHdfs(target);
      setEntries(res.data.entries);
      setPage(1);
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

  const sorted = useMemo(() => {
    const copy = [...entries];
    copy.sort((a, b) => {
      // Directories always come first regardless of sort
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'size') cmp = (a.size || 0) - (b.size || 0);
      else if (sortKey === 'modified') {
        const am = Date.parse(String(a.modified || 0)) || 0;
        const bm = Date.parse(String(b.modified || 0)) || 0;
        cmp = am - bm;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [entries, sortKey, sortDir]);

  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const openPreview = async (target: string, lines = lineCount) => {
    setPreviewPath(target);
    setPreviewLines([]);
    setPreviewTruncated(false);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await previewHdfs(target, lines);
      const rawLines = (
        res.data as unknown as { lines?: string[]; content?: string }
      ).lines;
      if (Array.isArray(rawLines)) setPreviewLines(rawLines);
      else if (typeof rawLines === 'string') setPreviewLines(String(rawLines).split('\n'));
      else if ((res.data as { content?: string }).content) {
        setPreviewLines(String((res.data as { content?: string }).content).split('\n'));
      }
      setPreviewTruncated(Boolean((res.data as { truncated?: boolean }).truncated));
    } catch (err) {
      message.error(err instanceof Error ? err.message : '预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const copyPath = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      message.success('路径已复制');
    } catch {
      message.error('复制失败');
    }
  };

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const columns: AppTableColumn<HdfsEntry>[] = [
    {
      title: (
        <span
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSort('name')}
        >
          名称{sortArrow('name')}
        </span>
      ) as unknown as string,
      dataIndex: 'name',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
              if (record.type === 'directory') setPath(next);
              else openPreview(next);
            }}
          >
            {record.name}
          </button>
          <button
            type="button"
            aria-label="复制路径"
            onClick={() => copyPath(joinPath(path, record.name))}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--smc-text-3)',
            }}
          >
            <Copy size={13} />
          </button>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (value) => (
        <Chip tone={value === 'directory' ? 'warning' : 'default'} outlined>
          {value === 'directory' ? '目录' : '文件'}
        </Chip>
      ),
    },
    {
      title: (
        <span
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSort('size')}
        >
          大小{sortArrow('size')}
        </span>
      ) as unknown as string,
      dataIndex: 'size',
      width: 120,
      render: (value, record) =>
        record.type === 'directory' ? '—' : formatSize(Number(value ?? 0)),
    },
    {
      title: (
        <span
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSort('modified')}
        >
          修改时间{sortArrow('modified')}
        </span>
      ) as unknown as string,
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
        description="浏览 HDFS 文件系统，支持排序、面包屑导航与文件预览"
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
            <button
              type="button"
              style={crumbLinkStyle}
              onClick={() => setPath('/')}
            >
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
                    <span style={{ color: 'var(--smc-text)', fontWeight: 600 }}>
                      {segment}
                    </span>
                  ) : (
                    <button
                      type="button"
                      style={crumbLinkStyle}
                      onClick={() => setPath(next)}
                    >
                      {segment}
                    </button>
                  )}
                </span>
              );
            })}
            <button
              type="button"
              aria-label="复制当前路径"
              onClick={() => copyPath(path)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--smc-text-3)',
                marginLeft: 6,
              }}
            >
              <Copy size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {path !== '/' && (
              <Button
                size="sm"
                variant="outlined"
                onClick={() => setPath(parentPath(path))}
              >
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

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'var(--smc-text-2)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <ArrowUpDown size={12} />
          共 {entries.length} 项（{entries.filter((e) => e.type === 'directory').length}{' '}
          目录 / {entries.filter((e) => e.type !== 'directory').length} 文件）
        </div>
      </Card>

      <AppTable<HdfsEntry>
        columns={columns}
        dataSource={paged}
        loading={loading}
        rowKey="name"
        pagination={{
          current: page,
          pageSize,
          total: entries.length,
          showTotal: (t) => `共 ${t} 项`,
        }}
        onChange={(pag) => {
          if (pag.current) setPage(pag.current);
        }}
        emptyText="当前目录为空"
      />

      <Drawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        placement="right"
        width={780}
        title="文件预览"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: 'var(--smc-fs-sm)',
              color: 'var(--smc-text-2)',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              flex: 1,
              minWidth: 0,
            }}
          >
            {previewPath}
          </div>
          <Button size="sm" variant="text" onClick={() => copyPath(previewPath)}>
            <Copy size={13} style={{ marginRight: 4 }} />
            复制
          </Button>
          <div style={{ width: 130 }}>
            <Select<number>
              value={lineCount}
              onChange={(v) => {
                setLineCount(v);
                if (previewPath) openPreview(previewPath, v);
              }}
              options={[
                { label: '前 100 行', value: 100 },
                { label: '前 200 行', value: 200 },
                { label: '前 500 行', value: 500 },
                { label: '前 2000 行', value: 2000 },
              ]}
            />
          </div>
        </div>

        {previewTruncated && (
          <div
            style={{
              padding: '6px 10px',
              background: 'color-mix(in oklab, var(--smc-warning) 15%, transparent)',
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            文件较大，预览已截断
          </div>
        )}

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
            {previewLines.length > 0 ? previewLines.join('\n') : '文件为空或不可预览'}
          </pre>
        )}
      </Drawer>
    </div>
  );
};

export default HdfsBrowserPage;
