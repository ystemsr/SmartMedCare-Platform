import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, XCircle, RotateCcw, Download, Copy } from 'lucide-react';
import PermissionGuard from '../../components/PermissionGuard';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import PageHeader from '../../components/bigdata/PageHeader';
import JobStatusChip, { JOB_TYPE_LABEL } from '../../components/bigdata/JobStatusChip';
import JobParamsForm from '../../components/bigdata/JobParamsForm';
import {
  Button,
  Chip,
  Divider,
  Drawer,
  Modal,
  Select,
  Input,
  confirm,
} from '@/components/ui';
import {
  cancelJob,
  getJobDetail,
  getJobs,
  retryJob,
  jobLogDownloadUrl,
  submitJob,
} from '../../api/bigdata';
import { formatDateTime } from '../../utils/formatter';
import { message } from '../../utils/message';
import type { Job, JobDetail, JobStatus, JobType } from '../../types/bigdata';

const JOB_TYPE_OPTIONS: { label: string; value: JobType }[] = [
  { label: '业务库快照（MySQL → HDFS）', value: 'mysql_to_hdfs' },
  { label: '构建统计数据集市', value: 'build_marts' },
  { label: '智能风险预测（批量）', value: 'batch_predict' },
];

const STATUS_FILTER_OPTIONS: { label: string; value: JobStatus | '' }[] = [
  { label: '全部', value: '' },
  { label: '等待', value: 'pending' },
  { label: '运行中', value: 'running' },
  { label: '成功', value: 'succeeded' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
];

function formatDuration(ms?: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

const JobManagerPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<JobType | ''>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitType, setSubmitType] = useState<JobType>('mysql_to_hdfs');
  const [submitParams, setSubmitParams] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  const [selected, setSelected] = useState<Job | null>(null);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJobs({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        job_type: typeFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setJobs(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载作业失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const clearPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadDetail = useCallback(async (jobId: string) => {
    try {
      const res = await getJobDetail(jobId);
      setDetail(res.data);
      return res.data;
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载日志失败');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!selected) {
      clearPoll();
      setDetail(null);
      return;
    }

    let mounted = true;
    setDetailLoading(true);
    loadDetail(selected.job_id).then((first) => {
      if (!mounted) return;
      setDetailLoading(false);
      if (first && first.status === 'running') {
        pollRef.current = window.setInterval(async () => {
          const latest = await loadDetail(selected.job_id);
          if (latest && latest.status !== 'running') {
            clearPoll();
            fetchJobs();
          }
        }, 3000);
      }
    });

    return () => {
      mounted = false;
      clearPoll();
    };
  }, [selected, loadDetail, clearPoll, fetchJobs]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Drop empty string values; coerce comma-separated strings as-is.
      const cleaned: Record<string, unknown> = {};
      Object.entries(submitParams).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) cleaned[k] = v;
      });
      await submitJob({ job_type: submitType, params: cleaned });
      message.success('作业已提交');
      setSubmitOpen(false);
      setSubmitParams({});
      fetchJobs();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    const ok = await confirm({
      title: '取消作业',
      content: '确认取消该作业？',
      intent: 'danger',
      okText: '取消作业',
    });
    if (!ok) return;
    try {
      await cancelJob(jobId);
      message.success('已请求取消');
      if (selected?.job_id === jobId) loadDetail(jobId);
      fetchJobs();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '取消失败');
    }
  };

  const handleRetry = async (job: Job) => {
    try {
      await retryJob(job.job_id);
      message.success('已重试并提交新作业');
      fetchJobs();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重试失败');
    }
  };

  const handleCopyParams = (job: Job) => {
    setSubmitType(job.job_type as JobType);
    setSubmitParams({ ...(job.params || {}) });
    setSubmitOpen(true);
  };

  const columns: AppTableColumn<Job>[] = [
    {
      title: '作业 ID',
      dataIndex: 'job_id',
      width: 220,
      render: (value) => (
        <Chip outlined style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {String(value)}
        </Chip>
      ),
    },
    {
      title: '类型',
      dataIndex: 'job_type',
      width: 140,
      render: (value) => JOB_TYPE_LABEL[String(value)] || String(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value) => <JobStatusChip status={value as Job['status']} />,
    },
    {
      title: '耗时',
      dataIndex: 'duration_ms',
      width: 90,
      render: (value) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatDuration(value as number | null)}
        </span>
      ),
    },
    {
      title: '处理行数',
      dataIndex: 'rows_processed',
      width: 110,
      render: (value) =>
        value == null ? '—' : (value as number).toLocaleString(),
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      width: 160,
      render: (value) => formatDateTime(value as string),
    },
    {
      title: '结束时间',
      dataIndex: 'finished_at',
      width: 160,
      render: (value) => formatDateTime(value as string),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Button size="sm" variant="text" onClick={() => setSelected(record)}>
            详情
          </Button>
          {(record.status === 'failed' || record.status === 'cancelled') && (
            <PermissionGuard permission="bigdata:run">
              <Button
                size="sm"
                variant="text"
                startIcon={<RotateCcw size={14} />}
                onClick={() => handleRetry(record)}
              >
                重试
              </Button>
            </PermissionGuard>
          )}
          <PermissionGuard permission="bigdata:run">
            <Button
              size="sm"
              variant="text"
              startIcon={<Copy size={14} />}
              onClick={() => handleCopyParams(record)}
            >
              复用参数
            </Button>
          </PermissionGuard>
          {record.status === 'running' && (
            <PermissionGuard permission="bigdata:run">
              <Button
                size="sm"
                variant="text"
                danger
                startIcon={<XCircle size={14} />}
                onClick={() => handleCancel(record.job_id)}
              >
                取消
              </Button>
            </PermissionGuard>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="作业管理"
        description="提交、监控、过滤与管理大数据批处理作业"
      />

      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          marginBottom: 16,
        }}
      >
        <Select<JobStatus | ''>
          label="状态"
          value={statusFilter}
          onChange={(v) => {
            setPage(1);
            setStatusFilter(v);
          }}
          options={STATUS_FILTER_OPTIONS}
        />
        <Select<JobType | ''>
          label="类型"
          value={typeFilter}
          onChange={(v) => {
            setPage(1);
            setTypeFilter(v);
          }}
          options={[
            { label: '全部', value: '' },
            ...JOB_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
          ]}
        />
        <Input
          label="起始日期"
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setPage(1);
            setDateFrom(e.target.value);
          }}
        />
        <Input
          label="截止日期"
          type="date"
          value={dateTo}
          onChange={(e) => {
            setPage(1);
            setDateTo(e.target.value);
          }}
        />
      </div>

      <AppTable<Job>
        columns={columns}
        dataSource={jobs}
        loading={loading}
        rowKey="job_id"
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
        }}
        onChange={(pag) => {
          if (pag.current) setPage(pag.current);
          if (pag.pageSize && pag.pageSize !== pageSize) {
            setPageSize(pag.pageSize);
            setPage(1);
          }
        }}
        toolbar={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outlined" startIcon={<RefreshCw size={14} />} onClick={fetchJobs}>
              刷新
            </Button>
            <PermissionGuard permission="bigdata:run">
              <Button
                variant="primary"
                startIcon={<Plus size={14} />}
                onClick={() => {
                  setSubmitParams({});
                  setSubmitOpen(true);
                }}
              >
                提交新作业
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="提交新作业"
        width={640}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="text" onClick={() => setSubmitOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting}
            >
              {submitting ? '提交中...' : '提交'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Select<JobType>
            label="作业类型"
            value={submitType}
            onChange={(next) => {
              setSubmitType(next);
              setSubmitParams({});
            }}
            options={JOB_TYPE_OPTIONS}
          />
          <JobParamsForm
            jobType={submitType}
            params={submitParams}
            onChange={setSubmitParams}
          />
        </div>
      </Modal>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        placement="right"
        width={720}
        title="作业详情"
      >
        <div style={{ fontSize: 'var(--smc-fs-sm)', color: 'var(--smc-text-2)', marginBottom: 16 }}>
          作业 ID：
          <span style={{ fontFamily: 'monospace', color: 'var(--smc-text)' }}>
            {selected?.job_id}
          </span>
        </div>
        <Divider />
        {detailLoading && !detail ? (
          <div style={{ color: 'var(--smc-text-2)', marginTop: 16 }}>加载中...</div>
        ) : detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <JobStatusChip status={detail.status} />
              <Chip outlined>{JOB_TYPE_LABEL[detail.job_type] || detail.job_type}</Chip>
              <Chip outlined>耗时 {formatDuration(detail.duration_ms)}</Chip>
              {detail.rows_processed != null && (
                <Chip outlined>
                  处理 {detail.rows_processed.toLocaleString()} 行
                </Chip>
              )}
              {detail.status === 'running' && (
                <span style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>
                  日志每 3 秒刷新
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <MetricCell label="开始时间" value={formatDateTime(detail.started_at)} />
              <MetricCell label="结束时间" value={formatDateTime(detail.finished_at)} />
            </div>

            {detail.params && Object.keys(detail.params).length > 0 && (
              <div>
                <div style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>
                  参数
                </div>
                <pre
                  style={{
                    margin: '4px 0 0',
                    padding: 12,
                    background: 'var(--smc-surface-alt)',
                    border: '1px solid var(--smc-border)',
                    borderRadius: 'var(--smc-r-md)',
                    fontSize: 13,
                    maxHeight: 180,
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(detail.params, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <div style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>
                  日志 (尾部 500 行)
                </div>
                <a
                  href={jobLogDownloadUrl(detail.job_id)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12,
                    color: 'var(--smc-primary)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Download size={12} /> 下载完整日志
                </a>
              </div>
              <pre
                style={{
                  margin: '4px 0 0',
                  padding: 16,
                  background: '#0f172a',
                  color: '#e2e8f0',
                  borderRadius: 'var(--smc-r-md)',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                  maxHeight: 420,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {(() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const logs = (detail as any).log_tail || (detail as any).logs;
                  if (Array.isArray(logs)) return logs.join('\n') || '暂无日志输出';
                  return logs || '暂无日志输出';
                })()}
              </pre>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

const MetricCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>{label}</div>
    <div style={{ fontSize: 'var(--smc-fs-sm)' }}>{value}</div>
  </div>
);

export default JobManagerPage;
