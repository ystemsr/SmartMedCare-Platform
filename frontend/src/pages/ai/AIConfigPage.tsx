import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Input,
  Switch,
  Textarea,
} from '../../components/ui';
import { RefPageHead } from '../../components/ref';
import { message } from '../../utils/message';
import {
  getAIConfig,
  updateAIConfig,
  testAIConfig,
  type AIFullConfig,
} from '../../api/ai';

const TEST_MODEL = 'minimax/minimax-m2.7';

interface FormValues {
  base_url: string;
  api_key: string; // empty = keep existing
  model: string;
  temperature: string;
  max_tokens: string;
  reasoning_enabled: boolean;
  system_prompt: string;
}

const defaults: FormValues = {
  base_url: '',
  api_key: '',
  model: 'minimax/minimax-m2.7',
  temperature: '0.7',
  max_tokens: '2048',
  reasoning_enabled: true,
  system_prompt: '',
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={['smc-tab', active && 'smc-tab--active'].filter(Boolean).join(' ')}
    style={{ padding: '10px 16px' }}
  >
    {children}
  </button>
);

const AIConfigPage: React.FC = () => {
  const [tab, setTab] = useState<'model' | 'prompt'>('model');
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
      setValues({
        base_url: cfg.base_url || '',
        api_key: '',
        model: cfg.model || 'minimax/minimax-m2.7',
        temperature: String(cfg.temperature ?? 0.7),
        max_tokens: String(cfg.max_tokens ?? 2048),
        reasoning_enabled: !!cfg.reasoning_enabled,
        system_prompt: cfg.system_prompt || '',
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

  const save = async () => {
    setSaving(true);
    try {
      const payload: Parameters<typeof updateAIConfig>[0] = {
        base_url: values.base_url.trim(),
        model: values.model.trim(),
        temperature: Number(values.temperature) || 0.7,
        max_tokens: Number(values.max_tokens) || 2048,
        reasoning_enabled: values.reasoning_enabled,
        system_prompt: values.system_prompt,
      };
      if (values.api_key.trim()) payload.api_key = values.api_key.trim();
      const res = await updateAIConfig(payload);
      setCurrent(res.data);
      setValues((v) => ({ ...v, api_key: '' }));
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
      return `当前已保存 API Key：${current.api_key_masked}（留空则保持不变）`;
    }
    return '尚未配置 API Key，请填写';
  }, [current]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#8a847b' }}>
        正在加载…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <RefPageHead
        title="AI 模型配置"
        subtitle="AI 助手接入的模型与连接参数"
      />

      <Card>
        <div
          style={{
            display: 'flex',
            gap: 4,
            borderBottom: '1px solid var(--smc-line)',
            marginBottom: 20,
          }}
        >
          <TabButton active={tab === 'model'} onClick={() => setTab('model')}>
            模型配置
          </TabButton>
          <TabButton active={tab === 'prompt'} onClick={() => setTab('prompt')}>
            系统提示词
          </TabButton>
        </div>

        {tab === 'model' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
            }}
          >
            <div style={{ gridColumn: '1 / span 2' }}>
              <label
                style={{
                  fontSize: 13,
                  color: '#5c5852',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Base URL
              </label>
              <Input
                placeholder="https://openrouter.ai/api/v1"
                value={values.base_url}
                onChange={(e) => update('base_url', e.target.value)}
              />
              <div style={{ fontSize: 12, color: '#8a847b', marginTop: 4 }}>
                OpenAI 兼容接口的根地址（不含 /chat/completions）
              </div>
            </div>

            <div style={{ gridColumn: '1 / span 2' }}>
              <label
                style={{
                  fontSize: 13,
                  color: '#5c5852',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                API Key
              </label>
              <Input
                type="password"
                placeholder={
                  current?.has_api_key ? '留空则保持不变' : '请输入 API Key'
                }
                value={values.api_key}
                onChange={(e) => update('api_key', e.target.value)}
              />
              <div style={{ fontSize: 12, color: '#8a847b', marginTop: 4 }}>
                {apiKeyHint}
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: 13,
                  color: '#5c5852',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                模型名称
              </label>
              <Input
                placeholder="minimax/minimax-m2.7"
                value={values.model}
                onChange={(e) => update('model', e.target.value)}
              />
              <div style={{ fontSize: 12, color: '#8a847b', marginTop: 4 }}>
                例如：openai/gpt-4o-mini、anthropic/claude-sonnet-4.5、
                deepseek/deepseek-chat
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: 13,
                  color: '#5c5852',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Temperature
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={values.temperature}
                onChange={(e) => update('temperature', e.target.value)}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 13,
                  color: '#5c5852',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                最大 Token 数
              </label>
              <Input
                type="number"
                step="1"
                min="128"
                max="32768"
                value={values.max_tokens}
                onChange={(e) => update('max_tokens', e.target.value)}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Switch
                checked={values.reasoning_enabled}
                onChange={(e) =>
                  update('reasoning_enabled', e.target.checked)
                }
              />
              <div>
                <div style={{ fontSize: 13, color: '#1f1e1c' }}>启用思维链</div>
                <div style={{ fontSize: 12, color: '#8a847b' }}>
                  若模型支持，将展示独立的推理过程
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'prompt' && (
          <div>
            <label
              style={{
                fontSize: 13,
                color: '#5c5852',
                display: 'block',
                marginBottom: 6,
              }}
            >
              System Prompt
            </label>
            <Textarea
              rows={8}
              placeholder="为 AI 助手设定角色、语气与约束…"
              value={values.system_prompt}
              onChange={(e) => update('system_prompt', e.target.value)}
            />
            <div style={{ fontSize: 12, color: '#8a847b', marginTop: 6 }}>
              每次对话都会自动前置此提示词。
            </div>
          </div>
        )}

        <Divider style={{ margin: '20px 0' }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <Button onClick={save} loading={saving}>
            保存配置
          </Button>
          <Button variant="secondary" onClick={runTest} loading={testing}>
            测试连接（{TEST_MODEL}）
          </Button>
          <Button variant="text" onClick={load}>
            重新加载
          </Button>
          {testResult && (
            <div
              style={{
                fontSize: 13,
                color: testResult.startsWith('✅') ? '#2f855a' : '#c53030',
                flexBasis: '100%',
                marginTop: 6,
              }}
            >
              {testResult}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AIConfigPage;
