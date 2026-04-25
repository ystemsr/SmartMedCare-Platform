import React, { useCallback, useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { RefreshCw } from 'lucide-react';
import PageHeader from '../../components/bigdata/PageHeader';
import { Button, Card, CardBody, Chip, Select } from '@/components/ui';
import {
  getFollowupCompletion,
  getPipelineHealth,
  getPredictionTrend,
  getRegionalBreakdown,
  getRiskDistribution,
} from '../../api/bigdata';
import { message } from '../../utils/message';
import type {
  AnalyticsFollowupCompletion,
  AnalyticsPipelineHealth,
  AnalyticsPredictionTrend,
  AnalyticsRegionalBreakdown,
  AnalyticsRiskDistribution,
} from '../../types/bigdata';

const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const BigDataAnalyticsPage: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [risk, setRisk] = useState<AnalyticsRiskDistribution | null>(null);
  const [followup, setFollowup] = useState<AnalyticsFollowupCompletion | null>(null);
  const [regional, setRegional] = useState<AnalyticsRegionalBreakdown | null>(null);
  const [pipeline, setPipeline] = useState<AnalyticsPipelineHealth | null>(null);
  const [trend, setTrend] = useState<AnalyticsPredictionTrend | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [r, f, rg, pl, tr] = await Promise.all([
        getRiskDistribution(),
        getFollowupCompletion(days),
        getRegionalBreakdown(),
        getPipelineHealth(),
        getPredictionTrend(days),
      ]);
      setRisk(r.data);
      setFollowup(f.data);
      setRegional(rg.data);
      setPipeline(pl.data);
      setTrend(tr.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载分析数据失败');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div>
      <PageHeader
        title="多维统计分析"
        description="基于健康档案、预测结果与作业运行情况的可视化分析，支持医生和运维快速判断整体健康趋势"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select<number>
              value={days}
              onChange={(v) => setDays(Number(v))}
              options={[
                { label: '近 7 天', value: 7 },
                { label: '近 30 天', value: 30 },
                { label: '近 90 天', value: 90 },
              ]}
            />
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={14} />}
              onClick={reload}
              disabled={loading}
            >
              刷新
            </Button>
          </div>
        }
      />

      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          marginBottom: 20,
        }}
      >
        <PipelineCard data={pipeline} loading={loading} />
        <RiskDistributionCard data={risk} loading={loading} />
      </div>

      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          marginBottom: 20,
        }}
      >
        <FollowupTrendCard data={followup} loading={loading} />
        <PredictionTrendCard data={trend} loading={loading} />
      </div>

      <RegionalCard data={regional} loading={loading} />
    </div>
  );
};

// ---------------------- Pipeline Health ----------------------

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

const PipelineCard: React.FC<{
  data: AnalyticsPipelineHealth | null;
  loading: boolean;
}> = ({ data, loading }) => {
  return (
    <Card>
      <CardBody>
        <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>
          今日流水线健康度
        </div>
        <div
          style={{
            fontSize: 'var(--smc-fs-xs)',
            color: 'var(--smc-text-2)',
            marginBottom: 16,
          }}
        >
          ETL 与批量推理三段流水线最近 36 小时的运行状态
        </div>
        {loading && !data ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--smc-text-2)' }}>
            加载中...
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(data?.items || []).map((item, idx) => (
              <div
                key={item.stage}
                style={{
                  flex: 1,
                  minWidth: 160,
                  padding: 14,
                  borderRadius: 12,
                  background: 'var(--smc-surface-alt)',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--smc-text-2)',
                    marginBottom: 4,
                  }}
                >
                  第 {idx + 1} 步
                </div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {STAGE_LABEL[item.stage] || item.stage}
                </div>
                <Chip tone={STATUS_TONE(item.status)} outlined>
                  {item.status === 'missing'
                    ? '36 小时内未运行'
                    : item.status === 'succeeded'
                      ? '成功'
                      : item.status === 'failed'
                        ? '失败'
                        : item.status === 'running'
                          ? '运行中'
                          : item.status}
                </Chip>
                {item.finished_at && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--smc-text-2)',
                      marginTop: 6,
                    }}
                  >
                    完成于 {item.finished_at.slice(0, 16).replace('T', ' ')}
                  </div>
                )}
                {item.rows_processed != null && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--smc-text-2)',
                      marginTop: 2,
                    }}
                  >
                    处理 {item.rows_processed.toLocaleString()} 行
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

// ---------------------- Risk Distribution ----------------------

const RiskDistributionCard: React.FC<{
  data: AnalyticsRiskDistribution | null;
  loading: boolean;
}> = ({ data, loading }) => {
  const items = data?.items || [];
  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, icon: 'circle' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{c}' },
        data: items.map((item) => ({
          name: item.label,
          value: item.count,
          itemStyle: { color: RISK_COLORS[item.key] || '#6b7280' },
        })),
      },
    ],
  };

  const total = data?.total || 0;

  return (
    <Card>
      <CardBody>
        <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>
          风险等级分布
        </div>
        <div
          style={{
            fontSize: 'var(--smc-fs-xs)',
            color: 'var(--smc-text-2)',
            marginBottom: 12,
          }}
        >
          根据所有老人最近一次评估的健康评分划分
        </div>
        {loading && !data ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--smc-text-2)' }}>
            加载中...
          </div>
        ) : total === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--smc-text-2)' }}>
            暂无评估数据
          </div>
        ) : (
          <ReactECharts option={option} style={{ height: 300 }} notMerge lazyUpdate />
        )}
      </CardBody>
    </Card>
  );
};

