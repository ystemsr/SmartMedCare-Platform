import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import PermissionGuard from '../../components/PermissionGuard';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import PageHeader from '../../components/bigdata/PageHeader';
import JobStatusChip, { JOB_TYPE_LABEL } from '../../components/bigdata/JobStatusChip';
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
    if (!window.confirm('确认取消该作业？')) return;
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
        <Chip size="small" variant="outlined" label={String(value)} sx={{ fontFamily: 'monospace' }} />
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
        <Stack direction="row" spacing={0.5}>
          <Button size="small" onClick={() => setSelected(record)}>
            查看日志
          </Button>
          {record.status === 'running' && (
            <PermissionGuard permission="bigdata:run">
              <Button
                size="small"
                color="error"
                startIcon={<StopCircleRoundedIcon />}
                onClick={() => handleCancel(record.job_id)}
              >
                取消
              </Button>
            </PermissionGuard>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Box>
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
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={fetchJobs}
            >
              刷新
            </Button>
            <PermissionGuard permission="bigdata:run">
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => setSubmitOpen(true)}
              >
                提交新作业
              </Button>
            </PermissionGuard>
          </Stack>
        }
      />

      <Dialog open={submitOpen} onClose={() => setSubmitOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>提交新作业</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>作业类型</InputLabel>
              <Select
                label="作业类型"
                value={submitType}
                onChange={(event) => setSubmitType(event.target.value as JobType)}
              >
                {JOB_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="参数 (JSON, 可选)"
              multiline
              minRows={6}
              value={paramsText}
              onChange={(event) => setParamsText(event.target.value)}
              placeholder={PARAMS_PLACEHOLDER}
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.875rem' } }}
            />
            <Typography variant="caption" color="text.secondary">
              参数将原样透传给后端，请参考作业类型所需的字段。
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '提交'}
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        PaperProps={{ sx: { width: { xs: '100%', md: 680 } } }}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
            作业详情
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            作业 ID：
            <Box component="span" sx={{ fontFamily: 'monospace' }}>
              {selected?.job_id}
            </Box>
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {detailLoading && !detail ? (
            <Typography color="text.secondary">加载中...</Typography>
          ) : detail ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <JobStatusChip status={detail.status} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={JOB_TYPE_LABEL[detail.job_type] || detail.job_type}
                />
                {detail.status === 'running' && (
                  <Typography variant="caption" color="text.secondary">
                    日志每 3 秒自动刷新
                  </Typography>
                )}
              </Stack>
              <Stack direction="row" spacing={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    开始时间
                  </Typography>
                  <Typography variant="body2">{formatDateTime(detail.started_at)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    结束时间
                  </Typography>
                  <Typography variant="body2">{formatDateTime(detail.finished_at)}</Typography>
                </Box>
              </Stack>

              {detail.params && Object.keys(detail.params).length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    参数
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 1.5,
                      bgcolor: 'grey.100',
                      borderRadius: 2,
                      fontSize: '0.8rem',
                      maxHeight: 180,
                      overflow: 'auto',
                    }}
                  >
                    {JSON.stringify(detail.params, null, 2)}
                  </Box>
                </Box>
              )}

              <Box>
                <Typography variant="caption" color="text.secondary">
                  日志
                </Typography>
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
                    maxHeight: 420,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {detail.logs || '暂无日志输出'}
                </Box>
              </Box>
            </Stack>
          ) : null}
        </Box>
      </Drawer>
    </Box>
  );
};

export default JobManagerPage;
