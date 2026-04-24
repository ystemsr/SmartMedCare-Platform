import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  IconButton,
  Input,
  Switch,
  Textarea,
} from '../../components/ui';
import { RefCard, RefPageHead, RefSectionLabel } from '../../components/ref';
import { message } from '../../utils/message';
import {
  getAIConfig,
  updateAIConfig,
  testAIConfig,
  type AIFullConfig,
  type AIModelEntry,
} from '../../api/ai';

const TEST_MODEL = 'minimax/minimax-m2.7';

type PromptRole = 'admin' | 'doctor' | 'elder' | 'family' | 'shared';

interface PromptFields {
  shared: string;
  admin: string;
  doctor: string;
  elder: string;
  family: string;
}

interface ModelRow {
  id: string;
  display_name: string;
  model: string;
}

interface FormValues {
  base_url: string;
  api_key: string; // empty = keep existing
  default_model: string; // actual model name of the default
  models: ModelRow[];
  temperature: string;
  max_tokens: string;
  reasoning_enabled: boolean;
  prompts: PromptFields;
}

const makeRowId = () =>
  `m_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

const defaults: FormValues = {
  base_url: '',
  api_key: '',
  default_model: 'minimax/minimax-m2.7',
  models: [],
  temperature: '0.7',
  max_tokens: '2048',
  reasoning_enabled: true,
  prompts: {
    shared: '',
    admin: '',
    doctor: '',
    elder: '',
    family: '',
  },
};

const PROMPT_TABS: {
  key: PromptRole;
  label: string;
  hint: string;
}[] = [
  {
    key: 'admin',
    label: '管理员',
    hint: '面向系统管理员：系统运维、权限、数据治理类问题。',
  },
  {
    key: 'doctor',
    label: '医生',
    hint: '面向医生：健康评估、风险研判、随访与干预辅助。',
  },
  {
    key: 'elder',
    label: '老人',
    hint: '面向老人：语气温和亲切，避免专业术语。',
  },
  {
    key: 'family',
    label: '家属',
    hint: '面向家属：兼顾通俗与准确，辅助了解老人健康与照护。',
  },
  {
    key: 'shared',
    label: '通用兜底',
    hint: '当某个角色未配置专属提示词时，使用该通用提示词。',
  },
];

/* ---------- Layout helpers ---------- */

const FormField: React.FC<{
  label: string;
  hint?: React.ReactNode;
  span?: 1 | 2;
  children: React.ReactNode;
}> = ({ label, hint, span = 1, children }) => (
  <div style={{ gridColumn: span === 2 ? '1 / span 2' : undefined }}>
    <label
      style={{
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--smc-text-2)',
        display: 'block',
        marginBottom: 8,
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </label>
    {children}
    {hint && (
      <div
        style={{
          fontSize: 12,
          color: 'var(--smc-text-3)',
          marginTop: 6,
          lineHeight: 1.5,
        }}
      >
        {hint}
      </div>
    )}
  </div>
);

const SectionTabs: React.FC<{
  active: 'model' | 'prompt';
  onChange: (t: 'model' | 'prompt') => void;
}> = ({ active, onChange }) => {
  const tabs: { key: 'model' | 'prompt'; label: string }[] = [
    { key: 'model', label: '模型配置' },
    { key: 'prompt', label: '系统提示词' },
  ];
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        gap: 2,
        background: 'var(--smc-surface-alt)',
        border: '1px solid var(--smc-border)',
        borderRadius: 999,
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            style={{
              position: 'relative',
              padding: '7px 18px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 999,
              border: 0,
              background: 'transparent',
              color: isActive ? 'var(--smc-text)' : 'var(--smc-text-3)',
              cursor: 'pointer',
              transition: 'color 0.2s ease',
            }}
          >
            {isActive && (
              <motion.span
                layoutId="ai-config-section-pill"
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--smc-surface)',
                  borderRadius: 999,
                  boxShadow: 'var(--smc-shadow-xs)',
                  zIndex: 0,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 420,
                  damping: 34,
                  mass: 0.7,
                }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const ModelList: React.FC<{
  rows: ModelRow[];
  defaultModel: string;
  onPatch: (id: string, patch: Partial<ModelRow>) => void;
  onRemove: (id: string) => void;
  onSetDefault: (modelName: string) => void;
}> = ({ rows, defaultModel, onPatch, onRemove, onSetDefault }) => {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: '28px 16px',
          textAlign: 'center',
          color: 'var(--smc-text-3)',
          fontSize: 13,
          border: '1px dashed var(--smc-border)',
          borderRadius: 'var(--smc-r-md)',
          background: 'var(--smc-surface-alt)',
        }}
      >
        还没有配置模型，点击右上角「添加模型」开始。
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '28px minmax(0, 1fr) minmax(0, 1.3fr) 36px',
          gap: 12,
          padding: '0 4px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--smc-text-3)',
        }}
      >
        <span>默认</span>
        <span>展示名称</span>
        <span>实际模型名</span>
        <span />
      </div>
      {rows.map((row) => {
        const isDefault =
          row.model.trim().length > 0 && row.model === defaultModel;
        return (
          <div
            key={row.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px minmax(0, 1fr) minmax(0, 1.3fr) 36px',
              gap: 12,
              alignItems: 'center',
              padding: 10,
              background: isDefault
                ? 'var(--smc-surface)'
                : 'var(--smc-surface-alt)',
              border: '1px solid var(--smc-border)',
              borderRadius: 'var(--smc-r-md)',
              transition: 'background 0.15s ease',
            }}
          >
            <input
              type="radio"
              name="ai-default-model"
              checked={isDefault}
              disabled={!row.model.trim()}
              onChange={() => onSetDefault(row.model.trim())}
              aria-label="设为默认模型"
              style={{ cursor: row.model.trim() ? 'pointer' : 'not-allowed' }}
            />
            <Input
              placeholder="Claude Sonnet 4.6"
              value={row.display_name}
              onChange={(e) =>
                onPatch(row.id, { display_name: e.target.value })
              }
            />
            <Input
              placeholder="anthropic/claude-sonnet-4.6"
              value={row.model}
              onChange={(e) => onPatch(row.id, { model: e.target.value })}
            />
            <IconButton
              aria-label="删除"
              onClick={() => onRemove(row.id)}
              title="删除"
            >
              <Trash2 size={14} />
            </IconButton>
          </div>
        );
      })}
    </div>
  );
};

const RolePills: React.FC<{
  active: PromptRole;
  onChange: (r: PromptRole) => void;
  filled: Record<PromptRole, boolean>;
}> = ({ active, onChange, filled }) => (
  <div
    role="tablist"
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 14,
    }}
  >
    {PROMPT_TABS.map((t) => {
      const isActive = active === t.key;
      return (
        <button
          key={t.key}
          role="tab"
          type="button"
          onClick={() => onChange(t.key)}
          style={{
            padding: '8px 14px',
            borderRadius: 999,
            border: `1px solid ${
              isActive ? 'var(--smc-text)' : 'var(--smc-border)'
            }`,
            background: isActive ? 'var(--smc-text)' : 'var(--smc-surface)',
            color: isActive ? 'var(--smc-surface)' : 'var(--smc-text-2)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <span>{t.label}</span>
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: filled[t.key]
                ? isActive
                  ? 'var(--smc-surface)'
                  : 'var(--smc-success, #2f855a)'
                : 'var(--smc-border)',
              opacity: filled[t.key] ? 0.9 : 0.6,
            }}
          />
        </button>
      );
    })}
  </div>
);

/* ---------- Page ---------- */

const AIConfigPage: React.FC = () => {
  const [tab, setTab] = useState<'model' | 'prompt'>('model');
  const [promptRole, setPromptRole] = useState<PromptRole>('admin');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [current, setCurrent] = useState<AIFullConfig | null>(null);
  const [values, setValues] = useState<FormValues>(defaults);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAIConfig();
      const cfg = res.data;
      setCurrent(cfg);
      const rows: ModelRow[] = (cfg.models || []).map((m) => ({
        id: makeRowId(),
        display_name: m.display_name || m.model,
        model: m.model,
      }));
      if (rows.length === 0 && cfg.model) {
        rows.push({
          id: makeRowId(),
          display_name: cfg.model,
          model: cfg.model,
        });
      }
      const defaultModel =
        cfg.model && rows.some((r) => r.model === cfg.model)
          ? cfg.model
          : rows[0]?.model || '';
      setValues({
        base_url: cfg.base_url || '',
        api_key: '',
        default_model: defaultModel,
        models: rows,
        temperature: String(cfg.temperature ?? 0.7),
        max_tokens: String(cfg.max_tokens ?? 2048),
        reasoning_enabled: !!cfg.reasoning_enabled,
        prompts: {
          shared: cfg.system_prompt || '',
          admin: cfg.system_prompt_admin || '',
          doctor: cfg.system_prompt_doctor || '',
          elder: cfg.system_prompt_elder || '',
          family: cfg.system_prompt_family || '',
        },
      });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const update = <K extends keyof FormValues>(key: K, val: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: val }));
  };

  const updatePrompt = (role: PromptRole, val: string) => {
    setValues((v) => ({ ...v, prompts: { ...v.prompts, [role]: val } }));
  };

  const patchModelRow = (id: string, patch: Partial<ModelRow>) => {
    setValues((v) => ({
      ...v,
      models: v.models.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const addModelRow = () => {
    setValues((v) => ({
      ...v,
      models: [...v.models, { id: makeRowId(), display_name: '', model: '' }],
    }));
  };

  const removeModelRow = (id: string) => {
    setValues((v) => {
      const next = v.models.filter((r) => r.id !== id);
      // If the removed row was the default, snap to the first remaining row.
      const removed = v.models.find((r) => r.id === id);
      let nextDefault = v.default_model;
      if (removed && removed.model === v.default_model) {
        nextDefault = next[0]?.model || '';
      }
      return { ...v, models: next, default_model: nextDefault };
    });
  };

  const setDefaultModel = (modelName: string) => {
    setValues((v) => ({ ...v, default_model: modelName }));
  };

  const save = async () => {
    // Validate: must have at least one model with a non-empty actual name.
    const cleanedModels: AIModelEntry[] = values.models
      .map((r) => ({
        display_name: r.display_name.trim() || r.model.trim(),
        model: r.model.trim(),
      }))
      .filter((m) => m.model.length > 0);
    if (cleanedModels.length === 0) {
      message.error('请至少配置一个模型');
      return;
    }
    // Dedupe by actual model name — keep first occurrence.
    const seen = new Set<string>();
    const deduped: AIModelEntry[] = [];
    for (const m of cleanedModels) {
      if (seen.has(m.model)) continue;
      seen.add(m.model);
      deduped.push(m);
    }
    const defaultModel = deduped.some((m) => m.model === values.default_model)
      ? values.default_model
      : deduped[0].model;

    setSaving(true);
    try {
      const payload: Parameters<typeof updateAIConfig>[0] = {
        base_url: values.base_url.trim(),
        model: defaultModel,
        models: deduped,
        temperature: Number(values.temperature) || 0.7,
        max_tokens: Number(values.max_tokens) || 2048,
        reasoning_enabled: values.reasoning_enabled,
        system_prompt: values.prompts.shared,
        system_prompt_admin: values.prompts.admin,
        system_prompt_doctor: values.prompts.doctor,
        system_prompt_elder: values.prompts.elder,
        system_prompt_family: values.prompts.family,
      };
      if (values.api_key.trim()) payload.api_key = values.api_key.trim();
      const res = await updateAIConfig(payload);
      setCurrent(res.data);
      // Rehydrate rows from the authoritative server response so IDs/order
      // stay stable and any server-side dedup is reflected.
      const rows: ModelRow[] = (res.data.models || []).map((m) => ({
        id: makeRowId(),
        display_name: m.display_name || m.model,
        model: m.model,
      }));
      setValues((v) => ({
        ...v,
        api_key: '',
        models: rows,
        default_model:
          res.data.model &&
          rows.some((r) => r.model === res.data.model)
            ? res.data.model
            : rows[0]?.model || '',
      }));
      message.success('已保存');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult('');
    try {
      const payload: Parameters<typeof testAIConfig>[0] = {
        base_url: values.base_url.trim() || undefined,
        model: TEST_MODEL,
      };
      if (values.api_key.trim()) payload.api_key = values.api_key.trim();
      const res = await testAIConfig(payload);
      setTestResult(
        `✅ 连接成功（${res.data.model}）：${res.data.reply || '（空回复）'}`,
      );
      message.success('测试通过');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '测试失败';
      setTestResult(`❌ ${msg}`);
      message.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const apiKeyHint = useMemo(() => {
    if (!current) return '';
    if (current.has_api_key) {
      return `当前已保存：${current.api_key_masked}（留空则保持不变）`;
    }
    return '尚未配置 API Key，请填写';
  }, [current]);

  const filledMap = useMemo<Record<PromptRole, boolean>>(
    () => ({
      admin: values.prompts.admin.trim().length > 0,
      doctor: values.prompts.doctor.trim().length > 0,
      elder: values.prompts.elder.trim().length > 0,
      family: values.prompts.family.trim().length > 0,
      shared: values.prompts.shared.trim().length > 0,
    }),
    [values.prompts],
  );

  const currentPromptTab = PROMPT_TABS.find((t) => t.key === promptRole)!;

  if (loading) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: 'center',
          color: 'var(--smc-text-3)',
        }}
      >
        正在加载…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <RefPageHead
        title="AI 模型配置"
        subtitle="管理 AI 助手接入的模型、连接参数与不同角色的专属提示词"
        actions={<SectionTabs active={tab} onChange={setTab} />}
      />

      {tab === 'model' && (
        <div
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'minmax(0, 1fr)',
          }}
        >
          <RefCard
            title="连接信息"
            subtitle="OpenAI 兼容接口的根地址与 API Key"
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 20,
              }}
            >
              <FormField
                label="Base URL"
                hint="例如 https://openrouter.ai/api/v1，不要包含 /chat/completions"
              >
                <Input
                  placeholder="https://openrouter.ai/api/v1"
                  value={values.base_url}
                  onChange={(e) => update('base_url', e.target.value)}
                />
              </FormField>
              <FormField label="API Key" hint={apiKeyHint}>
                <Input
                  type="password"
                  placeholder={
                    current?.has_api_key ? '留空则保持不变' : '请输入 API Key'
                  }
                  value={values.api_key}
                  onChange={(e) => update('api_key', e.target.value)}
                />
              </FormField>
            </div>
          </RefCard>

          <RefCard
            title="可用模型"
            subtitle="聊天页面会列出下方模型；勾选「默认」的那一项为未选择时使用的默认模型"
            actions={
              <Button variant="secondary" onClick={addModelRow}>
                <Plus size={14} style={{ marginRight: 4 }} />
                添加模型
              </Button>
            }
          >
            <ModelList
              rows={values.models}
              defaultModel={values.default_model}
              onPatch={patchModelRow}
              onRemove={removeModelRow}
              onSetDefault={setDefaultModel}
            />
          </RefCard>

          <RefCard
            title="生成参数"
            subtitle="控制回答的确定性、长度与推理过程展示"
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 20,
              }}
            >
              <FormField
                label="Temperature"
                hint="0 更确定、2 更发散。推荐 0.3 – 0.9"
              >
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={values.temperature}
                  onChange={(e) => update('temperature', e.target.value)}
                />
              </FormField>
              <FormField
                label="最大 Token 数"
                hint="单次回答的最大生成长度"
              >
                <Input
                  type="number"
                  step="1"
                  min="128"
                  max="32768"
                  value={values.max_tokens}
                  onChange={(e) => update('max_tokens', e.target.value)}
                />
              </FormField>
              <div
                style={{
                  gridColumn: '1 / span 2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: 'var(--smc-surface-alt)',
                  border: '1px solid var(--smc-border)',
                  borderRadius: 'var(--smc-r-md)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--smc-text)',
                    }}
                  >
                    启用思维链
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--smc-text-3)',
                      marginTop: 2,
                    }}
                  >
                    若模型支持，将展示独立的推理过程（例如 o1、DeepSeek R1）
                  </div>
                </div>
                <Switch
                  checked={values.reasoning_enabled}
                  onChange={(e) =>
                    update('reasoning_enabled', e.target.checked)
                  }
                />
              </div>
            </div>
          </RefCard>
        </div>
      )}

      {tab === 'prompt' && (
        <RefCard
          title="系统提示词"
          subtitle="为不同角色设置独立的提示词；留空则使用通用兜底"
        >
          <RolePills
            active={promptRole}
            onChange={setPromptRole}
            filled={filledMap}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <RefSectionLabel style={{ margin: 0 }}>
              {currentPromptTab.label} · System Prompt
            </RefSectionLabel>
            <div
              style={{
                fontSize: 12,
                color: 'var(--smc-text-3)',
              }}
            >
              {values.prompts[promptRole].length} 字
            </div>
          </div>
          <Textarea
            rows={14}
            placeholder={
              promptRole === 'shared'
                ? '当某个角色未单独设置提示词时，使用该文本作为兜底…'
                : `为「${currentPromptTab.label}」设定角色、语气与约束…`
            }
            value={values.prompts[promptRole]}
            onChange={(e) => updatePrompt(promptRole, e.target.value)}
          />
          <div
            style={{
              fontSize: 12,
              color: 'var(--smc-text-3)',
              marginTop: 10,
              lineHeight: 1.6,
              padding: '10px 12px',
              background: 'var(--smc-surface-alt)',
              border: '1px solid var(--smc-border)',
              borderRadius: 'var(--smc-r-sm, 8px)',
            }}
          >
            {currentPromptTab.hint}
            <br />
            聊天时系统会根据用户角色自动注入对应提示词；保存对全部角色生效。
          </div>
        </RefCard>
      )}

      {/* Sticky-looking action bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          padding: '14px 18px',
          background: 'var(--smc-surface)',
          border: '1px solid var(--smc-border)',
          borderRadius: 'var(--smc-r-lg)',
          boxShadow: 'var(--smc-shadow-xs)',
        }}
      >
        <Button onClick={save} loading={saving}>
          保存配置
        </Button>
        <Button variant="secondary" onClick={runTest} loading={testing}>
          测试连接
        </Button>
        <Button variant="text" onClick={load}>
          重新加载
        </Button>
        <div
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: 'var(--smc-text-3)',
          }}
        >
          测试模型：{TEST_MODEL}
        </div>
        {testResult && (
          <div
            style={{
              fontSize: 13,
              color: testResult.startsWith('✅')
                ? 'var(--smc-success, #2f855a)'
                : 'var(--smc-error, #c53030)',
              flexBasis: '100%',
              marginTop: 4,
            }}
          >
            {testResult}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIConfigPage;
