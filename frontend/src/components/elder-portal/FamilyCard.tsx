import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus } from 'lucide-react';
import { Button, Card, CardBody } from '@/components/ui';

export interface FamilyMember {
  id: number;
  user_id?: number | null;
  relationship?: string | null;
  real_name?: string | null;
  phone?: string | null;
}

interface FamilyCardProps {
  members: FamilyMember[];
  loading?: boolean;
}

const FamilyCard: React.FC<FamilyCardProps> = ({ members, loading }) => {
  const navigate = useNavigate();
  return (
    <Card style={{ borderRadius: 18, height: '100%' }}>
      <CardBody style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Users size={22} style={{ color: '#16a34a' }} />
          <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--smc-text)' }}>
            关联家属
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 120,
          }}
        >
          {loading ? (
            <div style={{ color: 'var(--smc-text-2)', fontSize: 15 }}>加载中...</div>
          ) : members.length === 0 ? (
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
              暂无关联家属
            </div>
          ) : (
            members.map((m) => {
              const displayName = m.real_name?.trim() || `家属#${m.id}`;
              return (
                <div
                  key={m.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'var(--smc-surface-alt)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background:
                        'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {displayName.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--smc-text)' }}>
                      {displayName}
                      {m.relationship && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 13,
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: 'color-mix(in oklab, #16a34a 12%, transparent)',
                            color: '#16a34a',
                          }}
                        >
                          {m.relationship}
                        </span>
                      )}
                    </div>
                    {m.phone && (
                      <div style={{ marginTop: 2, fontSize: 14, color: 'var(--smc-text-2)' }}>
                        {m.phone}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Button
          variant="primary"
          size="lg"
          startIcon={<UserPlus size={18} />}
          fullWidth
          onClick={() => navigate('/elder/invite')}
          style={{ marginTop: 16 }}
        >
          邀请新家属
        </Button>
      </CardBody>
    </Card>
  );
};

export default FamilyCard;
