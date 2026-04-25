import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import dayjs from 'dayjs';
import { Heart, Activity, Droplet } from 'lucide-react';
import { Card, CardBody } from '@/components/ui';

export interface TrendRecord {
  recorded_at?: string | null;
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  heart_rate?: number | null;
  blood_glucose?: number | null;
}

interface HealthTrendChartsProps {
  records: TrendRecord[];
}

const CHART_HEIGHT = 280;

const BASE_AXIS_LABEL = { fontSize: 14, color: '#5b4636' };
const BASE_LEGEND = {
  textStyle: { fontSize: 14, color: '#3f2d1f' },
  itemGap: 18,
  bottom: 0,
};
const TOOLTIP = {
  trigger: 'axis' as const,
  textStyle: { fontSize: 14 },
  backgroundColor: 'rgba(255, 250, 240, 0.96)',
  borderColor: '#e7d6b8',
  borderWidth: 1,
};

interface DailyAggregate {
  date: string;
  systolic: number | null;
  diastolic: number | null;
  heart_rate: number | null;
  blood_glucose: number | null;
}

function buildLast7Days(records: TrendRecord[]): DailyAggregate[] {
  const today = dayjs().startOf('day');
  const days: DailyAggregate[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    days.push({
      date: today.subtract(i, 'day').format('YYYY-MM-DD'),
      systolic: null,
      diastolic: null,
      heart_rate: null,
      blood_glucose: null,
    });
  }
  const dateIndex = new Map(days.map((d, idx) => [d.date, idx] as const));

  // Average values when multiple records share a day; ignore older than 7 days.
  const buckets = new Map<string, { sysSum: number; sysCnt: number; diaSum: number; diaCnt: number; hrSum: number; hrCnt: number; bgSum: number; bgCnt: number }>();
  records.forEach((r) => {
    if (!r.recorded_at) return;
    const day = dayjs(r.recorded_at).format('YYYY-MM-DD');
    if (!dateIndex.has(day)) return;
    const b = buckets.get(day) ?? { sysSum: 0, sysCnt: 0, diaSum: 0, diaCnt: 0, hrSum: 0, hrCnt: 0, bgSum: 0, bgCnt: 0 };
    if (r.blood_pressure_systolic != null) { b.sysSum += r.blood_pressure_systolic; b.sysCnt += 1; }
    if (r.blood_pressure_diastolic != null) { b.diaSum += r.blood_pressure_diastolic; b.diaCnt += 1; }
    if (r.heart_rate != null) { b.hrSum += r.heart_rate; b.hrCnt += 1; }
    if (r.blood_glucose != null) { b.bgSum += r.blood_glucose; b.bgCnt += 1; }
    buckets.set(day, b);
  });
  buckets.forEach((b, day) => {
    const idx = dateIndex.get(day);
    if (idx == null) return;
    days[idx].systolic = b.sysCnt ? Math.round((b.sysSum / b.sysCnt) * 10) / 10 : null;
    days[idx].diastolic = b.diaCnt ? Math.round((b.diaSum / b.diaCnt) * 10) / 10 : null;
    days[idx].heart_rate = b.hrCnt ? Math.round((b.hrSum / b.hrCnt) * 10) / 10 : null;
    days[idx].blood_glucose = b.bgCnt ? Math.round((b.bgSum / b.bgCnt) * 10) / 10 : null;
  });
  return days;
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconColor: string;
  option: EChartsOption;
  hasData: boolean;
}

