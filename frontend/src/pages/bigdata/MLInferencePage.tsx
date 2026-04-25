import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Eye,
  Layers,
  PlayCircle,
  RefreshCw,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Modal,
  Spinner,
  Tabs,
  Textarea,
  confirm,
} from '@/components/ui';
import PageHeader from '../../components/bigdata/PageHeader';
import ElderPicker from '../../components/ElderPicker';
import ElderMultiPicker from '../../components/bigdata/ElderMultiPicker';
import PredictionTaskWizard from '../../components/bigdata/PredictionTaskWizard';
import PredictionResult from '../../components/bigdata/PredictionResult';
import FeatureContributions from '../../components/bigdata/FeatureContributions';
import PredictionTrendChart from '../../components/bigdata/PredictionTrendChart';
import FeatureField from '../../components/bigdata/FeatureField';
import { getPredictionHistory } from '../../api/bigdata';
import {
  batchCreatePredictionTasks,
  cancelPredictionTask,
  getPredictionCatalog,
  listPredictionTasks,
  updateDoctorInputs,
} from '../../api/predictions';
import { message } from '../../utils/message';
import { formatDateTime } from '../../utils/formatter';
import type { FeatureCatalogEntry } from '../../types/survey';
import type {
  PredictionTask,
  PredictionTaskStatus,
} from '../../types/prediction';
import type { PredictionRecord } from '../../types/bigdata';

type TabKey = 'create' | 'myTasks' | 'trend' | 'batch';

const MLInferencePage: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('create');
  const [catalog, setCatalog] = useState<FeatureCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [refreshTasks, setRefreshTasks] = useState(0);

  useEffect(() => {
    let alive = true;
    setCatalogLoading(true);
    getPredictionCatalog()
      .then((res) => {
        if (alive) setCatalog(res.data.items);
      })
      .catch(() => {
        if (alive) message.error('加载字段目录失败');
      })
      .finally(() => {
        if (alive) setCatalogLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="AI 健康风险评估"
        description="每次评估都是一个独立任务：医生填写现场部分 → 老人补齐自评部分 → 数据齐备后自动推理并记录。"
      />

      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: '0 8px' }}>
          <Tabs
            activeKey={tab}
            onChange={(key) => setTab(key as TabKey)}
            items={[
              { key: 'create', label: '创建评估' },
              { key: 'myTasks', label: '我的任务' },
              { key: 'batch', label: '批量评估' },
              { key: 'trend', label: '历史趋势' },
            ]}
          />
        </div>
      </Card>

      {catalogLoading ? (
        <Card>
          <CardBody style={{ padding: 40, textAlign: 'center' }}>
            <Spinner />
          </CardBody>
        </Card>
      ) : tab === 'create' ? (
        <PredictionTaskWizard
          catalog={catalog}
          onCreated={() => setRefreshTasks((x) => x + 1)}
        />
      ) : tab === 'myTasks' ? (
        <MyTasksPanel catalog={catalog} refreshToken={refreshTasks} />
      ) : tab === 'batch' ? (
        <BatchPanel catalog={catalog} onCreated={() => setRefreshTasks((x) => x + 1)} />
      ) : (
        <TrendPanel />
      )}
    </div>
  );
};

// ============================================================================
// My Tasks
// ============================================================================

