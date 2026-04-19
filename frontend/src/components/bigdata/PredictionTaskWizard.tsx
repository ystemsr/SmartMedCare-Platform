import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, PlayCircle, Send, Sparkles, UserCheck } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Input,
  Spinner,
  Textarea,
} from '@/components/ui';
import ElderPicker from '../ElderPicker';
import FeatureField from './FeatureField';
import PredictionResult from './PredictionResult';
import FeatureContributions from './FeatureContributions';
import {
  createPredictionTask,
  previewInputs,
} from '../../api/predictions';
import { message } from '../../utils/message';
import type { FeatureCatalogEntry } from '../../types/survey';
import type {
  InputsPreview,
  PredictionTask,
} from '../../types/prediction';

interface Props {
  catalog: FeatureCatalogEntry[];
  onCreated?: (task: PredictionTask) => void;
}

const PredictionTaskWizard: React.FC<Props> = ({ catalog, onCreated }) => {
  const [elderId, setElderId] = useState<number | ''>('');
  const [title, setTitle] = useState('健康风险评估');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<InputsPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [doctorInputs, setDoctorInputs] = useState<Record<string, number | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastTask, setLastTask] = useState<PredictionTask | null>(null);

  const catalogMap = useMemo(() => {
    const m: Record<string, FeatureCatalogEntry> = {};
    catalog.forEach((e) => (m[e.key] = e));
    return m;
  }, [catalog]);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setPreview(null);
    setLastTask(null);
    try {
      const res = await previewInputs(id);
      setPreview(res.data);
      // Prefill auxiliary h/w from archive if present, so the doctor can
      // keep or override the latest known measurement without retyping.
      const init: Record<string, number | null> = {};
      const auto = res.data.auto_inputs || {};
      (['HEIGHT_CM', 'WEIGHT_KG'] as const).forEach((k) => {
        const v = auto[k];
        if (typeof v === 'number' && Number.isFinite(v)) init[k] = v;
        else if (typeof v === 'string' && v !== '') init[k] = Number(v);
      });
      setDoctorInputs(init);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载预览失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (elderId === '' || !elderId) {
      setPreview(null);
      setDoctorInputs({});
      setLastTask(null);
      return;
    }
    load(Number(elderId));
  }, [elderId, load]);

  const doctorKeys = preview?.doctor_keys || [];
  const elderRequested = useMemo(() => {
    if (!preview) return [] as string[];
    // Elder only needs to fill static fields that aren't cached yet + all dynamic fields.
    const cached = new Set(Object.keys(preview.permanent_inputs || {}));
    return preview.elder_keys.filter((k) => !cached.has(k));
  }, [preview]);

  const requiredDoctorKeys = doctorKeys.filter(
    (k) => catalogMap[k]?.required,
  );
  const filledRequiredDoctor = requiredDoctorKeys.every(
    (k) => typeof doctorInputs[k] === 'number' && Number.isFinite(doctorInputs[k] as number),
  );

  const handleSubmit = async () => {
    if (elderId === '' || !elderId) {
      message.warning('请先选择老人');
      return;
    }
    if (!filledRequiredDoctor) {
      message.warning('请先填写所有带 * 的必填项');
      return;
    }
    setSubmitting(true);
    try {
      const cleaned: Record<string, number> = {};
      Object.entries(doctorInputs).forEach(([k, v]) => {
        if (typeof v === 'number' && Number.isFinite(v)) cleaned[k] = v;
      });
      const res = await createPredictionTask({
        elder_id: Number(elderId),
        title,
        message: note || undefined,
        doctor_inputs: cleaned,
      });
      setLastTask(res.data);
      if (res.data.status === 'predicted') {
        message.success('评估任务已完成');
      } else {
        message.success('已发送给老人填写其余部分');
      }
      onCreated?.(res.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Step 1: pick elder */}
      <Card>
        <CardBody>
          <StepHeader num={1} title="选择老人" icon={<UserCheck size={16} />} />
          <div
            style={{
              fontSize: 'var(--smc-fs-sm)',
              color: 'var(--smc-text-2)',
              marginTop: 4,
              marginBottom: 12,
            }}
          >
            系统将自动提取基础档案信息，并把永久信息（民族 / 受教育年限）复用到新任务。
          </div>
          <div style={{ maxWidth: 480 }}>
            <ElderPicker
              label="老人"
              value={elderId}
              onChange={(id) => setElderId(id)}
            />
          </div>
        </CardBody>
      </Card>

      {/* Step 2: auto + permanent inputs recap */}
      {elderId !== '' && elderId ? (
        loading ? (
          <Card>
            <CardBody style={{ textAlign: 'center', padding: 40 }}>
              <Spinner />
            </CardBody>
          </Card>
        ) : preview ? (
          <>
            <Card>
              <CardBody>
                <StepHeader
                  num={2}
                  title="档案自动填充"
                  icon={<Sparkles size={16} />}
                />
                <div
                  style={{
                    fontSize: 'var(--smc-fs-sm)',
                    color: 'var(--smc-text-2)',
                    marginTop: 4,
                    marginBottom: 14,
                  }}
                >
                  以下字段从老人档案自动读取，您无需填写。
                </div>
                <AutoInputsList
                  auto={preview.auto_inputs}
                  permanent={preview.permanent_inputs}
                  catalogMap={catalogMap}
                />
              </CardBody>
            </Card>

            {/* Step 3: doctor inputs */}
            <Card>
              <CardBody>
                <StepHeader
                  num={3}
                  title="医生现场评估"
                  icon={<ClipboardCheck size={16} />}
                />
                <div
                  style={{
                    fontSize: 'var(--smc-fs-sm)',
                    color: 'var(--smc-text-2)',
                    marginTop: 4,
                    marginBottom: 14,
                  }}
                >
                  请填写 <span style={{ color: 'var(--smc-error)', fontWeight: 700 }}>*</span>{' '}
                  为必填项；未进行的认知测试可留空，推理时将用人群均值替代。
                </div>
                <div
                  style={{
                    display: 'grid',
                    gap: 14,
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  }}
                >
                  {doctorKeys.map((key) => {
                    const entry = catalogMap[key];
                    if (!entry) return null;
                    return (
                      <FeatureField
                        key={key}
                        entry={entry}
                        value={doctorInputs[key]}
                        onChange={(v) =>
                          setDoctorInputs((prev) => ({ ...prev, [key]: v }))
                        }
                        required={entry.required}
                        highlight={entry.required && doctorInputs[key] == null}
                      />
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Step 4: what the elder will be asked */}
            <Card>
              <CardBody>
                <StepHeader
                  num={4}
                  title="待老人填写的内容"
                  icon={<Send size={16} />}
                />
                <div
                  style={{
                    fontSize: 'var(--smc-fs-sm)',
                    color: 'var(--smc-text-2)',
                    marginTop: 4,
                    marginBottom: 12,
                  }}
                >
                  {elderRequested.length === 0
                    ? '本次无需老人填写，可直接发起评估。'
                    : `以下 ${elderRequested.length} 项将出现在老人的"健康调查"待办中。`}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  {elderRequested.map((k) => (
                    <Chip key={k} outlined>
                      {catalogMap[k]?.label || k}
                    </Chip>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Step 5: title / note + submit */}
            <Card>
              <CardBody>
                <StepHeader num={5} title="任务备注" icon={<Send size={16} />} />
                <div
                  style={{
                    display: 'grid',
                    gap: 12,
                    gridTemplateColumns: '1fr',
                    marginTop: 10,
                  }}
                >
                  <Input
                    label="任务标题"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <Textarea
                    label="给老人的说明（选填）"
                    rows={3}
                    placeholder="例：近期要去医院检查，烦请花 2 分钟配合填写。"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <div style={{ margin: '16px 0' }}>
                  <Divider />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 12,
                  }}
                >
                  <Button
                    variant="primary"
                    size="lg"
                    startIcon={<PlayCircle size={16} />}
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={submitting || !filledRequiredDoctor}
                  >
                    创建评估任务
                  </Button>
                </div>
                {!filledRequiredDoctor && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: 'var(--smc-warning)',
                      textAlign: 'right',
                    }}
                  >
                    请先填写所有带 <strong>*</strong> 的必填项。
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Step 6 (optional): inline result if ready immediately */}
            {lastTask && (
              <TaskOutcome task={lastTask} />
            )}
          </>
        ) : null
      ) : (
        <Card>
          <CardBody
            style={{
              padding: '40px 0',
              textAlign: 'center',
              color: 'var(--smc-text-2)',
            }}
          >
            请先选择一位老人。
          </CardBody>
        </Card>
      )}
    </div>
  );
};

// ---- helpers ----

const StepHeader: React.FC<{
  num: number;
  title: string;
  icon?: React.ReactNode;
}> = ({ num, title, icon }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}
  >
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: 'var(--smc-primary)',
        color: '#fff',
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {num}
    </span>
    {icon ? <span style={{ color: 'var(--smc-primary)' }}>{icon}</span> : null}
    <span style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>{title}</span>
  </div>
);

