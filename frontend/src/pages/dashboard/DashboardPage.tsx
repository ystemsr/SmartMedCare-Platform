import React, { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, List, Tag, Select, message } from 'antd';
import {
  TeamOutlined,
  AlertOutlined,
  ScheduleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import StatCard from '../../components/StatCard';
import { getOverview, getTodos, getTrends } from '../../api/dashboard';
import type { DashboardOverview, TodoItem, TrendData } from '../../api/dashboard';

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

  const chartOption = trends
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
    : {};

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="老人总数"
            value={overview?.elder_total ?? '-'}
            icon={<TeamOutlined />}
            color="#1677ff"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="高风险人数"
            value={overview?.high_risk_total ?? '-'}
            icon={<WarningOutlined />}
            color="#ff4d4f"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="待处理预警"
            value={overview?.pending_alert_total ?? '-'}
            icon={<AlertOutlined />}
            color="#faad14"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="待随访任务"
            value={overview?.todo_followup_total ?? '-'}
            icon={<ScheduleOutlined />}
            color="#722ed1"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="今日已完成随访"
            value={overview?.completed_followup_today ?? '-'}
            icon={<CheckCircleOutlined />}
            color="#52c41a"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatCard
            title="今日评估数"
            value={overview?.assessment_total_today ?? '-'}
            icon={<FileSearchOutlined />}
            color="#13c2c2"
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            title="趋势数据"
            extra={
              <Select
                value={trendRange}
                onChange={setTrendRange}
                options={[
                  { label: '近7天', value: '7d' },
                  { label: '近30天', value: '30d' },
                  { label: '近90天', value: '90d' },
                ]}
                style={{ width: 100 }}
              />
            }
          >
            {trends && <ReactECharts option={chartOption} style={{ height: 350 }} />}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="近期待办" style={{ height: '100%' }}>
            <List
              loading={loading}
              dataSource={todos}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <span>
                        <Tag color="blue">{item.type}</Tag>
                        {item.title}
                      </span>
                    }
                    description={item.description}
                  />
                </List.Item>
              )}
              locale={{ emptyText: '暂无待办事项' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
