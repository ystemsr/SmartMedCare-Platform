import React from 'react';
import { Smile } from 'lucide-react';
import dayjs from 'dayjs';
import { Card, CardBody } from '@/components/ui';

function getGreetingByTime(): string {
  const hour = dayjs().hour();
  if (hour < 6) return '夜深了，注意休息';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

interface WelcomeBannerProps {
  name?: string | null;
}

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({ name }) => {
  const greeting = getGreetingByTime();
  return (
    <Card
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        borderRadius: 18,
        overflow: 'hidden',
        position: 'relative',
        border: 'none',
      }}
    >
      <CardBody style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Smile size={40} style={{ opacity: 0.95, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 26, lineHeight: 1.2 }}>
              {name ? `${name}，${greeting}！` : `${greeting}！`}
            </div>
            <div style={{ marginTop: 6, opacity: 0.9, fontSize: 16 }}>
              {dayjs().format('YYYY年M月D日 dddd')} · 祝您身体健康
            </div>
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            pointerEvents: 'none',
          }}
        />
      </CardBody>
    </Card>
  );
};

export default WelcomeBanner;
