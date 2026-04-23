import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Stethoscope,
  LineChart as LineIcon,
  Download,
  Plus,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { Select, Button } from '../../components/ui';
import { getOverview, getTodos, getTrends } from '../../api/dashboard';
import type { DashboardOverview, TodoItem, TrendData } from '../../api/dashboard';
import { useAuthStore } from '../../store/auth';
import { message } from '../../utils/message';
import {
  RefPageHead,
  RefStat,
  RefGrid,
  RefCard,
  RefDonut,
  RefPill,
  RefSev,
} from '../../components/ref';

const CHART_COLORS = {
  alerts: '#D97757',
  followups: '#788C5D',
  assessments: '#6A9BCC',
};

const DashboardPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendRange, setTrendRange] = useState('7d');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, todosRes, trendsRes] = await Promise.all([
        getOverview(),
        getTodos(10),
        getTrends(trendRange),
      ]);
      setOverview(overviewRes.data);
      setTodos(todosRes.data);
      setTrends(trendsRes.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [trendRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartOption = useMemo(
    () =>
      trends
        ? {
            color: [CHART_COLORS.alerts, CHART_COLORS.followups, CHART_COLORS.assessments],
            tooltip: {
              trigger: 'axis' as const,
              backgroundColor: '#141413',
              borderColor: '#141413',
              textStyle: { color: '#F5F3EC', fontFamily: 'Poppins' },
              padding: [8, 12],
            },
            legend: {
              data: ['预警数', '随访数', '评估数'],
              textStyle: { color: '#55534C', fontFamily: 'Poppins', fontSize: 12 },
              itemGap: 20,
              icon: 'circle',
              top: 4,
            },
            grid: { left: 8, right: 12, bottom: 8, top: 36, containLabel: true },
            xAxis: {
              type: 'category' as const,
              data: trends.dates,
              axisLine: { lineStyle: { color: '#D8D5CC' } },
              axisLabel: { color: '#8A877D', fontFamily: 'Poppins', fontSize: 11 },
              axisTick: { show: false },
            },
            yAxis: {
              type: 'value' as const,
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: { color: '#8A877D', fontFamily: 'Poppins', fontSize: 11 },
              splitLine: { lineStyle: { color: '#E2DFD5', type: [4, 4] as any } },
            },
            series: [
              {
                name: '预警数',
                type: 'line',
                data: trends.alerts,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2.5 },
                areaStyle: {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: 'rgba(217,119,87,0.22)' },
                      { offset: 1, color: 'rgba(217,119,87,0)' },
                    ],
                  },
                },
              },
              {
                name: '随访数',
                type: 'line',
                data: trends.followups,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2.5 },
              },
              {
                name: '评估数',
                type: 'line',
                data: trends.assessments,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2.5 },
              },
            ],
          }
        : {},
    [trends],
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 12) return '早上好';
    if (h < 18) return '下午好';
    return '晚上好';
  }, []);

  const priorityPill: Record<string, { tone: any; label: string; sev: any }> = {
    urgent: { tone: 'risk', label: '紧急', sev: 'high' },
    high: { tone: 'warn', label: '重要', sev: 'high' },
    medium: { tone: 'info', label: '一般', sev: 'med' },
    low: { tone: 'mute', label: '普通', sev: 'low' },
  };

  // Donut breakdown of pending work types
  const donutData = useMemo(() => {
    if (!overview) return [];
    return [
      {
        value: overview.pending_alert_total || 0,
        color: 'var(--smc-error)',
        label: '待处理预警',
      },
      {
        value: overview.todo_followup_total || 0,
        color: 'var(--smc-primary)',
        label: '待随访',
      },
      {
        value: overview.assessment_total_today || 0,
        color: 'var(--smc-info)',
        label: '今日评估',
      },
      {
        value: overview.completed_followup_today || 0,
        color: 'var(--smc-success)',
        label: '已完成随访',
      },
    ];
  }, [overview]);

  return (
    <>
      <RefPageHead
        title={`${greeting}${user?.real_name ? `，${user.real_name}` : ''}`}
        subtitle={`${new Date().toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })} · 系统运行状态良好 · 数据每日凌晨汇总更新`}
        actions={
          <>
            <Button variant="outlined" size="sm" onClick={fetchData}>
              <Download size={14} />
              导出日报
            </Button>
            <Button size="sm">
              <Plus size={14} />
              新建老人档案
            </Button>
          </>
        }
      />

      {/* Stat grid */}
      <RefGrid cols={4} style={{ marginBottom: 16 }}>
        <RefStat
          label="老人总数"
          value={overview?.elder_total ?? '—'}
          sub="在管老人"
          icon={<Users size={16} />}
          tone="info"
        />
        <RefStat
          label="高风险人数"
          value={overview?.high_risk_total ?? '—'}
          sub="需重点关注"
          icon={<AlertTriangle size={16} />}
          tone="risk"
          valueColor="var(--smc-error)"
        />
        <RefStat
          label="待处理预警"
          value={overview?.pending_alert_total ?? '—'}
          sub="今日触发"
          icon={<Clock size={16} />}
          tone="warn"
        />
        <RefStat
          label="本周随访完成率"
          value={
            overview
              ? `${Math.round(
                  ((overview.completed_followup_today || 0) /
                    Math.max(1, overview.todo_followup_total || 0)) *
                    100,
                )}%`
              : '—'
          }
          sub={`今日完成 ${overview?.completed_followup_today ?? 0}`}
          icon={<CheckCircle2 size={16} />}
          tone="ok"
        />
      </RefGrid>

      {/* Trend chart + donut breakdown */}
      <div
        className="ref-grid"
        style={{ gridTemplateColumns: '2fr 1fr', marginBottom: 16, gap: 16 }}
      >
        <RefCard
          title="业务趋势"
          subtitle="预警、随访、评估的每日走势"
          actions={
            <div style={{ width: 140 }}>
              <Select
                value={trendRange}
                onChange={(v) => setTrendRange(String(v))}
                options={[
                  { label: '近 7 天', value: '7d' },
                  { label: '近 30 天', value: '30d' },
                  { label: '近 90 天', value: '90d' },
                ]}
              />
            </div>
          }
        >
          {trends ? (
            <ReactECharts option={chartOption} style={{ height: 300 }} />
          ) : (
            <div
              style={{
                color: 'var(--smc-text-3)',
                padding: '48px 0',
                textAlign: 'center',
                fontFamily: 'var(--smc-font-display)',
              }}
            >
              {loading ? '加载中…' : '暂无趋势数据'}
            </div>
          )}
        </RefCard>

        <RefCard title="工作分布" subtitle="各类事项占比">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <RefDonut data={donutData} centerLabel="总量" />
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: 13,
              }}
            >
              {donutData.map((d) => (
                <div
                  key={d.label}
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <span
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: d.color,
                      }}
                    />
                    {d.label}
                  </span>
                  <b>{d.value}</b>
                </div>
              ))}
            </div>
          </div>
        </RefCard>
      </div>

      {/* Todo list */}
      <RefCard
        title="近期待办"
        subtitle="按紧急程度排序"
        actions={
          <span style={{ fontSize: 12, color: 'var(--smc-text-3)' }}>
            共 {todos.length} 条
          </span>
        }
        flush
      >
        <table className="ref-table">
          <thead>
            <tr>
              <th>优先级</th>
              <th>类型</th>
              <th>事项</th>
              <th>说明</th>
              <th style={{ width: 100 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {todos.map((item) => {
              const pri = priorityPill[item.priority] || priorityPill.medium;
              return (
                <tr key={item.id}>
                  <td>
                    <RefSev level={pri.sev}>{pri.label}</RefSev>
                  </td>
                  <td>
                    <RefPill>{item.type}</RefPill>
                  </td>
                  <td style={{ fontWeight: 500 }}>{item.title}</td>
                  <td style={{ color: 'var(--smc-text-3)' }}>
                    {item.description || '—'}
                  </td>
                  <td>
                    <button className="ref-btn-small ref-btn-small--primary">
                      查看
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && todos.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    color: 'var(--smc-text-3)',
                    textAlign: 'center',
                    padding: '36px 0',
                    fontFamily: 'var(--smc-font-display)',
                  }}
                >
                  今日暂无待办事项
                </td>
              </tr>
            )}
            {loading && todos.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    color: 'var(--smc-text-3)',
                    textAlign: 'center',
                    padding: '36px 0',
                  }}
                >
                  加载中…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </RefCard>

      {/* Secondary metrics row */}
      <RefGrid cols={3} style={{ marginTop: 16 }}>
        <RefStat
          label="待随访任务"
          value={overview?.todo_followup_total ?? '—'}
          sub="尚未执行"
          icon={<Stethoscope size={16} />}
          tone="info"
        />
        <RefStat
          label="今日已完成随访"
          value={overview?.completed_followup_today ?? '—'}
          sub="计入 SLA"
          icon={<CheckCircle2 size={16} />}
          tone="ok"
        />
        <RefStat
          label="今日评估数"
          value={overview?.assessment_total_today ?? '—'}
          sub="当日新建"
          icon={<LineIcon size={16} />}
          tone="purple"
        />
      </RefGrid>
    </>
  );
};

export default DashboardPage;
