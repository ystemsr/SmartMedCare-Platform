import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ReactECharts from 'echarts-for-react';
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

  const todoPriorityColor: Record<string, 'default' | 'primary' | 'warning' | 'error'> = {
    low: 'default',
    medium: 'primary',
    high: 'warning',
    urgent: 'error',
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
          },
        }}
      >
        <StatCard title="老人总数" value={overview?.elder_total ?? '-'} icon={<GroupsRoundedIcon />} color="#1f6feb" loading={loading} />
        <StatCard title="高风险人数" value={overview?.high_risk_total ?? '-'} icon={<WarningAmberRoundedIcon />} color="#d14343" loading={loading} />
        <StatCard title="待处理预警" value={overview?.pending_alert_total ?? '-'} icon={<PendingActionsRoundedIcon />} color="#d9822b" loading={loading} />
        <StatCard title="待随访任务" value={overview?.todo_followup_total ?? '-'} icon={<LocalHospitalRoundedIcon />} color="#0f9d8f" loading={loading} />
        <StatCard title="今日已完成随访" value={overview?.completed_followup_today ?? '-'} icon={<CheckCircleRoundedIcon />} color="#1f9d63" loading={loading} />
        <StatCard title="今日评估数" value={overview?.assessment_total_today ?? '-'} icon={<InsightsRoundedIcon />} color="#13c2c2" loading={loading} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(320px, 1fr)' },
        }}
      >
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              spacing={2}
              sx={{ mb: 2 }}
            >
              <Box>
                <Typography variant="h6">趋势数据</Typography>
                <Typography variant="body2" color="text.secondary">
                  近7天、30天或90天的变化趋势
                </Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>时间范围</InputLabel>
                <Select
                  label="时间范围"
                  value={trendRange}
                  onChange={(event) => setTrendRange(event.target.value as string)}
                >
                  <MenuItem value="7d">近7天</MenuItem>
                  <MenuItem value="30d">近30天</MenuItem>
                  <MenuItem value="90d">近90天</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            {trends ? (
              <ReactECharts option={chartOption} style={{ height: 350 }} />
            ) : (
              <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                暂无趋势数据
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              近期待办
            </Typography>
            <List disablePadding>
              {todos.map((item) => (
                <ListItem
                  key={item.id}
                  divider
                  disableGutters
                  sx={{ py: 1.25, alignItems: 'flex-start' }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 0.75 }}>
                        <Chip label={item.type} size="small" variant="outlined" />
                        <Chip
                          label={item.priority}
                          size="small"
                          color={todoPriorityColor[item.priority] || 'default'}
                          variant="outlined"
                        />
                      </Stack>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary">
                          {item.title}
                        </Typography>
                        <Typography component="span" variant="body2" display="block">
                          {item.description}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
              {!loading && todos.length === 0 && (
                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                  暂无待办事项
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default DashboardPage;
