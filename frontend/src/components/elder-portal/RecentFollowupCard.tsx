import React from 'react';
import { ClipboardList, ArrowRight, PhoneCall, MapPin, Video } from 'lucide-react';
import { Button, Card, CardBody } from '@/components/ui';
import { formatDateTime } from '@/utils/formatter';

export interface RecentFollowup {
  id: number;
  scheduled_at?: string | null;
  plan_type?: string | null;
  summary?: string | null;
  status?: string | null;
}

interface RecentFollowupCardProps {
  followup?: RecentFollowup | null;
  loading?: boolean;
  onViewDetail?: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  phone: '电话随访',
  visit: '上门随访',
  online: '在线随访',
  video: '视频随访',
};

function typeIcon(type?: string | null) {
  switch (type) {
    case 'phone':
      return <PhoneCall size={18} />;
    case 'visit':
      return <MapPin size={18} />;
    case 'video':
      return <Video size={18} />;
    default:
      return <ClipboardList size={18} />;
  }
}

const RecentFollowupCard: React.FC<RecentFollowupCardProps> = ({
  followup,
  loading,
  onViewDetail,
}) => {
  return (
    <Card style={{ borderRadius: 18, height: '100%' }}>
      <CardBody style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <ClipboardList size={22} style={{ color: '#a855f7' }} />
          <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--smc-text)' }}>
            最近一次随访
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ color: 'var(--smc-text-2)', fontSize: 15 }}>加载中...</div>
          ) : followup ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'color-mix(in oklab, #a855f7 14%, transparent)',
                    color: '#a855f7',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {typeIcon(followup.plan_type)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--smc-text)' }}>
                    {TYPE_LABEL[followup.plan_type ?? ''] || '随访'}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--smc-text-2)' }}>
                    {formatDateTime(followup.scheduled_at)}
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--smc-surface-alt)',
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: 'var(--smc-text)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  flex: 1,
                }}
              >
                {followup.summary?.trim() || '暂无摘要'}
              </div>
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: 'var(--smc-text-2)',
                fontSize: 16,
              }}
            >
              暂无随访记录
            </div>
          )}
        </div>

        <Button
          variant="outlined"
          size="lg"
          fullWidth
          endIcon={<ArrowRight size={18} />}
          disabled={!followup}
          onClick={onViewDetail}
          style={{ marginTop: 16 }}
        >
          查看完整记录
        </Button>
      </CardBody>
    </Card>
  );
};

export default RecentFollowupCard;
