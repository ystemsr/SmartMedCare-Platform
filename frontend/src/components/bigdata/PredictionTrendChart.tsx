import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, CardBody } from '@/components/ui';
import type { PredictionRecord } from '../../types/bigdata';

interface Props {
  records: PredictionRecord[];
  loading?: boolean;
}

const PredictionTrendChart: React.FC<Props> = ({ records, loading }) => {
  const asc = [...records].reverse();
  const dates = asc.map((r) => (r.predicted_at || '').slice(0, 16).replace('T', ' '));
  const scores = asc.map((r) => Number(r.health_score));
  const highRiskProbs = asc.map((r) => Math.round(Number(r.high_risk_prob) * 1000) / 10);

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['健康评分', '高风险概率 (%)'], bottom: 0 },
    grid: { left: 48, right: 48, top: 24, bottom: 40 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: 'var(--smc-text-2)' },
    },
    yAxis: [
      {
        type: 'value',
        name: '评分',
        min: 0,
        max: 100,
        axisLabel: { color: 'var(--smc-text-2)' },
      },
      {
        type: 'value',
        name: '风险 %',
        min: 0,
        max: 100,
        axisLabel: { color: 'var(--smc-text-2)' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '健康评分',
        type: 'line',
        data: scores,
        smooth: true,
        lineStyle: { width: 3, color: '#0f9d8f' },
        itemStyle: { color: '#0f9d8f' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(15,157,143,0.25)' },
              { offset: 1, color: 'rgba(15,157,143,0)' },
            ],
          },
        },
      },
      {
        name: '高风险概率 (%)',
        type: 'line',
        yAxisIndex: 1,
        data: highRiskProbs,
        smooth: true,
        lineStyle: { width: 2, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b' },
      },
    ],
  };

  return (
    <Card>
      <CardBody>
        <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700, marginBottom: 4 }}>
          历次预测走势
        </div>
        <div
          style={{
            fontSize: 'var(--smc-fs-xs)',
            color: 'var(--smc-text-2)',
            marginBottom: 12,
          }}
        >
          展示该老人最近 {records.length} 次模型评估的健康评分与高风险概率变化。
        </div>
        {records.length === 0 ? (
          <div
            style={{
              padding: '40px 0',
              textAlign: 'center',
              color: 'var(--smc-text-2)',
            }}
          >
            {loading ? '加载中...' : '暂无历史预测'}
          </div>
        ) : (
          <ReactECharts option={option} style={{ height: 320 }} notMerge lazyUpdate />
        )}
      </CardBody>
    </Card>
  );
};

export default PredictionTrendChart;