function ChartCard({ title, subtitle, icon, iconColor, option, hasData }: ChartCardProps) {
  return (
    <Card style={{ borderRadius: 18, height: '100%' }}>
      <CardBody style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${iconColor}1f`,
              color: iconColor,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--smc-text)' }}>{title}</div>
            <div style={{ fontSize: 14, color: 'var(--smc-text-2)', marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        {hasData ? (
          <ReactECharts option={option} style={{ height: CHART_HEIGHT }} notMerge />
        ) : (
          <div
            style={{
              height: CHART_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--smc-text-3)',
              fontSize: 16,
            }}
          >
            最近 7 天暂无数据
          </div>
        )}
      </CardBody>
    </Card>
  );
}

const HealthTrendCharts: React.FC<HealthTrendChartsProps> = ({ records }) => {
  const days = useMemo(() => buildLast7Days(records), [records]);
  const axisDates = useMemo(() => days.map((d) => dayjs(d.date).format('M/D')), [days]);

  const hasBp = days.some((d) => d.systolic != null || d.diastolic != null);
  const hasHr = days.some((d) => d.heart_rate != null);
  const hasBg = days.some((d) => d.blood_glucose != null);

  const bpOption: EChartsOption = useMemo(() => ({
    tooltip: TOOLTIP,
    legend: { ...BASE_LEGEND, data: ['收缩压', '舒张压'] },
    grid: { left: 12, right: 16, top: 24, bottom: 56, containLabel: true },
    xAxis: {
      type: 'category',
      data: axisDates,
      axisLabel: BASE_AXIS_LABEL,
      axisLine: { lineStyle: { color: '#d8c9ad' } },
    },
    yAxis: {
      type: 'value',
      name: 'mmHg',
      nameTextStyle: { fontSize: 13, color: '#7a6a55' },
      axisLabel: BASE_AXIS_LABEL,
      splitLine: { lineStyle: { color: '#f0e6d2' } },
    },
    series: [
      {
        name: '收缩压',
        type: 'line',
        smooth: true,
        symbolSize: 9,
        lineStyle: { width: 3, color: '#c2410c' },
        itemStyle: { color: '#c2410c' },
        data: days.map((d) => d.systolic),
        connectNulls: true,
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(34, 139, 90, 0.10)' },
          data: [[{ yAxis: 90 }, { yAxis: 140 }]],
        },
      },
      {
        name: '舒张压',
        type: 'line',
        smooth: true,
        symbolSize: 9,
        lineStyle: { width: 3, color: '#9a3412' },
        itemStyle: { color: '#9a3412' },
        data: days.map((d) => d.diastolic),
        connectNulls: true,
      },
    ],
  }), [axisDates, days]);

  const hrOption: EChartsOption = useMemo(() => ({
    tooltip: TOOLTIP,
    legend: { ...BASE_LEGEND, data: ['心率'] },
    grid: { left: 12, right: 16, top: 24, bottom: 56, containLabel: true },
    xAxis: {
      type: 'category',
      data: axisDates,
      axisLabel: BASE_AXIS_LABEL,
      axisLine: { lineStyle: { color: '#d8c9ad' } },
    },
    yAxis: {
      type: 'value',
      name: 'bpm',
      nameTextStyle: { fontSize: 13, color: '#7a6a55' },
      axisLabel: BASE_AXIS_LABEL,
      splitLine: { lineStyle: { color: '#f0e6d2' } },
    },
    series: [
      {
        name: '心率',
        type: 'line',
        smooth: true,
        symbolSize: 9,
        lineStyle: { width: 3, color: '#b45309' },
        itemStyle: { color: '#b45309' },
        areaStyle: { color: 'rgba(180, 83, 9, 0.12)' },
        data: days.map((d) => d.heart_rate),
        connectNulls: true,
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(34, 139, 90, 0.10)' },
          data: [[{ yAxis: 60 }, { yAxis: 100 }]],
        },
      },
    ],
  }), [axisDates, days]);

  const bgOption: EChartsOption = useMemo(() => ({
    tooltip: TOOLTIP,
    legend: { ...BASE_LEGEND, data: ['血糖'] },
    grid: { left: 12, right: 16, top: 24, bottom: 56, containLabel: true },
    xAxis: {
      type: 'category',
      data: axisDates,
      axisLabel: BASE_AXIS_LABEL,
      axisLine: { lineStyle: { color: '#d8c9ad' } },
    },
    yAxis: {
      type: 'value',
      name: 'mmol/L',
      nameTextStyle: { fontSize: 13, color: '#7a6a55' },
      axisLabel: BASE_AXIS_LABEL,
      splitLine: { lineStyle: { color: '#f0e6d2' } },
    },
    series: [
      {
        name: '血糖',
        type: 'line',
        smooth: true,
        symbolSize: 9,
        lineStyle: { width: 3, color: '#a16207' },
        itemStyle: { color: '#a16207' },
        areaStyle: { color: 'rgba(161, 98, 7, 0.12)' },
        data: days.map((d) => d.blood_glucose),
        connectNulls: true,
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(34, 139, 90, 0.10)' },
          data: [[{ yAxis: 3.9 }, { yAxis: 7.8 }]],
        },
      },
    ],
  }), [axisDates, days]);

  return (
    <div
      style={{
        display: 'grid',
        gap: 20,
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      }}
    >
      <ChartCard
        title="血压"
        subtitle="最近 7 天 · 绿色区间为正常范围"
        icon={<Heart size={20} />}
        iconColor="#c2410c"
        option={bpOption}
        hasData={hasBp}
      />
      <ChartCard
        title="心率"
        subtitle="最近 7 天 · 静息心率 60–100 bpm"
        icon={<Activity size={20} />}
        iconColor="#b45309"
        option={hrOption}
        hasData={hasHr}
      />
      <ChartCard
        title="血糖"
        subtitle="最近 7 天 · 空腹 3.9–7.8 mmol/L"
        icon={<Droplet size={20} />}
        iconColor="#a16207"
        option={bgOption}
        hasData={hasBg}
      />
    </div>
  );
};

export default HealthTrendCharts;
