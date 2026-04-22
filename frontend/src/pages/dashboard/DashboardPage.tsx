import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Stethoscope,
  LineChart,
  ArrowUpRight,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { Card, Chip, Select, type ChipTone } from '../../components/ui';
import StatCard from '../../components/StatCard';
import { getOverview, getTodos, getTrends } from '../../api/dashboard';
import type { DashboardOverview, TodoItem, TrendData } from '../../api/dashboard';
import { useAuthStore } from '../../store/auth';
import { message } from '../../utils/message';

// Warm, earthy chart palette — reads against the beige page background
// without ever returning to the cold blue-purple SaaS cliche.
const CHART_COLORS = {
  alerts: '#D97757', // primary orange
  followups: '#788C5D', // clay green
  assessments: '#6A9BCC', // muted slate blue (not a gradient, not neon)
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
              textStyle: { color: '#55534C', fontFamily: 'Poppins' },
              itemGap: 24,
              icon: 'circle',
              top: 4,
            },
            grid: { left: 8, right: 12, bottom: 8, top: 36, containLabel: true },
            xAxis: {
              type: 'category' as const,
              data: trends.dates,
              axisLine: { lineStyle: { color: '#D8D5CC' } },
              axisLabel: {
                color: '#8A877D',
                fontFamily: 'Poppins',
                fontSize: 11,
              },
              axisTick: { show: false },
            },
            yAxis: {
              type: 'value' as const,
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: {
                color: '#8A877D',
                fontFamily: 'Poppins',
                fontSize: 11,
              },
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

  const todoPriorityTone: Record<string, ChipTone> = {
    low: 'default',
    medium: 'info',
    high: 'warning',
    urgent: 'error',
  };

  const todoPriorityLabel: Record<string, string> = {
    low: '普通',
    medium: '一般',
    high: '重要',
    urgent: '紧急',
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 12) return '早上好';
    if (h < 18) return '下午好';
    return '晚上好';
  }, []);

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {/* Editorial hero — serif display + kicker line, asymmetric layout. */}
      <div className="smc-page-hero">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="smc-page-hero__kicker">工作台 · Overview</div>
          <h1 className="smc-page-hero__title">
            {greeting}
            {user?.real_name ? `，${user.real_name}` : ''}
          </h1>
          <p className="smc-page-hero__sub">
            今日的预警、随访与评估全貌一览。重要与紧急事项已置顶，数据每日凌晨汇总更新。
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: 'var(--smc-font-ui)',
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--smc-text-3)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--smc-success)',
              boxShadow: '0 0 0 3px rgba(92, 141, 93, 0.18)',
            }}
          />
          数据服务正常
        </div>
      </div>

      {/* KPI grid — six warm-toned metric cards. */}
      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        }}
      >
        <StatCard
          title="老人总数"
          value={overview?.elder_total ?? '-'}
          icon={<Users size={20} />}
          color="var(--smc-text)"
          loading={loading}
        />
        <StatCard
          title="高风险人数"
          value={overview?.high_risk_total ?? '-'}
          icon={<AlertTriangle size={20} />}
          color="var(--smc-error)"
          loading={loading}
        />
        <StatCard
          title="待处理预警"
          value={overview?.pending_alert_total ?? '-'}
          icon={<Clock size={20} />}
          color="var(--smc-primary)"
          loading={loading}
        />
        <StatCard
          title="待随访任务"
          value={overview?.todo_followup_total ?? '-'}
          icon={<Stethoscope size={20} />}
          color="var(--smc-secondary)"
          loading={loading}
        />
        <StatCard
          title="今日已完成随访"
          value={overview?.completed_followup_today ?? '-'}
          icon={<CheckCircle2 size={20} />}
          color="var(--smc-success)"
          loading={loading}
        />
        <StatCard
          title="今日评估数"
          value={overview?.assessment_total_today ?? '-'}
          icon={<LineChart size={20} />}
          color="var(--smc-info)"
          loading={loading}
        />
      </div>

      {/* Asymmetric 2-col: 1 : 1.618 (golden ratio) for chart vs. todo. */}
      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'minmax(0, 1.618fr) minmax(320px, 1fr)',
        }}
        className="smc-dashboard-grid"
      >
        <Card style={{ height: '100%' }}>
          <div style={{ padding: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 16,
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="smc-page-hero__kicker" style={{ marginBottom: 4 }}>
                  Trends
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: 'var(--smc-font-display)',
                    fontSize: 22,
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    color: 'var(--smc-text)',
                  }}
                >
                  业务趋势
                </h3>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 13,
                    color: 'var(--smc-text-2)',
                  }}
                >
                  近 7 / 30 / 90 天预警、随访与评估的变化曲线。
                </p>
              </div>
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
            </div>
            {trends ? (
              <ReactECharts option={chartOption} style={{ height: 340 }} />
            ) : (
              <div
                style={{
                  color: 'var(--smc-text-3)',
                  padding: '64px 0',
                  textAlign: 'center',
                  fontFamily: 'var(--smc-font-display)',
                  fontSize: 16,
                  letterSpacing: '-0.01em',
                }}
              >
                暂无趋势数据
              </div>
            )}
          </div>
        </Card>

        <Card style={{ height: '100%' }}>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div className="smc-page-hero__kicker" style={{ marginBottom: 4 }}>
                Inbox
              </div>
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--smc-font-display)',
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  color: 'var(--smc-text)',
                }}
              >
                近期待办
              </h3>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  color: 'var(--smc-text-2)',
                }}
              >
                按紧急程度排序的待办事项。
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {todos.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 0',
                    borderBottom:
                      idx === todos.length - 1
                        ? 'none'
                        : '1px solid var(--smc-divider)',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background:
                        item.priority === 'urgent'
                          ? 'var(--smc-error)'
                          : item.priority === 'high'
                            ? 'var(--smc-warning)'
                            : 'var(--smc-primary)',
                      marginTop: 8,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        marginBottom: 4,
                      }}
                    >
                      <Chip tone="default" outlined>
                        {item.type}
                      </Chip>
                      <Chip tone={todoPriorityTone[item.priority] || 'default'}>
                        {todoPriorityLabel[item.priority] || item.priority}
                      </Chip>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--smc-text)',
                        lineHeight: 1.45,
                      }}
                    >
                      {item.title}
                    </div>
                    {item.description && (
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--smc-text-2)',
                          marginTop: 4,
                          lineHeight: 1.55,
                        }}
                      >
                        {item.description}
                      </div>
                    )}
                  </div>
                  <ArrowUpRight
                    size={14}
                    style={{ color: 'var(--smc-text-3)', flexShrink: 0, marginTop: 6 }}
                  />
                </div>
              ))}
              {!loading && todos.length === 0 && (
                <div
                  style={{
                    color: 'var(--smc-text-3)',
                    padding: '48px 0',
                    textAlign: 'center',
                    fontFamily: 'var(--smc-font-display)',
                    fontSize: 15,
                  }}
                >
                  今日暂无待办事项
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
