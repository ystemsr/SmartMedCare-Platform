import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Zap, Pencil, Trash2, Sparkles } from 'lucide-react';
import {
  Button,
  Chip,
  DatePicker,
  IconButton,
  Modal,
  Select,
  Spinner,
  Tooltip,
  confirm,
} from '../../components/ui';
import type { AppTableColumn } from '../../components/AppTable';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import ElderPicker from '../../components/ElderPicker';
import FeatureField from '../../components/bigdata/FeatureField';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import {
  getAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  generateAssessment,
  getAssessmentFeatureCatalog,
  getAssessmentPrefill,
} from '../../api/assessments';
import { formatDateTime, formatRiskLevel } from '../../utils/formatter';
import { RISK_LEVEL_OPTIONS, RISK_LEVEL_COLORS } from '../../utils/constants';
import { message } from '../../utils/message';
import type {
  Assessment,
  AssessmentListQuery,
} from '../../types/assessment';
import type { FeatureCatalogEntry } from '../../types/survey';
import { RefPageHead, RefGrid, RefCard } from '../../components/ref';

const ASSESSMENT_TYPE_OPTIONS = [
  { label: '综合评估', value: 'comprehensive' },
  { label: '血压评估', value: 'blood_pressure' },
  { label: '血糖评估', value: 'blood_glucose' },
  { label: '心理评估', value: 'mental' },
];

// Edit flow stays manual — doctors can correct score / risk_level / summary
// after the AI run if needed.
const editFormFields: FormFieldConfig[] = [
  { name: 'assessment_type', label: '评估类型', type: 'select', options: ASSESSMENT_TYPE_OPTIONS },
  { name: 'score', label: '评估分数', type: 'number', required: true },
  { name: 'risk_level', label: '风险等级', type: 'select', required: true, options: RISK_LEVEL_OPTIONS },
  { name: 'summary', label: '评估摘要', type: 'textarea', required: true },
];

type SectionKey = 'auto' | 'doctor' | 'elder';

const SECTION_META: Record<
  SectionKey,
  { title: string; hint: string; icon: React.ReactNode }
> = {
  auto: {
    title: '档案自动',
    hint: '根据老人基础档案和最新健康记录自动填充，一般无需修改。',
    icon: <Sparkles size={14} />,
  },
  doctor: {
    title: '医生现场评估',
    hint: '由医生在本次评估中现场测量或施测。',
    icon: <Pencil size={14} />,
  },
  elder: {
    title: '老人自述',
    hint: '老人近期自我报告项（可询问老人或家属填写；已填过的信息会自动带出）。',
    icon: <Plus size={14} />,
  },
};

