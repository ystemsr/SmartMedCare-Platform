import React, { useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  BrainCircuit,
  CheckCircle2,
  XCircle,
  PlayCircle,
} from 'lucide-react';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/bigdata/PageHeader';
import JobStatusChip, { JOB_TYPE_LABEL } from '../../components/bigdata/JobStatusChip';
import { Card, CardBody, Chip, Divider } from '@/components/ui';
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

  const recentJobs = jobs.slice(0, 10);

  return (
    <div>
      <PageHeader
        title="大数据总览"
        description="查看数据作业运行概况、近期提交以及批量推理情况"
      />

      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          marginBottom: 24,
        }}
      >
        <StatCard
          title="作业总数"
          value={total}
          icon={<Briefcase size={20} />}
          color="var(--smc-primary)"
          loading={loading}
        />
        <StatCard
          title="运行中"
          value={countBy('running')}
          icon={<PlayCircle size={20} />}
          color="var(--smc-info)"
          loading={loading}
        />
        <StatCard
          title="近期成功"
          value={countBy('succeeded')}
          icon={<CheckCircle2 size={20} />}
          color="var(--smc-success)"
          loading={loading}
        />
        <StatCard
          title="近期失败"
          value={countBy('failed')}
          icon={<XCircle size={20} />}
          color="var(--smc-error)"
          loading={loading}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          alignItems: 'start',
        }}
      >
        <Card style={{ gridColumn: 'span 2 / auto' }}>
          <CardBody>
            <div style={{ fontSize: 'var(--smc-fs-xl)', fontWeight: 700 }}>最近作业</div>
            <div
              style={{
                fontSize: 'var(--smc-fs-sm)',
                color: 'var(--smc-text-2)',
                marginTop: 4,
                marginBottom: 16,
              }}
            >
              最新的 {Math.min(jobs.length, 10)} 条大数据作业记录
            </div>

            {recentJobs.length === 0 && !loading ? (
              <div
                style={{
                  padding: '32px 0',
                  textAlign: 'center',
                  color: 'var(--smc-text-2)',
                }}
              >
                暂无作业记录
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentJobs.map((job, idx) => (
                  <div key={job.job_id}>
                    {idx > 0 && <Divider />}
                    <div style={{ padding: '12px 0' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: 'var(--smc-fs-md)', fontWeight: 600 }}>
                          {JOB_TYPE_LABEL[job.job_type] || job.job_type}
                        </span>
                        <JobStatusChip status={job.status} />
                        <Chip outlined style={{ fontFamily: 'monospace' }}>
                          {job.job_id}
                        </Chip>
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 'var(--smc-fs-xs)',
                          color: 'var(--smc-text-2)',
                        }}
                      >
                        开始：{formatDateTime(job.started_at)} · 结束：
                        {formatDateTime(job.finished_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <BrainCircuit size={22} color="var(--smc-primary)" />
              <div style={{ fontSize: 'var(--smc-fs-xl)', fontWeight: 700 }}>批量推理</div>
            </div>
            <div
              style={{
                fontSize: 'var(--smc-fs-sm)',
                color: 'var(--smc-text-2)',
                marginBottom: 16,
              }}
            >
              已完成的批量预测作业数量
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: 'var(--smc-primary)',
                lineHeight: 1.1,
              }}
            >
              {predictionCount}
            </div>
            <div
              style={{
                fontSize: 'var(--smc-fs-xs)',
                color: 'var(--smc-text-2)',
                marginTop: 8,
              }}
            >
              提交后可在“作业管理”中查看日志与结果。
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default BigDataDashboardPage;