const AutoInputsList: React.FC<{
  auto: Record<string, number | string | null>;
  permanent: Record<string, number | string | null>;
  catalogMap: Record<string, FeatureCatalogEntry>;
}> = ({ auto, permanent, catalogMap }) => {
  const AUX_KEYS = new Set(['HEIGHT_CM', 'WEIGHT_KG']);
  const items: { key: string; value: number | string | null; source: string }[] = [];
  Object.entries(auto).forEach(([k, v]) => {
    if (AUX_KEYS.has(k)) return; // shown in the doctor section
    items.push({ key: k, value: v, source: 'auto' });
  });
  Object.entries(permanent).forEach(([k, v]) =>
    items.push({ key: k, value: v, source: 'permanent' }),
  );

  if (items.length === 0) {
    return (
      <Alert severity="warning">
        老人档案中暂无可自动读取的信息，请先完善基础档案。
      </Alert>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 10,
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      }}
    >
      {items.map(({ key, value, source }) => {
        const entry = catalogMap[key];
        if (!entry) return null;
        let display: string = '';
        if (entry.type === 'enum' && entry.options) {
          const match = entry.options.find((o) => Number(o.value) === Number(value));
          display = match?.label || String(value ?? '—');
        } else if (entry.type === 'boolean') {
          display = value === 1 || value === '1' ? '是' : '否';
        } else {
          display = value == null || value === '' ? '—' : String(value);
        }
        return (
          <div
            key={key}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--smc-border)',
              background:
                'color-mix(in oklab, var(--smc-primary) 4%, transparent)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--smc-text-3)',
                marginBottom: 2,
              }}
            >
              {entry.label}
              {entry.unit ? ` (${entry.unit})` : ''}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{display}</div>
            <div style={{ marginTop: 4 }}>
              <Chip tone={source === 'auto' ? 'info' : 'default'} outlined>
                {source === 'auto' ? '档案自动' : '已保存'}
              </Chip>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TaskOutcome: React.FC<{ task: PredictionTask }> = ({ task }) => {
  if (task.status === 'predicted' && task.prediction) {
    return (
      <>
        <PredictionResult
          prediction={{
            high_risk_prob: task.prediction.high_risk_prob,
            high_risk: task.prediction.high_risk,
            followup_prob: task.prediction.followup_prob,
            followup_needed: task.prediction.followup_needed,
            health_score: task.prediction.health_score,
          }}
          title="评估已完成"
          subtitle={`任务 #${task.id} · ${(
            task.predicted_at || ''
          )
            .replace('T', ' ')
            .slice(0, 16)}`}
        />
        {task.contributions && task.contributions.length > 0 && (
          <FeatureContributions items={task.contributions} />
        )}
      </>
    );
  }
  if (task.status === 'failed') {
    return (
      <Alert severity="error" title={`任务 #${task.id} 执行失败`}>
        {task.error_message || '请检查模型文件或查看日志'}
      </Alert>
    );
  }
  return (
    <Alert severity="info" title={`任务 #${task.id} 已派发`}>
      老人提交填写后将自动生成评估结果，您可在"我的任务"中追踪进度。
    </Alert>
  );
};

export default PredictionTaskWizard;