const AssessmentPage: React.FC = () => {
  const [editVisible, setEditVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Assessment | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [generateElderId, setGenerateElderId] = useState<number | ''>('');
  const [generateLoading, setGenerateLoading] = useState(false);

  // AI create flow state
  const [catalog, setCatalog] = useState<FeatureCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [elderId, setElderId] = useState<number | ''>('');
  const [featureValues, setFeatureValues] = useState<
    Record<string, number | null>
  >({});
  const [sources, setSources] = useState<Record<string, string>>({});
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchFn = useCallback(
    (params: AssessmentListQuery & { page: number; page_size: number }) =>
      getAssessments(params),
    [],
  );
  const { data, loading, pagination, handleTableChange, refresh, handleSearch, query, setQuery } =
    useTable<Assessment, AssessmentListQuery>(fetchFn);

  // ── Feature catalog — loaded once on first open of the AI dialog ──
  const openCreate = () => {
    setElderId('');
    setFeatureValues({});
    setSources({});
    setCreateVisible(true);
    if (catalog.length === 0 && !catalogLoading) {
      setCatalogLoading(true);
      getAssessmentFeatureCatalog()
        .then((res) => setCatalog(res.data.items))
        .catch((err) =>
          message.error(err instanceof Error ? err.message : '加载特征目录失败'),
        )
        .finally(() => setCatalogLoading(false));
    }
  };

  // ── Prefill when elder changes ──
  useEffect(() => {
    if (elderId === '' || !Number.isFinite(elderId) || (elderId as number) <= 0) {
      return;
    }
    let alive = true;
    setPrefillLoading(true);
    getAssessmentPrefill(elderId as number)
      .then((res) => {
        if (!alive) return;
        const auto = res.data.auto_inputs || {};
        const perm = res.data.permanent_inputs || {};
        const merged: Record<string, number | null> = {};
        const srcMap: Record<string, string> = {};
        Object.entries(auto).forEach(([k, v]) => {
          if (v !== null && v !== undefined) {
            merged[k] = v as number;
            srcMap[k] = 'auto';
          }
        });
        Object.entries(perm).forEach(([k, v]) => {
          if (v !== null && v !== undefined) {
            merged[k] = v as number;
            srcMap[k] = 'permanent';
          }
        });
        setFeatureValues(merged);
        setSources(srcMap);
      })
      .catch((err) =>
        message.error(err instanceof Error ? err.message : '加载预填数据失败'),
      )
      .finally(() => {
        if (alive) setPrefillLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [elderId]);

  // ── Split catalog into the 3 UI sections ──
  const sections = useMemo(() => {
    const auto: FeatureCatalogEntry[] = [];
    const doctor: FeatureCatalogEntry[] = [];
    const elder: FeatureCatalogEntry[] = [];
    for (const entry of catalog) {
      if (entry.hidden) continue;
      if (entry.filler === 'auto') auto.push(entry);
      else if (entry.filler === 'doctor') doctor.push(entry);
      else elder.push(entry);
    }
    return { auto, doctor, elder };
  }, [catalog]);

  const handleField = (key: string, next: number | null) => {
    setFeatureValues((prev) => {
      const copy = { ...prev };
      if (next === null) {
        delete copy[key];
      } else {
        copy[key] = next;
      }
      return copy;
    });
    setSources((prev) => ({ ...prev, [key]: 'doctor' }));
  };

  const missingRequiredKeys = useMemo(() => {
    return catalog
      .filter(
        (e) =>
          e.required &&
          !e.hidden &&
          (featureValues[e.key] === undefined ||
            featureValues[e.key] === null),
      )
      .map((e) => e.key);
  }, [catalog, featureValues]);

  const handleCreateSubmit = async () => {
    if (elderId === '' || !Number.isFinite(elderId) || (elderId as number) <= 0) {
      message.warning('请选择老人');
      return;
    }
    if (missingRequiredKeys.length > 0) {
      const labels = missingRequiredKeys
        .map((k) => catalog.find((e) => e.key === k)?.label || k)
        .join('、');
      message.warning(`尚有必填项未填：${labels}`);
      return;
    }
    setSubmitting(true);
    try {
      await createAssessment({
        elder_id: elderId as number,
        assessment_type: 'comprehensive',
        feature_inputs: featureValues,
      });
      message.success('AI 评估已生成');
      setCreateVisible(false);
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '评估生成失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (record: Assessment) => {
    setEditingItem(record);
    setEditVisible(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: '删除评估记录',
      content: '确定删除该评估记录？',
      intent: 'danger',
      okText: '删除',
    });
    if (!ok) return;
    try {
      await deleteAssessment(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleGenerate = async () => {
    if (
      generateElderId === '' ||
      !Number.isFinite(generateElderId) ||
      generateElderId <= 0
    ) {
      message.warning('请选择老人');
      return;
    }
    try {
      setGenerateLoading(true);
      await generateAssessment({
        elder_id: generateElderId,
        force_recalculate: true,
      });
      message.success('评估生成成功');
      setGenerateModalVisible(false);
      setGenerateElderId('');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGenerateLoading(false);
    }
  };

  const columns: AppTableColumn<Assessment>[] = [
    {
      title: '老人姓名',
      dataIndex: 'elder_name',
      width: 120,
      render: (value) => (value ? String(value) : '-'),
    },
    { title: '评估类型', dataIndex: 'assessment_type', width: 120 },
    { title: '评分', dataIndex: 'score', width: 80 },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      width: 100,
      render: (level: unknown) => {
        const riskLevel = String(level ?? '');
        return (
          <Chip
            outlined
            style={{
              color: RISK_LEVEL_COLORS[riskLevel] || 'var(--smc-text)',
              borderColor: RISK_LEVEL_COLORS[riskLevel] || 'var(--smc-divider)',
            }}
          >
            {formatRiskLevel(riskLevel)}
          </Chip>
        );
      },
    },
    { title: '评估摘要', dataIndex: 'summary', ellipsis: true },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
    {
      title: '操作',
      key: 'actions',
      width: 96,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <PermissionGuard permission="assessment:create">
          <div
            style={{
              display: 'flex',
              gap: 4,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Tooltip title="编辑">
              <IconButton size="sm" onClick={() => handleEdit(record)}>
                <Pencil size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton size="sm" onClick={() => handleDelete(record.id)}>
                <Trash2 size={14} color="var(--smc-error)" />
              </IconButton>
            </Tooltip>
          </div>
        </PermissionGuard>
      ),
    },
  ];

  const avgScore =
    data.length > 0
      ? Math.round(
          data.reduce((sum, a) => sum + (a.score || 0), 0) / data.length,
        )
      : 0;
  const highRisk = data.filter((a) => a.risk_level === 'high').length;
  const totalByType = ASSESSMENT_TYPE_OPTIONS.map((t) => ({
    label: t.label,
    count: data.filter((d) => d.assessment_type === t.value).length,
    avg: (() => {
      const pool = data.filter((d) => d.assessment_type === t.value);
      return pool.length
        ? Math.round(
            pool.reduce((sum, a) => sum + (a.score || 0), 0) / pool.length,
          )
        : 0;
    })(),
    color:
      t.value === 'comprehensive'
        ? 'var(--smc-primary)'
        : t.value === 'blood_pressure'
          ? 'var(--smc-error)'
          : t.value === 'blood_glucose'
            ? 'var(--smc-warning)'
            : '#6e4fc9',
  }));

  const renderSection = (key: SectionKey, entries: FeatureCatalogEntry[]) => {
    if (entries.length === 0) return null;
    const meta = SECTION_META[key];
    return (
      <div
        key={key}
        style={{
          border: '1px solid var(--smc-border)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span style={{ color: 'var(--smc-primary)' }}>{meta.icon}</span>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{meta.title}</div>
          <Chip outlined tone="default">
            {entries.length} 项
          </Chip>
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--smc-text-2)',
            marginBottom: 12,
            lineHeight: 1.55,
          }}
        >
          {meta.hint}
        </div>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {entries.map((entry) => (
            <FeatureField
              key={entry.key}
              entry={entry}
              value={featureValues[entry.key] ?? null}
              onChange={(v) => handleField(entry.key, v)}
              sourceLabel={sources[entry.key]}
              required={entry.required && !entry.hidden}
              readonly={key === 'auto'}
              highlight={
                entry.required &&
                (featureValues[entry.key] === undefined ||
                  featureValues[entry.key] === null)
              }
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <RefPageHead
        title="健康评估"
        subtitle={`共 ${pagination.total ?? data.length} 份评估 · 平均得分 ${avgScore} · 高风险 ${highRisk} 人`}
        actions={
          <PermissionGuard permission="assessment:create">
            <Button
              variant="outlined"
              startIcon={<Zap size={14} />}
              onClick={() => setGenerateModalVisible(true)}
            >
              自动生成
            </Button>
            <Button startIcon={<Plus size={14} />} onClick={openCreate}>
              发起 AI 评估
            </Button>
          </PermissionGuard>
        }
      />

      <RefGrid cols={4} style={{ marginBottom: 16 }}>
        {totalByType.map((t) => (
          <RefCard key={t.label}>
            <div style={{ fontSize: 12, color: 'var(--smc-text-3)' }}>{t.label}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 500,
                fontFamily: 'var(--smc-font-display)',
                marginTop: 4,
              }}
            >
              {t.count}{' '}
              <span style={{ fontSize: 13, color: 'var(--smc-text-3)', fontWeight: 400 }}>
                份
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--smc-text-3)',
                marginTop: 4,
              }}
            >
              平均 {t.avg} 分
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="ref-bar-track">
                <div
                  className="ref-bar-fill"
                  style={{ width: `${Math.min(100, t.avg)}%`, background: t.color }}
                />
              </div>
            </div>
          </RefCard>
        ))}
      </RefGrid>

      <AppTable<Assessment>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索评估"
        toolbar={
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 120 }}>
              <Select
                label="风险等级"
                value={query.risk_level || ''}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, risk_level: v ? String(v) : undefined }))
                }
                options={[{ label: '全部', value: '' }, ...RISK_LEVEL_OPTIONS]}
              />
            </div>
            <div style={{ minWidth: 140 }}>
              <Select
                label="评估类型"
                value={query.assessment_type || ''}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, assessment_type: v ? String(v) : undefined }))
                }
                options={[{ label: '全部', value: '' }, ...ASSESSMENT_TYPE_OPTIONS]}
              />
            </div>
            <div style={{ minWidth: 160 }}>
              <DatePicker
                label="开始日期"
                value={query.date_start || null}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, date_start: v || undefined }))
                }
              />
            </div>
            <div style={{ minWidth: 160 }}>
              <DatePicker
                label="结束日期"
                value={query.date_end || null}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, date_end: v || undefined }))
                }
              />
            </div>
            <PermissionGuard permission="assessment:create">
              <Button
                variant="outlined"
                startIcon={<Zap size={14} />}
                onClick={() => setGenerateModalVisible(true)}
              >
                自动生成评估
              </Button>
              <Button startIcon={<Plus size={14} />} onClick={openCreate}>
                发起 AI 评估
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      {/* AI create modal — sectioned feature catalog form */}
      <Modal
        open={createVisible}
        onClose={() => setCreateVisible(false)}
        title="发起 AI 健康评估"
        width={880}
        footer={
          <>
            <Button variant="outlined" onClick={() => setCreateVisible(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreateSubmit}
              loading={submitting}
              disabled={submitting || missingRequiredKeys.length > 0}
            >
              {submitting
                ? '生成中...'
                : missingRequiredKeys.length > 0
                  ? `还有 ${missingRequiredKeys.length} 项必填`
                  : '生成评估'}
            </Button>
          </>
        }
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--smc-text-2)',
            marginBottom: 12,
            lineHeight: 1.55,
          }}
        >
          评估会调用 AI 模型综合 20 项健康指标生成分数、风险等级与建议。
          档案项会自动从基础档案与最新健康记录预填；医生项由本次评估现场填写；
          老人自述项可询问老人或家属。所有标 <span style={{ color: 'var(--smc-error)' }}>*</span>{' '}
          的字段必须填写。
        </div>
        <ElderPicker
          label="老人"
          required
          value={elderId}
          onChange={(id) => setElderId(id)}
        />
        <div style={{ marginTop: 16 }}>
          {catalogLoading || prefillLoading ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--smc-text-2)',
              }}
            >
              <Spinner /> 正在加载评估表单...
            </div>
          ) : (
            <>
              {renderSection('auto', sections.auto)}
              {renderSection('doctor', sections.doctor)}
              {renderSection('elder', sections.elder)}
            </>
          )}
        </div>
      </Modal>

      <AppForm
        title="编辑评估"
        visible={editVisible}
        fields={editFormFields}
        initialValues={editingItem || undefined}
        onSubmit={async (values) => {
          if (editingItem) {
            await updateAssessment(
              editingItem.id,
              values as Parameters<typeof updateAssessment>[1],
            );
          }
          message.success('更新成功');
          setEditVisible(false);
          refresh();
        }}
        onCancel={() => setEditVisible(false)}
      />

      <Modal
        open={generateModalVisible}
        onClose={() => {
          setGenerateModalVisible(false);
          setGenerateElderId('');
        }}
        title="自动生成评估（基于最近体征）"
        width={520}
        footer={
          <>
            <Button
              variant="outlined"
              onClick={() => {
                setGenerateModalVisible(false);
                setGenerateElderId('');
              }}
            >
              取消
            </Button>
            <Button onClick={handleGenerate} loading={generateLoading}>
              {generateLoading ? '生成中...' : '确定'}
            </Button>
          </>
        }
      >
        <ElderPicker
          label="老人"
          required
          value={generateElderId}
          onChange={(id) => setGenerateElderId(id)}
        />
      </Modal>
    </>
  );
};

export default AssessmentPage;
