import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, CalendarClock, ChevronDown, ChevronUp, LineChart, RefreshCw, Settings2, Sparkles } from 'lucide-react';
import PageHeader from '../../components/bigdata/PageHeader';
import FreshnessCard from '../../components/bigdata/FreshnessCard';
import PipelineRunButton from '../../components/bigdata/PipelineRunButton';
import ScheduleConfigModal from '../../components/bigdata/ScheduleConfigModal';
import JobStatusChip, { JOB_TYPE_LABEL } from '../../components/bigdata/JobStatusChip';
import { Button, Card, CardBody, Chip, Divider } from '@/components/ui';
import { getJobs, getPipelineFreshness, submitJob } from '../../api/bigdata';
import dayjs from 'dayjs';
import { formatDateTime } from '../../utils/formatter';
import { message } from '../../utils/message';
import { usePermission } from '../../hooks/usePermission';
import type { Job, JobType, PipelineFreshness, StageFreshness } from '../../types/bigdata';

const POLL_INTERVAL_IDLE = 10_000;
const POLL_INTERVAL_RUNNING = 5_000;

function formatNextRun(nextRunIso?: string | null): string | null {
  if (!nextRunIso) return null;
  const next = dayjs(nextRunIso);
  if (!next.isValid()) return null;
  const now = dayjs();
  const days = next.startOf('day').diff(now.startOf('day'), 'day');
  const hm = next.format('HH:mm');
  if (days <= 0) return `今日 ${hm}`;
  if (days === 1) return `明日 ${hm}`;
  return next.format('MM-DD HH:mm');
}

