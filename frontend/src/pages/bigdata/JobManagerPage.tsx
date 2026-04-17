import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, XCircle } from 'lucide-react';
import PermissionGuard from '../../components/PermissionGuard';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import PageHeader from '../../components/bigdata/PageHeader';
import JobStatusChip, { JOB_TYPE_LABEL } from '../../components/bigdata/JobStatusChip';
import {
  Button,
  Chip,
  Divider,
  Drawer,
  Modal,
  Select,
  Textarea,
  confirm,
} from '@/components/ui';
import { cancelJob, getJobDetail, getJobs, submitJob } from '../../api/bigdata';
import { formatDateTime } from '../../utils/formatter';
import { message } from '../../utils/message';
import type { Job, JobDetail, JobType } from '../../types/bigdata';

const JOB_TYPE_OPTIONS: { label: string; value: JobType }[] = [
  { label: 'MySQL 导入 HDFS', value: 'mysql_to_hdfs' },
  { label: '构建数据集市', value: 'build_marts' },
  { label: '批量预测', value: 'batch_predict' },
  { label: '自定义 Hive', value: 'custom_hive' },
];

const PARAMS_PLACEHOLDER = '{\n  "table": "health_archives"\n}';

const JobManagerPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitType, setSubmitType] = useState<JobType>('mysql_to_hdfs');
  const [paramsText, setParamsText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selected, setSelected] = useState<Job | null>(null);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJobs({ page, page_size: pageSize });
      setJobs(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载作业失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

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
    let parsed: Record<string, unknown> | undefined;
    if (paramsText.trim()) {
      try {
        parsed = JSON.parse(paramsText);
      } catch {
        message.error('参数必须是合法的 JSON');
        return;
      }
    }

    setSubmitting(true);
    try {
      await submitJob({ job_type: submitType, params: parsed });
      message.success('作业已提交');
      setSubmitOpen(false);
      setParamsText('');
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
      if (selected?.job_id === jobId) {
        loadDetail(jobId);
      }
      fetchJobs();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '取消失败');
    }
  };

  const columns: AppTableColumn<Job>[] = [
    {
      title: '作业 ID',
      dataIndex: 'job_id',
      width: 240,
      render: (value) => (
        <Chip outlined style={{ fontFamily: 'monospace' }}>
          {String(value)}
        </Chip>
      ),
    },
    {
      title: '类型',
      dataIndex: 'job_type',
      width: 150,
      render: (value) => JOB_TYPE_LABEL[String(value)] || String(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value) => <JobStatusChip status={value as Job['status']} />,
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      width: 170,
      render: (value) => formatDateTime(value as string),
    },
    {
      title: '结束时间',
      dataIndex: 'finished_at',
      width: 170,
      render: (value) => formatDateTime(value as string),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="sm" variant="text" onClick={() => setSelected(record)}>
            查看日志
          </Button>
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
        description="提交、监控与管理大数据批处理作业"
      />

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
                onClick={() => setSubmitOpen(true)}
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
        width={560}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="text" onClick={() => setSubmitOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={handleSubmit} loading={submitting} disabled={submitting}>
              {submitting ? '提交中...' : '提交'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Select<JobType>
            label="作业类型"
            value={submitType}
            onChange={(next) => setSubmitType(next)}
            options={JOB_TYPE_OPTIONS}
          />
          <Textarea
            label="参数 (JSON, 可选)"
            rows={6}
            value={paramsText}
            onChange={(event) => setParamsText(event.target.value)}
            placeholder={PARAMS_PLACEHOLDER}
            style={{ fontFamily: 'monospace', fontSize: 14 }}
          />
          <div style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>
            参数将原样透传给后端，请参考作业类型所需的字段。
          </div>
        </div>
      </Modal>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        placement="right"
        width={680}
        title="作业详情"
      >
        <div
          style={{
            fontSize: 'var(--smc-fs-sm)',
            color: 'var(--smc-text-2)',
            marginBottom: 16,
          }}
        >
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
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <JobStatusChip status={detail.status} />
              <Chip outlined>{JOB_TYPE_LABEL[detail.job_type] || detail.job_type}</Chip>
              {detail.status === 'running' && (
                <span style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>
                  日志每 3 秒自动刷新
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>
                  开始时间
                </div>
                <div style={{ fontSize: 'var(--smc-fs-sm)' }}>
                  {formatDateTime(detail.started_at)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>
                  结束时间
                </div>
                <div style={{ fontSize: 'var(--smc-fs-sm)' }}>
                  {formatDateTime(detail.finished_at)}
                </div>
              </div>
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
              <div style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>
                日志
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
                {detail.logs || '暂无日志输出'}
              </pre>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

export default JobManagerPage;