const STATUS_LABEL: Record<PredictionTaskStatus, string> = {
  pending_elder: '待完成',
  pending_doctor: '待医生补全',
  pending_prediction: '排队推理中',
  predicted: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const STATUS_TONE: Record<
  PredictionTaskStatus,
  'default' | 'info' | 'success' | 'warning' | 'error'
> = {
  pending_elder: 'warning',
  pending_doctor: 'warning',
  pending_prediction: 'info',
  predicted: 'success',
  failed: 'error',
  cancelled: 'default',
};

interface MyTasksProps {
  catalog: FeatureCatalogEntry[];
  refreshToken: number;
}

const MyTasksPanel: React.FC<MyTasksProps> = ({ catalog, refreshToken }) => {
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<PredictionTask[]>([]);
  const [detail, setDetail] = useState<PredictionTask | null>(null);

  const catalogMap = useMemo(() => {
    const m: Record<string, FeatureCatalogEntry> = {};
    catalog.forEach((e) => (m[e.key] = e));
    return m;
  }, [catalog]);

  // `silent` skips the spinner for background polling so the list doesn't
  // flicker each tick — visible loading is reserved for the first load and
  // filter changes where the panel content actually needs to swap out.
  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const res = await listPredictionTasks({
          status: filter || undefined,
          limit: 200,
        });
        setTasks(res.data.items);
        // Keep the open detail modal in sync so polling can advance it from
        // "排队推理中" to a final state without the user reopening it.
        setDetail((prev) => {
          if (!prev) return prev;
          const fresh = res.data.items.find((t) => t.id === prev.id);
          return fresh || prev;
        });
      } catch (err) {
        if (!opts?.silent) {
          message.error(err instanceof Error ? err.message : '加载任务失败');
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  // Auto-refresh while any task is waiting for inference so the UI
  // transitions from "排队推理中" to a final status without a manual refresh.
  const hasPendingPrediction = useMemo(
    () => tasks.some((t) => t.status === 'pending_prediction'),
    [tasks],
  );
  useEffect(() => {
    if (!hasPendingPrediction) return;
    const timer = window.setInterval(() => {
      load({ silent: true });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hasPendingPrediction, load]);

  const handleCancel = async (task: PredictionTask) => {
    const ok = await confirm({
      title: '取消评估任务',
      content: `确认取消任务 #${task.id}（${task.elder_name || `老人${task.elder_id}`}）？此操作无法恢复。`,
      intent: 'danger',
      okText: '取消任务',
      cancelText: '保留',
    });
    if (!ok) return;
    try {
      await cancelPredictionTask(task.id);
      message.success('已取消');
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '取消失败');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <CardBody>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <FilterChip
              active={filter === ''}
              onClick={() => setFilter('')}
              label="全部"
            />
            <FilterChip
              active={filter === 'pending_elder'}
              onClick={() => setFilter('pending_elder')}
              label="待完成"
            />
            <FilterChip
              active={filter === 'pending_doctor'}
              onClick={() => setFilter('pending_doctor')}
              label="待医生补全"
            />
            <FilterChip
              active={filter === 'predicted'}
              onClick={() => setFilter('predicted')}
              label="已完成"
            />
            <FilterChip
              active={filter === 'failed'}
              onClick={() => setFilter('failed')}
              label="失败"
            />
            <FilterChip
              active={filter === 'cancelled'}
              onClick={() => setFilter('cancelled')}
              label="已取消"
            />
            <div style={{ flex: 1 }} />
            <Button
              variant="text"
              startIcon={<RefreshCw size={14} />}
              onClick={() => load()}
              disabled={loading}
            >
              刷新
            </Button>
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <Card>
          <CardBody style={{ padding: 40, textAlign: 'center' }}>
            <Spinner />
          </CardBody>
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <CardBody
            style={{ padding: '40px 0', textAlign: 'center', color: 'var(--smc-text-2)' }}
          >
            暂无任务。
          </CardBody>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onOpen={() => setDetail(t)}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {detail && (
        <TaskDetailModal
          task={detail}
          catalogMap={catalogMap}
          catalog={catalog}
          onClose={() => setDetail(null)}
          onCancel={handleCancel}
          onUpdated={(t) => {
            setDetail(t);
            load();
          }}
        />
      )}
    </div>
  );
};

const FilterChip: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
}> = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '6px 12px',
      borderRadius: 18,
      border: '1px solid',
      borderColor: active ? 'var(--smc-primary)' : 'var(--smc-border)',
      background: active
        ? 'color-mix(in oklab, var(--smc-primary) 14%, transparent)'
        : 'transparent',
      color: active ? 'var(--smc-primary)' : 'var(--smc-text-2)',
      cursor: 'pointer',
      fontSize: 13,
    }}
  >
    {label}
  </button>
);

