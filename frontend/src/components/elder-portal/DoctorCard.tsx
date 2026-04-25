import React from 'react';
import { Stethoscope, Phone, MessageSquare } from 'lucide-react';
import { Button, Card, CardBody } from '@/components/ui';

export interface DoctorInfo {
  name?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  title?: string | null;
}

interface DoctorCardProps {
  doctor?: DoctorInfo | null;
}

const DoctorCard: React.FC<DoctorCardProps> = ({ doctor }) => {
  const hasDoctor = !!doctor && !!doctor.name;
  const handleCall = () => {
    if (doctor?.phone) window.location.href = `tel:${doctor.phone}`;
  };
  return (
    <Card style={{ borderRadius: 18, height: '100%' }}>
      <CardBody style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Stethoscope size={22} style={{ color: '#0ea5e9' }} />
          <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--smc-text)' }}>
            我的主管医生
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flex: 1,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background:
                'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {doctor?.avatarUrl ? (
              <img
                src={doctor.avatarUrl}
                alt={doctor.name ?? ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              (doctor?.name?.slice(0, 1) ?? '医')
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--smc-text)' }}>
              {hasDoctor ? doctor!.name : '暂未分配'}
            </div>
            <div style={{ marginTop: 4, fontSize: 15, color: 'var(--smc-text-2)' }}>
              {doctor?.title || '主管医生'}
            </div>
            {doctor?.phone && (
              <div style={{ marginTop: 4, fontSize: 15, color: 'var(--smc-text-2)' }}>
                {doctor.phone}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button
            variant="primary"
            size="lg"
            startIcon={<Phone size={18} />}
            disabled={!doctor?.phone}
            onClick={handleCall}
            style={{ flex: 1 }}
          >
            呼叫
          </Button>
          <Button
            variant="outlined"
            size="lg"
            startIcon={<MessageSquare size={18} />}
            disabled={!hasDoctor}
            style={{ flex: 1 }}
          >
            留言
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};

export default DoctorCard;
