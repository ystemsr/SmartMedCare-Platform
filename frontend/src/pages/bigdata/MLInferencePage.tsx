import React, { useState } from 'react';
import { Play, Wand2, RotateCcw } from 'lucide-react';
import PageHeader from '../../components/bigdata/PageHeader';
import FeatureFieldset, {
  EMPTY_FEATURES,
  EXAMPLE_FEATURES,
} from '../../components/bigdata/FeatureFieldset';
import PredictionResult from '../../components/bigdata/PredictionResult';
import { Button, Card, CardBody, Tabs } from '@/components/ui';
import ElderPicker from '../../components/ElderPicker';
import { getLatestPrediction, predictOne } from '../../api/bigdata';
import { message } from '../../utils/message';
import type { FeatureDict, Prediction } from '../../types/bigdata';

const MLInferencePage: React.FC = () => {
  const [tab, setTab] = useState<'form' | 'history'>('form');

  const [features, setFeatures] = useState<FeatureDict>({ ...EMPTY_FEATURES });
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);

  const [elderId, setElderId] = useState<number | ''>('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<Prediction | null>(null);
  const [historyElderId, setHistoryElderId] = useState<number | null>(null);

  const handleChange = (name: keyof FeatureDict, value: number) => {
    setFeatures((prev) => ({ ...prev, [name]: value }));
  };

  const handlePredict = async () => {
    setPredicting(true);
    try {
      const res = await predictOne(features);
      setResult(res.data);
      message.success('预测完成');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '预测失败');
    } finally {
      setPredicting(false);
    }
  };

  const handleFillExample = () => {
    setFeatures({ ...EXAMPLE_FEATURES });
    message.info('已填充示例数据');
  };

  const handleReset = () => {
    setFeatures({ ...EMPTY_FEATURES });
    setResult(null);
  };

  const handleLoadHistory = async () => {
    if (elderId === '' || !Number.isFinite(elderId) || elderId <= 0) {
      message.warning('请选择老人');
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await getLatestPrediction(elderId);
      setHistory(res.data);
      setHistoryElderId(elderId);
    } catch (err) {
      setHistory(null);
      message.error(err instanceof Error ? err.message : '加载历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  const formPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <FeatureFieldset values={features} onChange={handleChange} />

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="outlined" startIcon={<Wand2 size={16} />} onClick={handleFillExample}>
          填充示例
        </Button>
        <Button variant="outlined" startIcon={<RotateCcw size={16} />} onClick={handleReset}>
          重置
        </Button>
        <Button
          variant="primary"
          size="lg"
          startIcon={<Play size={16} />}
          disabled={predicting}
          loading={predicting}
          onClick={handlePredict}
        >
          {predicting ? '计算中...' : '立即预测'}
        </Button>
      </div>

      {result && <PredictionResult prediction={result} subtitle="基于当前表单输入" />}
    </div>
  );

  const historyPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card>
        <CardBody>
          <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700, marginBottom: 4 }}>
            按老人查询
          </div>
          <div
            style={{
              fontSize: 'var(--smc-fs-sm)',
              color: 'var(--smc-text-2)',
              marginBottom: 16,
            }}
          >
            查询某位老人最近一次模型预测结果
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 320, flex: 1 }}>
              <ElderPicker
                label="老人"
                value={elderId}
                onChange={(id) => setElderId(id)}
              />
            </div>
            <Button
              variant="primary"
              onClick={handleLoadHistory}
              disabled={historyLoading}
              loading={historyLoading}
            >
              {historyLoading ? '查询中...' : '查询'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {history && (
        <PredictionResult
          prediction={history}
          title={`老人 #${historyElderId ?? ''} 最新预测`}
          subtitle="来自模型历史推理结果"
        />
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="AI 健康风险推理"
        description="基于机器学习模型对老人健康状态进行即时评估，输出高风险、随访建议和综合健康评分"
      />

      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: '0 8px' }}>
          <Tabs
            activeKey={tab}
            onChange={(key) => setTab(key as 'form' | 'history')}
            items={[
              { key: 'form', label: '即时推理' },
              { key: 'history', label: '历史记录' },
            ]}
          />
        </div>
      </Card>

      {tab === 'form' ? formPanel : historyPanel}
    </div>
  );
};

export default MLInferencePage;
