import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  HeartPulse,
  Send,
} from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Chip,
  Modal,
  Spinner,
  Tabs,
} from '@/components/ui';
import FeatureField from '../../components/bigdata/FeatureField';
import {
  getFeatureCatalog,
  listMySurveys,
  submitSurvey,
} from '../../api/surveys';
import {
  elderSubmitPredictionTask,
  listMyPredictionTasks,
} from '../../api/predictions';
import { message } from '../../utils/message';
import type {
  FeatureCatalogEntry,
  SurveyStatus,
  SurveyTask,
} from '../../types/survey';
import type { PredictionTask } from '../../types/prediction';

type TabKey = 'pending' | 'submitted';

// Unified item rendered in the tab list.
type BoardItem =
  | {
      kind: 'survey';
      id: string; // surv-<id>
      task: SurveyTask;
      createdAt: string;
      pending: boolean;
    }
  | {
      kind: 'prediction';
      id: string; // pred-<id>
      task: PredictionTask;
      createdAt: string;
      pending: boolean;
    };

const ElderSurveysPage: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('pending');
  const [catalog, setCatalog] = useState<FeatureCatalogEntry[]>([]);
  const [surveys, setSurveys] = useState<SurveyTask[]>([]);
  const [predictions, setPredictions] = useState<PredictionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSurvey, setActiveSurvey] = useState<SurveyTask | null>(null);
  const [activePrediction, setActivePrediction] = useState<PredictionTask | null>(null);

  const catalogMap = useMemo(() => {
    const m: Record<string, FeatureCatalogEntry> = {};
    catalog.forEach((e) => (m[e.key] = e));
    return m;
  }, [catalog]);

  const load = useCallback(
    async (tabKey: TabKey) => {
      setLoading(true);
      try {
        if (tabKey === 'pending') {
          const [s, p] = await Promise.all([
            listMySurveys({ status: 'pending' as SurveyStatus, limit: 100 }),
            listMyPredictionTasks({ status: 'pending_elder', limit: 100 }),
          ]);
          setSurveys(s.data.items);
          setPredictions(p.data.items);
        } else {
          // submitted/closed: surveys submitted + predictions the elder already acted on.
          const [s, p] = await Promise.all([
            listMySurveys({ status: 'submitted' as SurveyStatus, limit: 50 }),
            listMyPredictionTasks({
              status:
                'predicted,failed,cancelled,pending_prediction,pending_doctor',
              limit: 50,
            }),
          ]);
          setSurveys(s.data.items);
          setPredictions(p.data.items);
        }
      } catch (err) {
        message.error(err instanceof Error ? err.message : '加载任务失败');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    getFeatureCatalog()
      .then((res) => {
        if (alive) setCatalog(res.data.items);
      })
      .catch(() => {
        if (alive) message.error('加载字段目录失败');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const items: BoardItem[] = useMemo(() => {
    const out: BoardItem[] = [];
    surveys.forEach((t) =>
      out.push({
        kind: 'survey',
        id: `surv-${t.id}`,
        task: t,
        createdAt: t.created_at,
        pending: t.status === 'pending',
      }),
    );
    predictions.forEach((t) =>
      out.push({
        kind: 'prediction',
        id: `pred-${t.id}`,
        task: t,
        createdAt: t.created_at,
        pending: t.status === 'pending_elder',
      }),
    );
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return out;
  }, [surveys, predictions]);

  const pendingCount = items.filter((i) => i.pending).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--smc-fs-2xl)',
            fontWeight: 700,
            color: 'var(--smc-text)',
          }}
        >
          健康调查
        </h2>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 'var(--smc-fs-sm)',
            color: 'var(--smc-text-2)',
          }}
        >
          医生给您派发的健康信息采集与评估任务。完成后评估会更准确。
        </p>
      </header>

      <Card>
        <div style={{ padding: '0 8px' }}>
          <Tabs
            activeKey={tab}
            onChange={(key) => setTab(key as TabKey)}
            items={[
              {
                key: 'pending',
                label: `待完成${tab === 'pending' && pendingCount ? ` (${pendingCount})` : ''}`,
              },
              { key: 'submitted', label: '已完成' },
            ]}
          />
        </div>
      </Card>

      {loading ? (
        <Card>
          <CardBody style={{ padding: 60, textAlign: 'center' }}>
            <Spinner />
          </CardBody>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((it) =>
            it.kind === 'survey' ? (
              <SurveyCard
                key={it.id}
                task={it.task}
                catalogMap={catalogMap}
                onOpen={() => setActiveSurvey(it.task)}
              />
            ) : (
              <PredictionCard
                key={it.id}
                task={it.task}
                catalogMap={catalogMap}
                onOpen={() => setActivePrediction(it.task)}
              />
            ),
          )}
        </div>
      )}

      {activeSurvey && (
        <SurveyFillModal
          task={activeSurvey}
          catalogMap={catalogMap}
          onClose={() => setActiveSurvey(null)}
          onSubmitted={() => {
            setActiveSurvey(null);
            load(tab);
          }}
        />
      )}
      {activePrediction && (
        <PredictionFillModal
          task={activePrediction}
          catalogMap={catalogMap}
          onClose={() => setActivePrediction(null)}
          onSubmitted={() => {
            setActivePrediction(null);
            load(tab);
          }}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------

const EmptyState: React.FC<{ tab: TabKey }> = ({ tab }) => (
  <Card>
    <CardBody style={{ padding: 48, textAlign: 'center', color: 'var(--smc-text-2)' }}>
      {tab === 'pending' ? (
        <>
          <CheckCircle2 size={36} style={{ color: 'var(--smc-success)', marginBottom: 8 }} />
          <div style={{ fontSize: 16, color: 'var(--smc-text)' }}>太棒了！</div>
          <div>目前没有待完成的任务。</div>
        </>
      ) : (
        <>
          <ClipboardList
            size={36}
            style={{ color: 'var(--smc-text-3)', marginBottom: 8 }}
          />
          <div>还没有已完成的任务。</div>
        </>
      )}
    </CardBody>
  </Card>
);

// ----- Survey card (legacy survey tasks) -----

const SurveyCard: React.FC<{
  task: SurveyTask;
  catalogMap: Record<string, FeatureCatalogEntry>;
  onOpen: () => void;
}> = ({ task, catalogMap, onOpen }) => {
  const isPending = task.status === 'pending';
  const labels = task.requested_fields
    .map((k) => catalogMap[k]?.label || k)
    .slice(0, 4);
  const remaining = task.requested_fields.length - labels.length;

  return (
    <Card>
      <CardBody>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700 }}>{task.title}</span>
              <Chip tone="default" outlined>
                信息采集
              </Chip>
              <Chip
                tone={
                  task.status === 'submitted'
                    ? 'success'
                    : task.status === 'cancelled'
                      ? 'default'
                      : 'warning'
                }
                outlined
              >
                {task.status === 'submitted'
                  ? '已提交'
                  : task.status === 'cancelled'
                    ? '已取消'
                    : '待完成'}
              </Chip>
            </div>
            {task.message && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: 'var(--smc-text-2)',
                  lineHeight: 1.6,
                }}
              >
                {task.message}
              </div>
            )}
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                color: 'var(--smc-text-2)',
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <span>
                <Clock size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                派发：{(task.created_at || '').slice(0, 10)}
              </span>
              {task.due_at && <span>截止：{task.due_at.slice(0, 10)}</span>}
              {task.doctor_name && <span>医生：{task.doctor_name}</span>}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {labels.map((label) => (
                <Chip key={label} outlined>
                  {label}
                </Chip>
              ))}
              {remaining > 0 && <Chip outlined>+{remaining} 项</Chip>}
            </div>
          </div>
          <div>
            {isPending ? (
              <Button variant="primary" startIcon={<Send size={14} />} onClick={onOpen}>
                立即填写
              </Button>
            ) : (
              <Button variant="text" onClick={onOpen}>
                查看详情
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

// ----- Prediction card -----

const PREDICTION_STATUS_LABEL: Record<string, string> = {
  pending_elder: '待完成',
  pending_doctor: '等待医生补全',
  pending_prediction: '正在评估',
  predicted: '已完成',
  failed: '评估失败',
  cancelled: '已取消',
};

const PredictionCard: React.FC<{
  task: PredictionTask;
  catalogMap: Record<string, FeatureCatalogEntry>;
  onOpen: () => void;
}> = ({ task, catalogMap, onOpen }) => {
  const isPending = task.status === 'pending_elder';
  const labels = task.elder_requested_fields
    .map((k) => catalogMap[k]?.label || k)
    .slice(0, 4);
  const remaining = task.elder_requested_fields.length - labels.length;

  return (
    <Card>
      <CardBody>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <HeartPulse size={16} style={{ color: 'var(--smc-primary)' }} />
              <span style={{ fontSize: 18, fontWeight: 700 }}>{task.title}</span>
              <Chip tone="info" outlined>
                健康评估
              </Chip>
              <Chip
                tone={
                  task.status === 'predicted'
                    ? 'success'
                    : task.status === 'failed'
                      ? 'error'
                      : task.status === 'cancelled'
                        ? 'default'
                        : task.status === 'pending_prediction'
                          ? 'info'
                          : 'warning'
                }
                outlined
              >
                {PREDICTION_STATUS_LABEL[task.status] || task.status}
              </Chip>
            </div>
            {task.message && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: 'var(--smc-text-2)',
                  lineHeight: 1.6,
                }}
              >
                {task.message}
              </div>
            )}
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                color: 'var(--smc-text-2)',
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <span>
                <Clock size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                派发：{(task.created_at || '').slice(0, 10)}
              </span>
              {task.due_at && <span>截止：{task.due_at.slice(0, 10)}</span>}
              {task.doctor_name && <span>医生：{task.doctor_name}</span>}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {labels.map((label) => (
                <Chip key={label} outlined>
                  {label}
                </Chip>
              ))}
              {remaining > 0 && <Chip outlined>+{remaining} 项</Chip>}
            </div>
            {task.status === 'predicted' && task.prediction && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: 'var(--smc-text-2)',
                }}
              >
                健康评分 {task.prediction.health_score.toFixed(1)} · 高风险概率{' '}
                {(task.prediction.high_risk_prob * 100).toFixed(1)}%
              </div>
            )}
          </div>
          <div>
            {isPending ? (
              <Button variant="primary" startIcon={<Send size={14} />} onClick={onOpen}>
                立即填写
              </Button>
            ) : (
              <Button variant="text" onClick={onOpen}>
                查看详情
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

// ----- Survey fill modal (legacy) -----

const SurveyFillModal: React.FC<{
  task: SurveyTask;
  catalogMap: Record<string, FeatureCatalogEntry>;
  onClose: () => void;
  onSubmitted: () => void;
}> = ({ task, catalogMap, onClose, onSubmitted }) => {
  const readonly = task.status !== 'pending';
  const [values, setValues] = useState<Record<string, number | null>>(() => {
    const init: Record<string, number | null> = {};
    task.requested_fields.forEach((k) => {
      const resp = task.responses?.[k];
      if (typeof resp === 'number') init[k] = resp;
      else if (typeof resp === 'string' && resp !== '') init[k] = Number(resp);
      else init[k] = null;
    });
    return init;
  });
  const [submitting, setSubmitting] = useState(false);

  const filled = Object.values(values).filter(
    (v) => typeof v === 'number' && Number.isFinite(v),
  ).length;
  const total = task.requested_fields.length;

  const handleSubmit = async () => {
    if (filled === 0) {
      message.warning('请至少回答一项');
      return;
    }
    setSubmitting(true);
    try {
      const responses: Record<string, number> = {};
      Object.entries(values).forEach(([k, v]) => {
        if (typeof v === 'number' && Number.isFinite(v)) responses[k] = v;
      });
      await submitSurvey(task.id, { responses });
      message.success('感谢您的填写！');
      window.dispatchEvent(new CustomEvent('elder:tasks:changed'));
      onSubmitted();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={task.title}
      width={760}
      footer={
        readonly ? (
          <Button variant="primary" onClick={onClose}>
            关闭
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="text" onClick={onClose} disabled={submitting}>
              稍后再填
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting}
            >
              提交 ({filled}/{total})
            </Button>
          </div>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {task.message && <Alert severity="info">{task.message}</Alert>}
        <div
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          }}
        >
          {task.requested_fields.map((key) => {
            const entry = catalogMap[key];
            if (!entry) {
              return (
                <div key={key} style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>
                  未知字段：{key}
                </div>
              );
            }
            return (
              <FeatureField
                key={key}
                entry={entry}
                value={values[key]}
                onChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
                disabled={readonly}
                required
              />
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

// ----- Prediction fill modal -----

const PredictionFillModal: React.FC<{
  task: PredictionTask;
  catalogMap: Record<string, FeatureCatalogEntry>;
  onClose: () => void;
  onSubmitted: () => void;
}> = ({ task, catalogMap, onClose, onSubmitted }) => {
  const readonly = task.status !== 'pending_elder';

  const staticKeys = task.elder_requested_fields.filter(
    (k) => catalogMap[k]?.source_kind === 'static',
  );
  const dynamicKeys = task.elder_requested_fields.filter(
    (k) => catalogMap[k]?.source_kind === 'dynamic',
  );

  const [values, setValues] = useState<Record<string, number | null>>(() => {
    const init: Record<string, number | null> = {};
    task.elder_requested_fields.forEach((k) => {
      const saved = task.elder_inputs?.[k];
      const cached = task.permanent_inputs?.[k];
      const v = saved ?? cached;
      if (typeof v === 'number') init[k] = v;
      else if (typeof v === 'string' && v !== '') init[k] = Number(v);
      else init[k] = null;
    });
    // Also include permanent fields prefill for static keys that weren't requested
    // (shouldn't happen, but guard).
    return init;
  });

  const [submitting, setSubmitting] = useState(false);

  const requiredCount = task.elder_requested_fields.filter(
    (k) => catalogMap[k]?.required !== false,
  ).length;
  const filledRequired = task.elder_requested_fields.filter((k) => {
    const entry = catalogMap[k];
    if (!entry || entry.required === false) return false;
    const v = values[k];
    return typeof v === 'number' && Number.isFinite(v);
  }).length;

  const handleSubmit = async () => {
    const missing = task.elder_requested_fields.filter((k) => {
      const entry = catalogMap[k];
      if (!entry || entry.required === false) return false;
      const v = values[k];
      return !(typeof v === 'number' && Number.isFinite(v));
    });
    if (missing.length > 0) {
      message.warning(`还有 ${missing.length} 项必填未完成`);
      return;
    }
    setSubmitting(true);
    try {
      const responses: Record<string, number> = {};
      Object.entries(values).forEach(([k, v]) => {
        if (typeof v === 'number' && Number.isFinite(v)) responses[k] = v;
      });
      const res = await elderSubmitPredictionTask(task.id, { responses });
      if (res.data.status === 'predicted') {
        message.success('感谢您的填写！评估已完成。');
      } else if (res.data.status === 'pending_prediction') {
        message.success('已提交，系统正在评估中。');
      } else if (res.data.status === 'pending_doctor') {
        message.success('已提交，等待医生补全后自动评估。');
      } else {
        message.success('已提交。');
      }
      window.dispatchEvent(new CustomEvent('elder:tasks:changed'));
      onSubmitted();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={task.title}
      width={820}
      footer={
        readonly ? (
          <Button variant="primary" onClick={onClose}>
            关闭
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="text" onClick={onClose} disabled={submitting}>
              稍后再填
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting}
            >
              提交 ({filledRequired}/{requiredCount})
            </Button>
          </div>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {task.message && <Alert severity="info">{task.message}</Alert>}

        {readonly && task.status === 'predicted' && task.prediction && (
          <Alert severity="success" title="评估已完成">
            健康评分 {task.prediction.health_score.toFixed(1)} · 高风险概率{' '}
            {(task.prediction.high_risk_prob * 100).toFixed(1)}%
          </Alert>
        )}

        {staticKeys.length > 0 && (
          <Section title="基础信息（一次填写长期使用）">
            <Grid>
              {staticKeys.map((k) => {
                const entry = catalogMap[k];
                if (!entry) return null;
                return (
                  <FeatureField
                    key={k}
                    entry={entry}
                    value={values[k]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [k]: v }))}
                    disabled={readonly}
                    required={entry.required !== false}
                  />
                );
              })}
            </Grid>
          </Section>
        )}

        {dynamicKeys.length > 0 && (
          <Section title="本次的健康情况">
            <Grid>
              {dynamicKeys.map((k) => {
                const entry = catalogMap[k];
                if (!entry) return null;
                return (
                  <FeatureField
                    key={k}
                    entry={entry}
                    value={values[k]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [k]: v }))}
                    disabled={readonly}
                    required={entry.required !== false}
                  />
                );
              })}
            </Grid>
          </Section>
        )}
      </div>
    </Modal>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div>
    <div
      style={{
        fontSize: 14,
        fontWeight: 700,
        marginBottom: 10,
        color: 'var(--smc-text)',
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'grid',
      gap: 14,
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    }}
  >
    {children}
  </div>
);

export default ElderSurveysPage;
