import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import PageHeader from '../../components/bigdata/PageHeader';
import FeatureFieldset, {
  EMPTY_FEATURES,
  EXAMPLE_FEATURES,
} from '../../components/bigdata/FeatureFieldset';
import PredictionResult from '../../components/bigdata/PredictionResult';
import { getLatestPrediction, predictOne } from '../../api/bigdata';
import { message } from '../../utils/message';
import type { FeatureDict, Prediction } from '../../types/bigdata';

const MLInferencePage: React.FC = () => {
  const [tab, setTab] = useState<'form' | 'history'>('form');

  const [features, setFeatures] = useState<FeatureDict>({ ...EMPTY_FEATURES });
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);

  const [elderId, setElderId] = useState<string>('');
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
    const parsed = Number(elderId);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      message.warning('请输入有效的老人 ID');
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await getLatestPrediction(parsed);
      setHistory(res.data);
      setHistoryElderId(parsed);
    } catch (err) {
      setHistory(null);
      message.error(err instanceof Error ? err.message : '加载历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="AI 健康风险推理"
        description="基于机器学习模型对老人健康状态进行即时评估，输出高风险、随访建议和综合健康评分"
      />

      <Card sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, next) => setTab(next)}
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="form" label="即时推理" />
          <Tab value="history" label="历史记录" />
        </Tabs>
      </Card>

      {tab === 'form' && (
        <Stack spacing={3}>
          <FeatureFieldset values={features} onChange={handleChange} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
            <Button
              variant="outlined"
              startIcon={<AutoFixHighRoundedIcon />}
              onClick={handleFillExample}
            >
              填充示例
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<RestartAltRoundedIcon />}
              onClick={handleReset}
            >
              重置
            </Button>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowRoundedIcon />}
              disabled={predicting}
              onClick={handlePredict}
            >
              {predicting ? '计算中...' : '立即预测'}
            </Button>
          </Stack>

          {result && <PredictionResult prediction={result} subtitle="基于当前表单输入" />}
        </Stack>
      )}

      {tab === 'history' && (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
                按老人 ID 查询
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                查询某位老人最近一次模型预测结果
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  label="老人 ID"
                  type="number"
                  size="small"
                  value={elderId}
                  onChange={(event) => setElderId(event.target.value)}
                  sx={{ minWidth: 220 }}
                />
                <Button
                  variant="contained"
                  onClick={handleLoadHistory}
                  disabled={historyLoading}
                >
                  {historyLoading ? '查询中...' : '查询'}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {history && (
            <PredictionResult
              prediction={history}
              title={`老人 #${historyElderId ?? ''} 最新预测`}
              subtitle="来自模型历史推理结果"
            />
          )}
        </Stack>
      )}
    </Box>
  );
};

export default MLInferencePage;
