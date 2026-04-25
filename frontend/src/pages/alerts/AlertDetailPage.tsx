import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, CheckCircle2, Ban, Check } from 'lucide-react';
import { Button, Card, Chip, Spinner, confirm } from '../../components/ui';
import { RefPageHead, RefStatusStrip } from '../../components/ref';
import { AlertTriangle } from 'lucide-react';
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
    <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: 12, color: 'var(--smc-text-2)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, wordBreak: 'break-word' }}>{value ?? '-'}</div>
    </div>
  );
}

interface StepperItemProps {
  label: string;
  subLabel?: string;
  done: boolean;
  active: boolean;
}

function StepperItem({ label, subLabel, done, active }: StepperItemProps) {
  const color = done
    ? 'var(--smc-success)'
    : active
      ? 'var(--smc-primary)'
      : 'var(--smc-text-3)';
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 96,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          color,
          background: done ? color : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {done ? <Check size={14} color="#fff" /> : null}
      </div>
      <div style={{ fontSize: 14, color: active ? 'var(--smc-text)' : 'var(--smc-text-2)' }}>
        {label}
      </div>
      {subLabel && (
        <div style={{ fontSize: 12, color: 'var(--smc-text-3)', marginTop: 2 }}>{subLabel}</div>
      )}
    </div>
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
    const ok = await confirm({
      title: '更新预警状态',
      content: `确认将该预警标记为${formatAlertStatus(status)}？`,
      intent: status === 'ignored' ? 'warning' : 'info',
    });
    if (!ok) return;

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
      <div style={{ display: 'flex', justifyContent: 'center', padding: '96px 0' }}>
        <Spinner />
      </div>
    );
  }

  const stripTone: 'risk' | 'warn' | 'ok' | 'info' =
    alert?.risk_level === 'high'
      ? 'risk'
      : alert?.risk_level === 'medium'
        ? 'warn'
        : alert?.status === 'resolved'
          ? 'ok'
          : 'info';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <Button variant="text" startIcon={<ArrowLeft size={14} />} onClick={() => navigate('/alerts')}>
          返回列表
        </Button>
      </div>

      <RefPageHead
        title={alert?.title || '预警详情'}
        subtitle={`${formatRiskLevel(alert?.risk_level)} · ${alert?.type || '—'} · 触发于 ${formatDateTime(alert?.triggered_at) || '—'}`}
        actions={
          <>
            <Chip
              outlined
              style={{
                color: RISK_LEVEL_COLORS[alert?.risk_level || ''] || 'var(--smc-text)',
                borderColor: RISK_LEVEL_COLORS[alert?.risk_level || ''] || 'var(--smc-divider)',
              }}
            >
              {formatRiskLevel(alert?.risk_level)}
            </Chip>
            <Chip
              outlined
              style={{
                color: ALERT_STATUS_COLORS[alert?.status || ''] || 'var(--smc-text)',
                borderColor: ALERT_STATUS_COLORS[alert?.status || ''] || 'var(--smc-divider)',
              }}
            >
              {formatAlertStatus(alert?.status)}
            </Chip>
          </>
        }
      />

      <RefStatusStrip tone={stripTone} icon={<AlertTriangle size={16} />}>
        {alert?.description ||
          `${formatRiskLevel(alert?.risk_level)} 预警 · 状态：${formatAlertStatus(alert?.status)}`}
      </RefStatusStrip>

      <Card>
        <div style={{ padding: 24 }}>
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}
          >
            <DetailItem label="预警标题" value={alert?.title} />
            <DetailItem label="预警类型" value={alert?.type} />
            <DetailItem
              label="风险等级"
              value={
                <Chip
                  outlined
                  style={{
                    color: RISK_LEVEL_COLORS[alert?.risk_level || ''] || 'var(--smc-text)',
                    borderColor:
                      RISK_LEVEL_COLORS[alert?.risk_level || ''] || 'var(--smc-divider)',
                  }}
                >
                  {formatRiskLevel(alert?.risk_level)}
                </Chip>
              }
            />
            <DetailItem
              label="状态"
              value={
                <Chip
                  outlined
                  style={{
                    color: ALERT_STATUS_COLORS[alert?.status || ''] || 'var(--smc-text)',
                    borderColor:
                      ALERT_STATUS_COLORS[alert?.status || ''] || 'var(--smc-divider)',
                  }}
                >
                  {formatAlertStatus(alert?.status)}
                </Chip>
              }
            />
            <DetailItem label="来源" value={alert?.source || '-'} />
            <DetailItem label="老人ID" value={alert?.elder_id} />
            <DetailItem label="触发时间" value={formatDateTime(alert?.triggered_at)} fullWidth />
            <DetailItem label="描述" value={alert?.description} fullWidth />
            {alert?.remark && <DetailItem label="备注" value={alert.remark} fullWidth />}
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>处理进度</h3>
          {alert?.status === 'ignored' && (
            <div style={{ marginBottom: 16 }}>
              <Chip outlined>该预警已忽略，未进入标准处理流程</Chip>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <StepperItem
              label="待处理"
              subLabel={formatDateTime(alert?.triggered_at) || undefined}
              done={currentStep > 0}
              active={currentStep === 0}
            />
            <StepperItem
              label="处理中"
              done={currentStep > 1}
              active={currentStep === 1}
            />
            <StepperItem
              label="已解决"
              subLabel={alert?.resolved_at ? formatDateTime(alert.resolved_at) : undefined}
              done={currentStep >= 2}
              active={currentStep === 2}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {alert?.status === 'pending' && (
              <Button
                startIcon={<Search size={14} />}
                onClick={() => handleStatusUpdate('processing')}
              >
                开始处理
              </Button>
            )}
            {alert?.status === 'processing' && (
              <Button
                startIcon={<CheckCircle2 size={14} />}
                onClick={() => handleStatusUpdate('resolved')}
              >
                标记解决
              </Button>
            )}
            {(alert?.status === 'pending' || alert?.status === 'processing') && (
              <Button
                variant="outlined"
                startIcon={<Ban size={14} />}
                onClick={() => handleStatusUpdate('ignored')}
              >
                忽略
              </Button>
            )}
            <Button variant="outlined" onClick={() => navigate(`/elders/${alert?.elder_id}`)}>
              查看老人信息
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AlertDetailPage;
