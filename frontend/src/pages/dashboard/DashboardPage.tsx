import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Users, AlertTriangle, Clock, CheckCircle2, Stethoscope, LineChart } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { Card, Chip, Select, type ChipTone } from '../../components/ui';
import StatCard from '../../components/StatCard';
import { getOverview, getTodos, getTrends } from '../../api/dashboard';
import type { DashboardOverview, TodoItem, TrendData } from '../../api/dashboard';
import { message } from '../../utils/message';

const DashboardPage: React.FC = () => {
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
            tooltip: { trigger: 'axis' as const },
            legend: { data: ['预警数', '随访数', '评估数'] },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category' as const, data: trends.dates },
            yAxis: { type: 'value' as const },
            series: [
              { name: '预警数', type: 'line', data: trends.alerts, smooth: true },
              { name: '随访数', type: 'line', data: trends.followups, smooth: true },
              { name: '评估数', type: 'line', data: trends.assessments, smooth: true },
            ],
          }
        : {},
    [trends],
  );

  const todoPriorityTone: Record<string, ChipTone> = {
    low: 'default',
    medium: 'primary',
    high: 'warning',
    urgent: 'error',
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}
      >
        <StatCard title="老人总数" value={overview?.elder_total ?? '-'} icon={<Users size={20} />} color="#1f6feb" loading={loading} />
        <StatCard title="高风险人数" value={overview?.high_risk_total ?? '-'} icon={<AlertTriangle size={20} />} color="#d14343" loading={loading} />
        <StatCard title="待处理预警" value={overview?.pending_alert_total ?? '-'} icon={<Clock size={20} />} color="#d9822b" loading={loading} />
        <StatCard title="待随访任务" value={overview?.todo_followup_total ?? '-'} icon={<Stethoscope size={20} />} color="#0f9d8f" loading={loading} />
        <StatCard title="今日已完成随访" value={overview?.completed_followup_today ?? '-'} icon={<CheckCircle2 size={20} />} color="#1f9d63" loading={loading} />
        <StatCard title="今日评估数" value={overview?.assessment_total_today ?? '-'} icon={<LineChart size={20} />} color="#13c2c2" loading={loading} />
      </div>

      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)',
        }}
        className="smc-dashboard-grid"
      >
        <Card style={{ height: '100%' }}>
          <div style={{ padding: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>趋势数据</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--smc-text-2)' }}>
                  近7天、30天或90天的变化趋势
                </p>
              </div>
              <div style={{ width: 160 }}>
                <Select
                  value={trendRange}
                  onChange={(v) => setTrendRange(String(v))}
                  options={[
                    { label: '近7天', value: '7d' },
                    { label: '近30天', value: '30d' },
                    { label: '近90天', value: '90d' },
                  ]}
                />
              </div>
            </div>
            {trends ? (
              <ReactECharts option={chartOption} style={{ height: 350 }} />
            ) : (
              <div
                style={{
                  color: 'var(--smc-text-2)',
                  padding: '48px 0',
                  textAlign: 'center',
                }}
              >
                暂无趋势数据
              </div>
            )}
          </div>
        </Card>

        <Card style={{ height: '100%' }}>
          <div style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}>近期待办</h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {todos.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 0',
                    borderBottom:
                      idx === todos.length - 1 ? 'none' : '1px solid var(--smc-divider)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <Chip tone="default" outlined>
                      {item.type}
                    </Chip>
                    <Chip tone={todoPriorityTone[item.priority] || 'default'} outlined>
                      {item.priority}
                    </Chip>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--smc-text)' }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--smc-text-2)', marginTop: 2 }}>
                    {item.description}
                  </div>
                </div>
              ))}
              {!loading && todos.length === 0 && (
                <div
                  style={{
                    color: 'var(--smc-text-2)',
                    padding: '32px 0',
                    textAlign: 'center',
                  }}
                >
                  暂无待办事项
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