// ---------------------- Followup trend ----------------------

const FollowupTrendCard: React.FC<{
  data: AnalyticsFollowupCompletion | null;
  loading: boolean;
}> = ({ data, loading }) => {
  const items = data?.items || [];
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['待处理', '进行中', '已完成'], bottom: 0 },
    grid: { left: 40, right: 24, top: 16, bottom: 40 },
    xAxis: { type: 'category', data: items.map((d) => d.date) },
    yAxis: { type: 'value' },
    series: [
      {
        name: '待处理',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: items.map((d) => d.todo),
        itemStyle: { color: '#94a3b8' },
      },
      {
        name: '进行中',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: items.map((d) => d.in_progress),
        itemStyle: { color: '#f59e0b' },
      },
      {
        name: '已完成',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: items.map((d) => d.completed),
        itemStyle: { color: '#10b981' },
      },
    ],
  };

  return (
    <Card>
      <CardBody>
        <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>
          随访完成趋势
        </div>
        <div
          style={{
            fontSize: 'var(--smc-fs-xs)',
            color: 'var(--smc-text-2)',
            marginBottom: 12,
          }}
        >
          按日统计随访任务的状态分布
        </div>
        {loading && !data ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--smc-text-2)' }}>
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--smc-text-2)' }}>
            暂无随访数据
          </div>
        ) : (
          <ReactECharts option={option} style={{ height: 300 }} notMerge lazyUpdate />
        )}
      </CardBody>
    </Card>
  );
};

// ---------------------- Prediction trend ----------------------

const PredictionTrendCard: React.FC<{
  data: AnalyticsPredictionTrend | null;
  loading: boolean;
}> = ({ data, loading }) => {
  const items = data?.items || [];
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['平均健康评分', '高风险人数'], bottom: 0 },
    grid: { left: 48, right: 48, top: 16, bottom: 40 },
    xAxis: { type: 'category', data: items.map((d) => d.date) },
    yAxis: [
      { type: 'value', name: '评分', min: 0, max: 100 },
      { type: 'value', name: '人数', splitLine: { show: false } },
    ],
    series: [
      {
        name: '平均健康评分',
        type: 'line',
        smooth: true,
        data: items.map((d) => d.avg_health_score),
        lineStyle: { width: 3, color: '#788C5D' },
        itemStyle: { color: '#788C5D' },
      },
      {
        name: '高风险人数',
        type: 'bar',
        yAxisIndex: 1,
        data: items.map((d) => d.high_risk_count),
        itemStyle: { color: 'rgba(239,68,68,0.7)' },
      },
    ],
  };

  return (
    <Card>
      <CardBody>
        <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>
          整体健康趋势
        </div>
        <div
          style={{
            fontSize: 'var(--smc-fs-xs)',
            color: 'var(--smc-text-2)',
            marginBottom: 12,
          }}
        >
          每日平均健康评分与高风险人数
        </div>
        {loading && !data ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--smc-text-2)' }}>
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--smc-text-2)' }}>
            暂无评估数据
          </div>
        ) : (
          <ReactECharts option={option} style={{ height: 300 }} notMerge lazyUpdate />
        )}
      </CardBody>
    </Card>
  );
};

// ---------------------- Regional ----------------------

const RegionalCard: React.FC<{
  data: AnalyticsRegionalBreakdown | null;
  loading: boolean;
}> = ({ data, loading }) => {
  const items = data?.items || [];
  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: 120, right: 40, top: 16, bottom: 24 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: items.map((d) => d.region),
      axisLabel: { fontSize: 12, color: 'var(--smc-text-2)' },
    },
    series: [
      {
        type: 'bar',
        data: items.map((d) => d.count),
        itemStyle: { color: '#D97757', borderRadius: [0, 6, 6, 0] },
      },
    ],
  };

  return (
    <Card>
      <CardBody>
        <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700 }}>
          地域分布（前 20）
        </div>
        <div
          style={{
            fontSize: 'var(--smc-fs-xs)',
            color: 'var(--smc-text-2)',
            marginBottom: 12,
          }}
        >
          按地址前缀统计的老人数量分布
        </div>
        {loading && !data ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--smc-text-2)' }}>
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--smc-text-2)' }}>
            暂无地址数据
          </div>
        ) : (
          <ReactECharts
            option={option}
            style={{ height: Math.max(260, items.length * 28) }}
            notMerge
            lazyUpdate
          />
        )}
      </CardBody>
    </Card>
  );
};

export default BigDataAnalyticsPage;