const TaskRow: React.FC<{
  task: PredictionTask;
  onOpen: () => void;
  onCancel: (t: PredictionTask) => void;
}> = ({ task, onOpen, onCancel }) => {
  const isOpen =
    task.status === 'pending_elder' ||
    task.status === 'pending_doctor' ||
    task.status === 'pending_prediction';
  return (
    <Card>
      <CardBody>
        <div
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 16 }}>
                #{task.id} · {task.elder_name || `老人${task.elder_id}`}
              </span>
              <Chip tone={STATUS_TONE[task.status]} outlined>
                {STATUS_LABEL[task.status]}
              </Chip>
              {task.prediction && (
                <Chip tone="info" outlined>
                  健康分 {task.prediction.health_score.toFixed(1)}
                </Chip>
              )}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: 'var(--smc-text-2)',
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <span>
                <Clock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                创建：{formatDateTime(task.created_at)}
              </span>
              {task.predicted_at && (
                <span>完成：{formatDateTime(task.predicted_at)}</span>
              )}
              {task.doctor_name && <span>创建人：{task.doctor_name}</span>}
            </div>
            {task.error_message && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: 'var(--smc-error)',
                }}
              >
                {task.error_message}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="text" startIcon={<Eye size={14} />} onClick={onOpen}>
              详情
            </Button>
            {isOpen && (
              <Button
                variant="text"
                startIcon={<XCircle size={14} />}
                onClick={() => onCancel(task)}
              >
                取消
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

const TaskDetailModal: React.FC<{
  task: PredictionTask;
  catalogMap: Record<string, FeatureCatalogEntry>;
  catalog: FeatureCatalogEntry[];
  onClose: () => void;
  onCancel: (t: PredictionTask) => void;
  onUpdated: (t: PredictionTask) => void;
}> = ({ task, catalogMap, catalog, onClose, onCancel, onUpdated }) => {
  const isEditable =
    task.status === 'pending_elder' || task.status === 'pending_doctor';
  const isPendingElder = task.status === 'pending_elder';
  const isPendingDoctor = task.status === 'pending_doctor';
  const allInputs: { key: string; value: number | string | null; source: string }[] = [];
  (Object.entries(task.auto_inputs || {}) as [string, number | string | null][]).forEach(
    ([k, v]) => allInputs.push({ key: k, value: v, source: 'auto' }),
  );
  (Object.entries(task.permanent_inputs || {}) as [string, number | string | null][]).forEach(
    ([k, v]) => allInputs.push({ key: k, value: v, source: 'permanent' }),
  );
  if (!isEditable) {
    (Object.entries(task.doctor_inputs || {}) as [string, number | string | null][]).forEach(
      ([k, v]) => allInputs.push({ key: k, value: v, source: 'doctor' }),
    );
  }
  (Object.entries(task.elder_inputs || {}) as [string, number | string | null][]).forEach(
    ([k, v]) => allInputs.push({ key: k, value: v, source: 'elder' }),
  );

  const doctorEntries = useMemo(
    () => catalog.filter((e) => e.filler === 'doctor'),
    [catalog],
  );
  const [doctorInputs, setDoctorInputs] = useState<Record<string, number | null>>(
    () => {
      const init: Record<string, number | null> = {};
      const src = task.doctor_inputs || {};
      doctorEntries.forEach((e) => {
        const v = src[e.key];
        if (typeof v === 'number' && Number.isFinite(v)) init[e.key] = v;
        else if (typeof v === 'string' && v !== '') init[e.key] = Number(v);
        else init[e.key] = null;
      });
      return init;
    },
  );
  const [saving, setSaving] = useState(false);

  const requiredDoctorKeys = doctorEntries
    .filter((e) => e.required)
    .map((e) => e.key);
  const filledRequired = requiredDoctorKeys.every(
    (k) =>
      typeof doctorInputs[k] === 'number' &&
      Number.isFinite(doctorInputs[k] as number),
  );

  const handleSave = async () => {
    if (!filledRequired) {
      message.warning('请先填写所有带 * 的必填项');
      return;
    }
    setSaving(true);
    try {
      const cleaned: Record<string, number> = {};
      Object.entries(doctorInputs).forEach(([k, v]) => {
        if (typeof v === 'number' && Number.isFinite(v)) cleaned[k] = v;
      });
      const res = await updateDoctorInputs(task.id, cleaned);
      if (res.data.status === 'predicted') {
        message.success('已更新医生数据，评估已自动完成');
      } else {
        message.success('已保存');
      }
      onUpdated(res.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const snapshotGroups: Array<{
    source: string;
    title: string;
    items: typeof allInputs;
  }> = [
    { source: 'doctor', title: '医生填写', items: [] },
    { source: 'elder', title: '老人填写', items: [] },
    { source: 'auto', title: '来自档案', items: [] },
    { source: 'permanent', title: '历史记录', items: [] },
  ];
  for (const item of allInputs) {
    const g = snapshotGroups.find((x) => x.source === item.source);
    if (g) g.items.push(item);
  }
  const groupTone: Record<string, 'info' | 'success' | 'default'> = {
    doctor: 'info',
    elder: 'success',
    auto: 'default',
    permanent: 'default',
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={880}
      title={`任务详情 · #${task.id}`}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {(isEditable || task.status === 'pending_prediction') && (
            <Button variant="text" onClick={() => onCancel(task)}>
              取消任务
            </Button>
          )}
          {isEditable && (
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={saving || !filledRequired}
            >
              保存医生数据
            </Button>
          )}
          <Button variant={isEditable ? 'outlined' : 'primary'} onClick={onClose}>
            关闭
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header summary */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '14px 16px',
            borderRadius: 10,
            background: 'color-mix(in oklab, var(--smc-primary) 6%, transparent)',
            border: '1px solid color-mix(in oklab, var(--smc-primary) 18%, transparent)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700 }}>
              {task.elder_name || `老人${task.elder_id}`}
            </span>
            <Chip tone={STATUS_TONE[task.status]} outlined>
              {STATUS_LABEL[task.status]}
            </Chip>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 18,
              flexWrap: 'wrap',
              fontSize: 12,
              color: 'var(--smc-text-2)',
            }}
          >
            <span>
              <Clock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
              创建：{formatDateTime(task.created_at)}
            </span>
            {task.doctor_name && <span>创建人：{task.doctor_name}</span>}
            {task.predicted_at && (
              <span>完成：{formatDateTime(task.predicted_at)}</span>
            )}
          </div>
        </div>

        {task.message && (
          <Alert severity="info" title="任务说明">
            {task.message}
          </Alert>
        )}

        {task.prediction && (
          <>
            <PredictionResult
              prediction={{
                high_risk_prob: task.prediction.high_risk_prob,
                high_risk: task.prediction.high_risk,
                followup_prob: task.prediction.followup_prob,
                followup_needed: task.prediction.followup_needed,
                health_score: task.prediction.health_score,
              }}
              title="评估结果"
              subtitle={`预测于 ${formatDateTime(task.predicted_at)}`}
            />
            {task.contributions && task.contributions.length > 0 && (
              <FeatureContributions items={task.contributions} />
            )}
          </>
        )}

        {task.status === 'failed' && (
          <Alert severity="error" title="执行失败">
            {task.error_message || '请检查日志或联系管理员'}
          </Alert>
        )}

        {isEditable && (
          <>
            {isPendingElder && (
              <Alert severity="warning" title="任务待完成">
                以下字段等待老人填写：
                {task.elder_requested_fields
                  .map((k) => catalogMap[k]?.label || k)
                  .join('、')}
              </Alert>
            )}
            {isPendingDoctor && (
              <Alert severity="warning" title="待医生补全">
                老人已提交，但仍缺少医生侧必填项。请在下方补全后保存，系统将自动完成评估。
              </Alert>
            )}

            <SectionCard
              title="医生数据"
              subtitle="可修改，保存后若数据齐备会自动完成推理"
            >
              <div
                style={{
                  display: 'grid',
                  gap: 14,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                }}
              >
                {doctorEntries.map((entry) => (
                  <FeatureField
                    key={entry.key}
                    entry={entry}
                    value={doctorInputs[entry.key]}
                    required={entry.required}
                    highlight={entry.required && doctorInputs[entry.key] == null}
                    onChange={(v) =>
                      setDoctorInputs((prev) => ({ ...prev, [entry.key]: v }))
                    }
                  />
                ))}
              </div>
            </SectionCard>
          </>
        )}

        <SectionCard title="输入快照" subtitle="本次评估使用的全部特征">
          {allInputs.length === 0 ? (
            <span style={{ color: 'var(--smc-text-3)', fontSize: 13 }}>
              暂无记录
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {snapshotGroups
                .filter((g) => g.items.length > 0)
                .map((group) => (
                  <div key={group.source}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <Chip tone={groupTone[group.source]} outlined>
                        {group.title}
                      </Chip>
                      <span
                        style={{ fontSize: 12, color: 'var(--smc-text-3)' }}
                      >
                        {group.items.length} 项
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gap: 8,
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      }}
                    >
                      {group.items.map(({ key, value }) => {
                        const entry = catalogMap[key];
                        if (!entry) return null;
                        let display = String(value ?? '—');
                        if (entry.type === 'enum' && entry.options) {
                          const match = entry.options.find(
                            (o) => Number(o.value) === Number(value),
                          );
                          display = match?.label || display;
                        } else if (entry.type === 'boolean') {
                          display = value === 1 || value === '1' ? '是' : '否';
                        } else if (entry.unit && display !== '—') {
                          display = `${display} ${entry.unit}`;
                        }
                        return (
                          <div
                            key={`${group.source}-${key}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: 'var(--smc-bg-2, #fafafa)',
                              border: '1px solid var(--smc-border)',
                              minHeight: 38,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12.5,
                                color: 'var(--smc-text-2)',
                                flex: '1 1 auto',
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={entry.label}
                            >
                              {entry.label}
                            </span>
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 13,
                                color: 'var(--smc-text)',
                                flexShrink: 0,
                                maxWidth: 140,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={display}
                            >
                              {display}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </SectionCard>
      </div>
    </Modal>
  );
};

const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div
    style={{
      padding: 16,
      borderRadius: 10,
      border: '1px solid var(--smc-border)',
      background: 'var(--smc-surface, #fff)',
    }}
  >
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--smc-text)' }}>
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: 'var(--smc-text-3)',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
    {children}
  </div>
);

// ============================================================================
// Batch
// ============================================================================

interface BatchProps {
  catalog: FeatureCatalogEntry[];
  onCreated: () => void;
}

const BatchPanel: React.FC<BatchProps> = ({ catalog, onCreated }) => {
  const [ids, setIds] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [doctorInputs, setDoctorInputs] = useState<Record<string, number | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    items: PredictionTask[];
    missing_elder_ids: number[];
  } | null>(null);

  const doctorEntries = useMemo(
    // Exclude auxiliary fields (HEIGHT/WEIGHT): they vary per elder and will
    // be auto-read from each elder's latest health record.
    () => catalog.filter((e) => e.filler === 'doctor' && !e.auxiliary),
    [catalog],
  );

  const requiredKeys = doctorEntries
    .filter((e) => e.required)
    .map((e) => e.key);
  const filled = requiredKeys.every(
    (k) =>
      typeof doctorInputs[k] === 'number' &&
      Number.isFinite(doctorInputs[k] as number),
  );

  const handleSubmit = async () => {
    if (ids.length === 0) {
      message.warning('请至少选择一位老人');
      return;
    }
    if (!filled) {
      message.warning('请先填写所有带 * 的必填项');
      return;
    }
    setSubmitting(true);
    try {
      const cleaned: Record<string, number> = {};
      Object.entries(doctorInputs).forEach(([k, v]) => {
        if (typeof v === 'number' && Number.isFinite(v)) cleaned[k] = v;
      });
      const res = await batchCreatePredictionTasks({
        elder_ids: ids,
        message: note || undefined,
        doctor_inputs: cleaned,
      });
      setResult(res.data);
      message.success(
        `已创建 ${res.data.items.length} 个任务${
          res.data.missing_elder_ids.length
            ? `，${res.data.missing_elder_ids.length} 位未找到`
            : ''
        }`,
      );
      onCreated();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建批量任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <CardBody>
          <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700, marginBottom: 4 }}>
            批量评估
          </div>
          <div
            style={{
              fontSize: 'var(--smc-fs-sm)',
              color: 'var(--smc-text-2)',
              marginBottom: 14,
            }}
          >
            为多位老人统一创建评估任务。医生填写部分会共用；各老人的动态数据仍需分别填写。
          </div>
          <ElderMultiPicker label="老人" value={ids} onChange={setIds} max={50} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700, marginBottom: 4 }}>
            医生评分（共用）
          </div>
          <div
            style={{
              fontSize: 'var(--smc-fs-sm)',
              color: 'var(--smc-text-2)',
              marginBottom: 14,
            }}
          >
            该分值将应用于所有被选老人的此次任务。
          </div>
          <div
            style={{
              display: 'grid',
              gap: 14,
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            }}
          >
            {doctorEntries.map((entry) => (
              <FeatureField
                key={entry.key}
                entry={entry}
                value={doctorInputs[entry.key]}
                required={entry.required}
                highlight={entry.required && doctorInputs[entry.key] == null}
                onChange={(v) =>
                  setDoctorInputs((prev) => ({ ...prev, [entry.key]: v }))
                }
              />
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Textarea
            label="给老人的统一说明（选填）"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="可用于提醒老人尽快完成本次采集"
          />
          <div style={{ margin: '16px 0' }}>
            <Divider />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              size="lg"
              startIcon={<Layers size={16} />}
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting || ids.length === 0 || !filled}
            >
              创建 {ids.length} 个任务
            </Button>
          </div>
        </CardBody>
      </Card>

      {result && (
        <Card>
          <CardBody>
            <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700, marginBottom: 10 }}>
              创建结果
            </div>
            {result.missing_elder_ids.length > 0 && (
              <Alert severity="warning" style={{ marginBottom: 10 }}>
                以下 ID 未找到对应老人档案：
                {result.missing_elder_ids.join(', ')}
              </Alert>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--smc-border)' }}>
                    <Th>任务 ID</Th>
                    <Th>老人</Th>
                    <Th>状态</Th>
                    <Th>健康分</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((t) => (
                    <tr
                      key={t.id}
                      style={{ borderBottom: '1px solid var(--smc-border)' }}
                    >
                      <Td>#{t.id}</Td>
                      <Td>{t.elder_name || `老人${t.elder_id}`}</Td>
                      <Td>
                        <Chip tone={STATUS_TONE[t.status]} outlined>
                          {STATUS_LABEL[t.status]}
                        </Chip>
                      </Td>
                      <Td>
                        {t.prediction
                          ? t.prediction.health_score.toFixed(1)
                          : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

// ============================================================================
// Trend
// ============================================================================

const TrendPanel: React.FC = () => {
  const [elderId, setElderId] = useState<number | ''>('');
  const [records, setRecords] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (id: number) => {
    setLoading(true);
    try {
      const res = await getPredictionHistory(id, 30);
      setRecords(res.data.items);
    } catch (err) {
      setRecords([]);
      message.error(err instanceof Error ? err.message : '加载历史失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (elderId === '' || !elderId) {
      setRecords([]);
      return;
    }
    load(Number(elderId));
  }, [elderId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <CardBody>
          <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700, marginBottom: 4 }}>
            按老人查询历史
          </div>
          <div
            style={{
              fontSize: 'var(--smc-fs-sm)',
              color: 'var(--smc-text-2)',
              marginBottom: 14,
            }}
          >
            查看过去 30 次评估的健康评分与高风险概率走势。
          </div>
          <div style={{ maxWidth: 400 }}>
            <ElderPicker label="老人" value={elderId} onChange={(id) => setElderId(id)} />
          </div>
        </CardBody>
      </Card>

      {elderId !== '' && elderId ? (
        <>
          <PredictionTrendChart records={records} loading={loading} />
          {records.length > 0 && (
            <Card>
              <CardBody>
                <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700, marginBottom: 12 }}>
                  近期评估明细
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 14,
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--smc-border)' }}>
                        <Th>时间</Th>
                        <Th>健康评分</Th>
                        <Th>高风险概率</Th>
                        <Th>需要随访</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr
                          key={r.id}
                          style={{ borderBottom: '1px solid var(--smc-border)' }}
                        >
                          <Td>{formatDateTime(r.predicted_at)}</Td>
                          <Td>{Number(r.health_score).toFixed(1)}</Td>
                          <Td>{(Number(r.high_risk_prob) * 100).toFixed(1)}%</Td>
                          <Td>
                            <Chip
                              tone={r.followup_needed ? 'warning' : 'default'}
                              outlined
                            >
                              {r.followup_needed ? '建议随访' : '暂不需要'}
                            </Chip>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardBody
            style={{ padding: '40px 0', textAlign: 'center', color: 'var(--smc-text-2)' }}
          >
            <TrendingUp size={32} style={{ color: 'var(--smc-text-3)', marginBottom: 8 }} />
            <div>请选择老人查看评估走势</div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

// ----- misc helpers -----

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th
    style={{
      textAlign: 'left',
      padding: '10px 12px',
      fontWeight: 600,
      color: 'var(--smc-text-2)',
      fontSize: 13,
    }}
  >
    {children}
  </th>
);

const Td: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => <td style={{ padding: '10px 12px', ...style }}>{children}</td>;

// silence unused imports
void PlayCircle;

export default MLInferencePage;
