import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { getAlertDetail, updateAlertStatus } from '../../api/alerts';
import { formatDateTime, formatRiskLevel, formatAlertStatus } from '../../utils/formatter';
import { RISK_LEVEL_COLORS, ALERT_STATUS_COLORS } from '../../utils/constants';
import { message } from '../../utils/message';
import type { Alert } from '../../types/alert';

const statusSteps = ['pending', 'processing', 'resolved'] as const;

function DetailItem({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value?: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <Box sx={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
          {value ?? '-'}
        </Typography>
      </Stack>
    </Box>
  );
}

const AlertDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const alertId = Number(id);

  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlert = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAlertDetail(alertId);
      setAlert(res.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  const handleStatusUpdate = async (status: Alert['status']) => {
    if (!window.confirm(`确认将该预警标记为${formatAlertStatus(status)}？`)) {
      return;
    }

    try {
      await updateAlertStatus(alertId, { status });
      message.success('状态更新成功');
      fetchAlert();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const currentStep =
    alert?.status === 'ignored' ? 0 : statusSteps.indexOf(alert?.status || 'pending');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate('/alerts')}
        sx={{ alignSelf: 'flex-start' }}
      >
        返回列表
      </Button>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h5" sx={{ mb: 0.5 }}>
                预警详情
              </Typography>
              <Typography variant="body2" color="text.secondary">
                查看预警基础信息、处理进度和后续操作
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                size="small"
                label={formatRiskLevel(alert?.risk_level)}
                sx={{
                  color: RISK_LEVEL_COLORS[alert?.risk_level || ''] || 'text.primary',
                  borderColor: RISK_LEVEL_COLORS[alert?.risk_level || ''] || 'divider',
                  bgcolor: 'transparent',
                }}
                variant="outlined"
              />
              <Chip
                size="small"
                label={formatAlertStatus(alert?.status)}
                sx={{
                  color: ALERT_STATUS_COLORS[alert?.status || ''] || 'text.primary',
                  borderColor: ALERT_STATUS_COLORS[alert?.status || ''] || 'divider',
                  bgcolor: 'transparent',
                }}
                variant="outlined"
              />
            </Stack>
          </Stack>

          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            <DetailItem label="预警标题" value={alert?.title} />
            <DetailItem label="预警类型" value={alert?.type} />
            <DetailItem
              label="风险等级"
              value={
                <Chip
                  size="small"
                  label={formatRiskLevel(alert?.risk_level)}
                  sx={{
                    color: RISK_LEVEL_COLORS[alert?.risk_level || ''] || 'text.primary',
                    borderColor: RISK_LEVEL_COLORS[alert?.risk_level || ''] || 'divider',
                    bgcolor: 'transparent',
                  }}
                  variant="outlined"
                />
              }
            />
            <DetailItem
              label="状态"
              value={
                <Chip
                  size="small"
                  label={formatAlertStatus(alert?.status)}
                  sx={{
                    color: ALERT_STATUS_COLORS[alert?.status || ''] || 'text.primary',
                    borderColor: ALERT_STATUS_COLORS[alert?.status || ''] || 'divider',
                    bgcolor: 'transparent',
                  }}
                  variant="outlined"
                />
              }
            />
            <DetailItem label="来源" value={alert?.source || '-'} />
            <DetailItem label="老人ID" value={alert?.elder_id} />
            <DetailItem label="触发时间" value={formatDateTime(alert?.triggered_at)} fullWidth />
            <DetailItem label="描述" value={alert?.description} fullWidth />
            {alert?.remark && <DetailItem label="备注" value={alert.remark} fullWidth />}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            处理进度
          </Typography>
          {alert?.status === 'ignored' && (
            <Chip
              color="default"
              variant="outlined"
              label="该预警已忽略，未进入标准处理流程"
              sx={{ mb: 2 }}
            />
          )}
          <Stepper activeStep={Math.max(currentStep, 0)} alternativeLabel>
            <Step>
              <StepLabel>
                <Stack spacing={0.5} alignItems="center">
                  <Typography variant="body2">待处理</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(alert?.triggered_at)}
                  </Typography>
                </Stack>
              </StepLabel>
            </Step>
            <Step>
              <StepLabel>
                <Typography variant="body2">处理中</Typography>
              </StepLabel>
            </Step>
            <Step>
              <StepLabel>
                <Stack spacing={0.5} alignItems="center">
                  <Typography variant="body2">已解决</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {alert?.resolved_at ? formatDateTime(alert.resolved_at) : '-'}
                  </Typography>
                </Stack>
              </StepLabel>
            </Step>
          </Stepper>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {alert?.status === 'pending' && (
              <Button
                variant="contained"
                startIcon={<ManageSearchRoundedIcon />}
                onClick={() => handleStatusUpdate('processing')}
              >
                开始处理
              </Button>
            )}
            {alert?.status === 'processing' && (
              <Button
                variant="contained"
                color="success"
                startIcon={<TaskAltRoundedIcon />}
                onClick={() => handleStatusUpdate('resolved')}
              >
                标记解决
              </Button>
            )}
            {(alert?.status === 'pending' || alert?.status === 'processing') && (
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<BlockRoundedIcon />}
                onClick={() => handleStatusUpdate('ignored')}
              >
                忽略
              </Button>
            )}
            <Button variant="outlined" onClick={() => navigate(`/elders/${alert?.elder_id}`)}>
              查看老人信息
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AlertDetailPage;
