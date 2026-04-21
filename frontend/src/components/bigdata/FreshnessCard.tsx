import React from 'react';
import { CheckCircle2, AlertTriangle, Clock3, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Button, Card, CardBody, Chip } from '@/components/ui';
import type { ChipTone } from '@/components/ui';
import type { StageFreshness } from '../../types/bigdata';
import { formatDateTime } from '../../utils/formatter';

const TONE_STYLE: Record<
  string,
  {
    chipTone: ChipTone;
    chipLabel: string;
    icon: React.ReactNode;
    bigColor: string;
    ringColor: string;
  }
> = {
  fresh: {
    chipTone: 'success',
    chipLabel: '数据新鲜',
    icon: <CheckCircle2 size={16} />,
    bigColor: 'var(--smc-success)',
    ringColor: 'rgba(46, 160, 67, 0.18)',
  },
  aging: {
    chipTone: 'warning',
    chipLabel: '略有滞后',
    icon: <Clock3 size={16} />,
    bigColor: 'var(--smc-warning)',
    ringColor: 'rgba(201, 143, 0, 0.18)',
  },
  stale: {
    chipTone: 'error',
    chipLabel: '已过期',
    icon: <XCircle size={16} />,
    bigColor: 'var(--smc-error)',
    ringColor: 'rgba(207, 34, 46, 0.18)',
  },
  never: {
    chipTone: 'default',
    chipLabel: '从未运行',
    icon: <AlertTriangle size={16} />,
    bigColor: 'var(--smc-text-2)',
    ringColor: 'rgba(110, 119, 129, 0.18)',
  },
  running: {
    chipTone: 'info',
    chipLabel: '刷新中',
    icon: <Loader2 size={16} style={{ animation: 'smc-spin 0.9s linear infinite' }} />,
    bigColor: 'var(--smc-info)',
    ringColor: 'rgba(9, 105, 218, 0.18)',
  },
};

interface FreshnessCardProps {
  stage: StageFreshness;
  onRefresh: () => void;
  canRun: boolean;
  pipelineRunning: boolean;
}

const FreshnessCard: React.FC<FreshnessCardProps> = ({
  stage,
  onRefresh,
  canRun,
  pipelineRunning,
}) => {
  const tone = TONE_STYLE[stage.freshness_tone] || TONE_STYLE.never;
  const isRunning = stage.freshness_tone === 'running';

  const metaParts: string[] = [];
  if (stage.finished_at) {
    metaParts.push(`上次完成 ${formatDateTime(stage.finished_at)}`);
  }
  if (stage.rows_processed != null) {
    metaParts.push(`${stage.rows_processed.toLocaleString('zh-CN')} 行`);
  }
  if (stage.duration_ms != null) {
    const ms = stage.duration_ms;
    const pretty = ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 60000)}分钟`;
    metaParts.push(`耗时 ${pretty}`);
  }

  return (
    <Card style={{ height: '100%' }}>
      <CardBody>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--smc-fs-lg)',
                fontWeight: 700,
                color: 'var(--smc-text)',
              }}
            >
              {stage.display_name}
            </div>
            <div
              style={{
                fontSize: 'var(--smc-fs-xs)',
                color: 'var(--smc-text-2)',
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              {stage.description}
            </div>
          </div>
          <Chip tone={tone.chipTone} outlined>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {tone.icon}
              {tone.chipLabel}
            </span>
          </Chip>
        </div>

        <div
          style={{
            marginTop: 20,
            padding: '14px 16px',
            borderRadius: 10,
            background: tone.ringColor,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--smc-text-2)' }}>上次更新</div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: tone.bigColor,
              lineHeight: 1.15,
              marginTop: 4,
            }}
          >
            {stage.freshness_label}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            fontSize: 'var(--smc-fs-xs)',
            color: 'var(--smc-text-2)',
            minHeight: 18,
            lineHeight: 1.6,
          }}
        >
          {metaParts.length > 0 ? metaParts.join(' · ') : '暂无运行记录'}
        </div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            size="sm"
            startIcon={
              isRunning ? <Loader2 size={14} style={{ animation: 'smc-spin 0.9s linear infinite' }} /> : <RefreshCw size={14} />
            }
            onClick={onRefresh}
            disabled={!canRun || isRunning || pipelineRunning}
          >
            {isRunning ? '运行中' : '立即刷新此段'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};

export default FreshnessCard;
