import React, { useEffect, useState } from 'react';
import {
  User,
  Phone,
  Home,
  Users,
  Cake,
  Contact,
  PhoneCall,
  ArrowRight,
  HeartPulse,
  AlertTriangle,
  ClipboardList,
  CalendarDays,
  BellRing,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, Chip } from '@/components/ui';
import { getFamilySelf, getFamilyElder, getElderAlerts, getElderHealthRecords } from '../../api/family';
import type { FamilyMemberInfo, FamilyElderInfo } from '../../types/family';
import StatCard from '../../components/StatCard';
import { message } from '../../utils/message';
import { formatDateTime } from '../../utils/formatter';

interface AlertRecord {
  id: number;
  alert_type: string;
  level: string;
  message: string;
  status: string;
  created_at: string;
}

interface HealthRecord {
  id: number;
  record_date: string;
}

const alertLevelColorMap: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6',
};

const alertLevelLabelMap: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

function InfoField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 20,
        background: 'var(--smc-bg-2, #f8fafc)',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: 'var(--smc-text-2)', display: 'inline-flex', alignItems: 'center' }}>
          {icon}
        </span>
        <span style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, paddingLeft: 2 }}>{value || '-'}</div>
    </div>
  );
}

function SkeletonPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="smc-skel" style={{ height: 120, borderRadius: 24 }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="smc-skel" style={{ height: 100, borderRadius: 24 }} />
        ))}
      </div>
      <div className="smc-skel" style={{ height: 280, borderRadius: 24 }} />
      <div className="smc-skel" style={{ height: 200, borderRadius: 24 }} />
    </div>
  );
}

const FamilyHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [familyInfo, setFamilyInfo] = useState<FamilyMemberInfo | null>(null);
  const [elderInfo, setElderInfo] = useState<FamilyElderInfo | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<AlertRecord[]>([]);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [healthTotal, setHealthTotal] = useState(0);
  const [latestRecordDate, setLatestRecordDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [selfRes, elderRes] = await Promise.all([getFamilySelf(), getFamilyElder()]);
        const family = selfRes.data as FamilyMemberInfo;
        const elder = elderRes.data as FamilyElderInfo;
        setFamilyInfo(family);
        setElderInfo(elder);

        // Fetch stats in parallel
        setStatsLoading(true);
        try {
          const [alertsRes, healthRes] = await Promise.all([
            getElderAlerts({ elder_id: family.elder_id, page: 1, page_size: 5 }),
            getElderHealthRecords(family.elder_id, { page: 1, page_size: 1 }),
          ]);
          const alertsData = alertsRes.data as { items: AlertRecord[]; total: number };
          const healthData = healthRes.data as { items: HealthRecord[]; total: number };
          setRecentAlerts(alertsData.items || []);
          setAlertsTotal(alertsData.total || 0);
          setHealthTotal(healthData.total || 0);
          if (healthData.items?.length > 0) {
            setLatestRecordDate(healthData.items[0].record_date);
          }
        } catch {
          message.error('获取统计信息失败');
        } finally {
          setStatsLoading(false);
        }
      } catch {
        message.error('获取家属信息失败');
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  if (loading) {
    return <SkeletonPage />;
  }

  const pendingAlerts = recentAlerts.filter((a) => a.status === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Welcome banner */}
      <Card
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          overflow: 'hidden',
          position: 'relative',
          border: 'none',
        }}
      >
        <div style={{ padding: '28px 28px' }}>
          <div
            style={{
              position: 'absolute',
              top: -30,
              right: -20,
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -40,
              right: 60,
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
            }}
          />
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 6 }}>
            您好，{familyInfo?.real_name}
          </h2>
          <p style={{ fontSize: 15, opacity: 0.9, margin: 0 }}>
            您是 <strong>{familyInfo?.elder_name}</strong> 的{familyInfo?.relationship}，感谢您的关爱与陪伴
          </p>
        </div>
      </Card>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <StatCard
          title="健康状态"
          value={pendingAlerts > 0 ? '需关注' : '良好'}
          icon={<HeartPulse size={20} />}
          color={pendingAlerts > 0 ? '#f59e0b' : '#10b981'}
          loading={statsLoading}
        />
        <StatCard
          title="风险预警"
          value={alertsTotal}
          suffix="条"
          icon={<AlertTriangle size={20} />}
          color="#ef4444"
          loading={statsLoading}
        />
        <StatCard
          title="健康记录"
          value={healthTotal}
          suffix="条"
          icon={<ClipboardList size={20} />}
          color="#3b82f6"
          loading={statsLoading}
        />
        <StatCard
          title="最近体检"
          value={latestRecordDate || '暂无'}
          icon={<CalendarDays size={20} />}
          color="#8b5cf6"
          loading={statsLoading}
        />
      </div>

      {/* Elder basic info */}
      {elderInfo && (
        <Card>
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <HeartPulse size={20} color="var(--smc-error)" />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>老人基本信息</h3>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                }}
              >
                <InfoField icon={<User size={16} />} label="姓名" value={elderInfo.name} />
                <InfoField icon={<Users size={16} />} label="性别" value={elderInfo.gender} />
                {elderInfo.birth_date && (
                  <InfoField
                    icon={<Cake size={16} />}
                    label="出生日期"
                    value={elderInfo.birth_date}
                  />
                )}
                <InfoField icon={<Phone size={16} />} label="联系电话" value={elderInfo.phone} />
                <InfoField icon={<Home size={16} />} label="住址" value={elderInfo.address} />
                <InfoField
                  icon={<Contact size={16} />}
                  label="紧急联系人"
                  value={elderInfo.emergency_contact_name}
                />
                <InfoField
                  icon={<PhoneCall size={16} />}
                  label="紧急联系电话"
                  value={elderInfo.emergency_contact_phone}
                />
              </div>

              {elderInfo.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {elderInfo.tags.map((tag) => (
                    <Chip key={tag} tone="primary" style={{ fontWeight: 600 }}>
                      {tag}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Recent alerts preview */}
      <Card>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <BellRing size={20} color="#f59e0b" />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>最近预警</h3>
              </div>
              {alertsTotal > 0 && (
                <Button
                  size="sm"
                  variant="text"
                  onClick={() => navigate('/family/elder')}
                  endIcon={<ArrowRight size={14} />}
                >
                  查看全部
                </Button>
              )}
            </div>

            {statsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="smc-skel" style={{ height: 52, borderRadius: 16 }} />
                ))}
              </div>
            ) : recentAlerts.length === 0 ? (
              <div
                style={{
                  padding: '32px 0',
                  textAlign: 'center',
                  borderRadius: 16,
                  background: 'var(--smc-bg-2, #f8fafc)',
                  color: 'var(--smc-text-2)',
                }}
              >
                暂无预警信息，老人状态良好
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      borderRadius: 16,
                      background: 'var(--smc-bg-2, #f8fafc)',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: alertLevelColorMap[alert.level] || '#3b82f6',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {alert.message}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--smc-text-2)' }}>
                        {alert.alert_type} · {formatDateTime(alert.created_at)}
                      </div>
                    </div>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 11,
                        height: 22,
                        lineHeight: '22px',
                        padding: '0 8px',
                        borderRadius: 999,
                        background: `${alertLevelColorMap[alert.level] || '#3b82f6'}18`,
                        color: alertLevelColorMap[alert.level] || '#3b82f6',
                        flexShrink: 0,
                      }}
                    >
                      {alertLevelLabelMap[alert.level] || alert.level}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Health records CTA */}
      <Card
        hoverable
        onClick={() => navigate('/family/elder')}
        style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#fff',
          cursor: 'pointer',
          border: 'none',
        }}
      >
        <CardBody>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ClipboardList size={28} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>查看老人健康记录</div>
              <div style={{ fontSize: 14, marginTop: 4, opacity: 0.9 }}>
                查看最近的体征数据、血压心率变化和风险预警信息
              </div>
            </div>
            <ArrowRight size={24} style={{ opacity: 0.8 }} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default FamilyHomePage;