/** Convert a UTC "HH:MM" into the device-local "HH:MM" for display fallback. */
function utcHHMMToLocal(utcHHMM?: string | null): string {
  if (!utcHHMM) return '—';
  const parts = utcHHMM.split(':');
  if (parts.length !== 2) return utcHHMM;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return utcHHMM;
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const BigDataDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const canRun = hasPermission('bigdata:run');
  const canConfig = hasPermission('system:config');

  const [freshness, setFreshness] = useState<PipelineFreshness | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [refreshingStage, setRefreshingStage] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const pollTimerRef = useRef<number | null>(null);

  const loadFreshness = useCallback(async () => {
    try {
      const res = await getPipelineFreshness();
      setFreshness(res.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载新鲜度失败');
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const res = await getJobs({ page: 1, page_size: 30 });
      setJobs(res.data.items);
      setJobsTotal(res.data.total);
    } catch {
      // swallow — the technical details panel is non-critical
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadFreshness(), loadJobs()]);
  }, [loadFreshness, loadJobs]);

  useEffect(() => {
    (async () => {
      setInitialLoading(true);
      await loadAll();
      setInitialLoading(false);
    })();
  }, [loadAll]);

  // Adaptive polling: every 5s while a pipeline is running, otherwise 10s.
  useEffect(() => {
    const interval = freshness?.has_running_pipeline
      ? POLL_INTERVAL_RUNNING
      : POLL_INTERVAL_IDLE;
    pollTimerRef.current = window.setInterval(() => {
      loadFreshness();
      if (freshness?.has_running_pipeline) {
        loadJobs();
      }
    }, interval);
    return () => {
      if (pollTimerRef.current != null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [freshness?.has_running_pipeline, loadFreshness, loadJobs]);

  const refreshStage = async (stage: StageFreshness) => {
    if (!canRun) return;
    setRefreshingStage(stage.stage);
    try {
      await submitJob({ job_type: stage.stage as JobType });
      message.success(`已触发刷新：${stage.display_name}`);
      await loadAll();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '触发失败');
    } finally {
      setRefreshingStage(null);
    }
  };

  const running = freshness?.has_running_pipeline ?? false;
  const runningStage = freshness?.running_stage
    ? freshness.stages.find((s) => s.stage === freshness.running_stage)?.display_name
    : null;

  const stageCards = freshness?.stages ?? [];
  const predictionCount = jobs.filter(
    (job) => job.job_type === 'batch_predict' && job.status === 'succeeded',
  ).length;
  const recentJobs = jobs.slice(0, 8);

  return (
    <div>
      <PageHeader
        title="大数据总览"
        description="这里展示系统数据是否够新。三段流程负责把业务数据同步、汇总、打分。绿色=6 小时内刚更新过，一般你不需要手动做任何事。"
      />

      {/* Top action bar: refresh-all + status banner */}
      <Card style={{ marginBottom: 20 }}>
        <CardBody>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(31, 111, 235, 0.12)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--smc-primary)',
                }}
              >
                <Sparkles size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>
                  {running
                    ? `数据刷新中…${runningStage ? `正在执行：${runningStage}` : ''}`
                    : '一键把所有数据刷到最新'}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--smc-text-2)',
                    marginTop: 4,
                    lineHeight: 1.55,
                  }}
                >
                  {running
                    ? '流程会在后台继续，本页会自动更新状态，无需等待。'
                    : '依次执行"业务库快照 → 统计数据集市 → 智能风险预测"，通常需要 2–5 分钟。'}
                </div>
                {freshness?.schedule && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: freshness.schedule.enabled
                        ? 'var(--smc-text-2)'
                        : 'var(--smc-text-3)',
                      marginTop: 8,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'var(--smc-surface-alt)',
                    }}
                  >
                    <CalendarClock size={13} />
                    {freshness.schedule.enabled ? (
                      <>
                        下次自动刷新：
                        {formatNextRun(freshness.schedule.next_run_at) ??
                          `每日 ${utcHHMMToLocal(freshness.schedule.utc_time)}`}
                      </>
                    ) : (
                      <>自动刷新已关闭</>
                    )}
                    {canConfig && (
                      <button
                        type="button"
                        aria-label="修改自动刷新配置"
                        onClick={() => setScheduleModalOpen(true)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          marginLeft: 4,
                          cursor: 'pointer',
                          color: 'var(--smc-primary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <Settings2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshCw size={16} />}
                onClick={loadAll}
                disabled={initialLoading}
              >
                刷新页面
              </Button>
              {canRun && (
                <PipelineRunButton
                  running={running}
                  canRun={canRun}
                  onTriggered={loadAll}
                />
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Three freshness cards */}
      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          marginBottom: 20,
        }}
      >
        {initialLoading && stageCards.length === 0 ? (
          <Card>
            <CardBody>
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--smc-text-2)' }}>
                加载中…
              </div>
            </CardBody>
          </Card>
        ) : stageCards.length === 0 ? (
          <Card>
            <CardBody>
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--smc-text-2)' }}>
                暂无流水线数据
              </div>
            </CardBody>
          </Card>
        ) : (
          stageCards.map((stage) => (
            <FreshnessCard
              key={stage.stage}
              stage={stage}
              onRefresh={() => refreshStage(stage)}
              canRun={canRun && refreshingStage !== stage.stage}
              pipelineRunning={running}
            />
          ))
        )}
      </div>

      {/* Collapsible technical details */}
      <Card>
        <CardBody>
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--smc-text)',
            }}
            aria-expanded={detailsOpen}
          >
            <div>
              <div style={{ fontSize: 'var(--smc-fs-md)', fontWeight: 700 }}>技术详情</div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--smc-text-2)',
                  marginTop: 4,
                  textAlign: 'left',
                }}
              >
                最近作业列表、批量推理统计 · 面向运维/数据工程，普通用户可忽略
              </div>
            </div>
            {detailsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {detailsOpen && (
            <div style={{ marginTop: 16 }}>
              <Divider />
              <div
                style={{
                  display: 'grid',
                  gap: 20,
                  gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)',
                  alignItems: 'start',
                  marginTop: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ fontSize: 'var(--smc-fs-md)', fontWeight: 700 }}>
                      最近作业（共 {jobsTotal} 条）
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/bigdata/jobs')}
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

                  {recentJobs.length === 0 ? (
                    <div
                      style={{
                        padding: '20px 0',
                        textAlign: 'center',
                        color: 'var(--smc-text-2)',
                        fontSize: 13,
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
                            onClick={() => navigate('/bigdata/jobs')}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 0',
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
                              <span
                                style={{
                                  fontSize: 'var(--smc-fs-sm)',
                                  fontWeight: 600,
                                }}
                              >
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
                                marginTop: 4,
                                fontSize: 'var(--smc-fs-xs)',
                                color: 'var(--smc-text-2)',
                              }}
                            >
                              开始 {formatDateTime(job.started_at)} · 结束 {formatDateTime(job.finished_at)}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: 'rgba(31, 111, 235, 0.06)',
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <BrainCircuit size={18} color="var(--smc-primary)" />
                    <div style={{ fontSize: 'var(--smc-fs-sm)', fontWeight: 700 }}>
                      批量推理
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--smc-text-2)',
                      marginBottom: 8,
                    }}
                  >
                    最近成功的批量预测作业数
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: 'var(--smc-primary)',
                      lineHeight: 1.15,
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
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {freshness?.schedule && (
        <ScheduleConfigModal
          open={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          schedule={freshness.schedule}
          onSaved={loadAll}
        />
      )}
    </div>
  );
};

export default BigDataDashboardPage;
