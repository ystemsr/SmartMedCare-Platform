import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  BrainCircuit,
  CheckCircle2,
  XCircle,
  PlayCircle,
  LineChart,
  Activity,
} from 'lucide-react';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/bigdata/PageHeader';
import JobStatusChip, { JOB_TYPE_LABEL } from '../../components/bigdata/JobStatusChip';
import { Card, CardBody, Chip, Divider } from '@/components/ui';
import { getJobs, getPipelineHealth } from '../../api/bigdata';
import { formatDateTime } from '../../utils/formatter';
import { message } from '../../utils/message';
import type {
  AnalyticsPipelineHealth,
  Job,
  JobStatus,
} from '../../types/bigdata';

const STAGE_LABEL: Record<string, string> = {
  mysql_to_hdfs: 'MySQL → HDFS',
  build_marts: '构建数据集市',
  batch_predict: '批量预测',
};

const STATUS_TONE = (status: string) => {
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'running') return 'info';
  if (status === 'missing') return 'warning';
  return 'default';
};

const BigDataDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<AnalyticsPipelineHealth | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [jRes, pRes] = await Promise.all([
        getJobs({ page: 1, page_size: 30 }),
        getPipelineHealth().catch(() => null),
      ]);
      setJobs(jRes.data.items);
      setTotal(jRes.data.total);
      setPipeline(pRes?.data || null);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const countBy = (status: JobStatus) =>
    jobs.filter((job) => job.status === status).length;
  const predictionCount = jobs.filter(
    (job) => job.job_type === 'batch_predict' && job.status === 'succeeded',
  ).length;

  const recentJobs = jobs.slice(0, 10);

  const goToJobs = (status?: JobStatus, job_type?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (job_type) params.set('job_type', job_type);
    navigate(`/bigdata/jobs${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <div>
      <PageHeader
        title="大数据总览"
        description="近期作业运行情况、流水线健康度与批量推理概况（统计窗口：最近 30 条作业）"
      />

      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          marginBottom: 20,
        }}
      >
        <ClickableStatCard onClick={() => goToJobs()}>
          <StatCard
            title="作业总数"
            value={total}
            icon={<Briefcase size={20} />}
            color="var(--smc-primary)"
            loading={loading}
          />
        </ClickableStatCard>
        <ClickableStatCard onClick={() => goToJobs('running')}>
          <StatCard
            title="运行中"
            value={countBy('running')}
            icon={<PlayCircle size={20} />}
            color="var(--smc-info)"
            loading={loading}
          />
        </ClickableStatCard>
        <ClickableStatCard onClick={() => goToJobs('succeeded')}>
          <StatCard
            title="近期成功"
            value={countBy('succeeded')}
            icon={<CheckCircle2 size={20} />}
            color="var(--smc-success)"
            loading={loading}
          />
        </ClickableStatCard>
        <ClickableStatCard onClick={() => goToJobs('failed')}>
          <StatCard
            title="近期失败"
            value={countBy('failed')}
            icon={<XCircle size={20} />}
            color="var(--smc-error)"
            loading={loading}
          />
        </ClickableStatCard>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)',
          alignItems: 'start',
        }}
      >
        <Card>
          <CardBody>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <div style={{ fontSize: 'var(--smc-fs-xl)', fontWeight: 700 }}>最近作业</div>
              <button
                type="button"
                onClick={() => goToJobs()}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--smc-primary)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                查看全部 →
              </button>
            </div>
            <div
              style={{
                fontSize: 'var(--smc-fs-sm)',
                color: 'var(--smc-text-2)',
                marginTop: 4,
                marginBottom: 16,
              }}
            >
              点击任一条查看详情
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
                    <button
                      type="button"
                      onClick={() => navigate(`/bigdata/jobs`)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 0',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
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
                        <Chip outlined style={{ fontFamily: 'monospace', fontSize: 11 }}>
                          {job.job_id}
                        </Chip>
                        {job.duration_ms != null && (
                          <Chip outlined>
                            {job.duration_ms < 1000
                              ? `${job.duration_ms}ms`
                              : `${(job.duration_ms / 1000).toFixed(1)}s`}
                          </Chip>
                        )}
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
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <CardBody>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <Activity size={20} color="var(--smc-primary)" />
                <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>
                  今日流水线
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--smc-text-2)',
                  marginBottom: 12,
                }}
              >
                最近 36 小时内三段关键作业状态
              </div>
              {!pipeline ? (
                <div style={{ color: 'var(--smc-text-2)', fontSize: 13 }}>
                  {loading ? '加载中...' : '暂无数据'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pipeline.items.map((item) => (
                    <div
                      key={item.stage}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <Chip tone={STATUS_TONE(item.status)} outlined>
                        {item.status === 'missing'
                          ? '未运行'
                          : item.status === 'succeeded'
                            ? '成功'
                            : item.status === 'failed'
                              ? '失败'
                              : item.status === 'running'
                                ? '运行中'
                                : item.status}
                      </Chip>
                      <span style={{ fontSize: 13 }}>
                        {STAGE_LABEL[item.stage] || item.stage}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <BrainCircuit size={20} color="var(--smc-primary)" />
                <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>
                  批量推理
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--smc-text-2)',
                  marginBottom: 10,
                }}
              >
                最近成功的批量预测作业数
              </div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  color: 'var(--smc-primary)',
                  lineHeight: 1.1,
                }}
              >
                {predictionCount}
              </div>
              <button
                type="button"
                onClick={() => navigate('/bigdata/analytics')}
                style={{
                  marginTop: 10,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--smc-primary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <LineChart size={12} />
                查看多维分析
              </button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};

const ClickableStatCard: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
}> = ({ children, onClick }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    }}
    style={{
      cursor: 'pointer',
      transition: 'transform 160ms ease',
      borderRadius: 12,
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
    }}
  >
    {children}
  </div>
);

export default BigDataDashboardPage;
