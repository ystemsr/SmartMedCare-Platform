import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/bigdata/PageHeader';
import JobStatusChip, { JOB_TYPE_LABEL } from '../../components/bigdata/JobStatusChip';
import { getJobs } from '../../api/bigdata';
import { formatDateTime } from '../../utils/formatter';
import { message } from '../../utils/message';
import type { Job, JobStatus } from '../../types/bigdata';

const BigDataDashboardPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJobs({ page: 1, page_size: 20 });
      setJobs(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const countBy = (status: JobStatus) => jobs.filter((job) => job.status === status).length;
  const predictionCount = jobs.filter(
    (job) => job.job_type === 'batch_predict' && job.status === 'succeeded',
  ).length;

  return (
    <Box>
      <PageHeader
        title="大数据总览"
        description="查看数据作业运行概况、近期提交以及批量推理情况"
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          mb: 3,
        }}
      >
        <StatCard
          title="作业总数"
          value={total}
          icon={<WorkRoundedIcon />}
          color="#1f6feb"
          loading={loading}
        />
        <StatCard
          title="运行中"
          value={countBy('running')}
          icon={<PlayCircleRoundedIcon />}
          color="#1677ff"
          loading={loading}
        />
        <StatCard
          title="近期成功"
          value={countBy('succeeded')}
          icon={<CheckCircleRoundedIcon />}
          color="#1f9d63"
          loading={loading}
        />
        <StatCard
          title="近期失败"
          value={countBy('failed')}
          icon={<ErrorOutlineRoundedIcon />}
          color="#cf1322"
          loading={loading}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' },
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
              最近作业
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              最新的 {Math.min(jobs.length, 10)} 条大数据作业记录
            </Typography>
            <List disablePadding>
              {jobs.slice(0, 10).map((job) => (
                <ListItem
                  key={job.job_id}
                  divider
                  disableGutters
                  sx={{ py: 1.25, alignItems: 'flex-start' }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" fontWeight={600}>
                          {JOB_TYPE_LABEL[job.job_type] || job.job_type}
                        </Typography>
                        <JobStatusChip status={job.status} />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={job.job_id}
                          sx={{ fontFamily: 'monospace' }}
                        />
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                        开始：{formatDateTime(job.started_at)} · 结束：
                        {formatDateTime(job.finished_at)}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
              {!loading && jobs.length === 0 && (
                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                  暂无作业记录
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
              <PsychologyRoundedIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>
                批量推理
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              已完成的批量预测作业数量
            </Typography>
            <Typography variant="h2" fontWeight={700} sx={{ color: 'primary.main' }}>
              {predictionCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              提交后可在"作业管理"中查看日志与结果。
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default BigDataDashboardPage;
