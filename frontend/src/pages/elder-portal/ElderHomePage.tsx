import React, { useEffect, useMemo, useState } from 'react';
import {
  Heart,
  Phone,
  Home,
  User,
  Cake,
  PhoneCall,
  ShieldAlert,
  Tag,
  Users,
  Activity,
  Droplet,
  Droplets,
  FolderHeart,
  Smile,
  ArrowRight,
} from 'lucide-react';
import dayjs from 'dayjs';
import { Alert, Button, Card, CardBody, Chip, Spinner } from '@/components/ui';
import { useAuthStore } from '../../store/auth';
import { getElderSelf, getElderHealthRecords } from '../../api/elderPortal';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import StatCard from '../../components/StatCard';
import { formatDate, formatDateTime } from '../../utils/formatter';

interface ElderProfile {
  id: number;
  name: string;
  gender: string;
  birth_date: string;
  phone: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  tags: string[];
}

interface HealthRecord {
  id: number;
  record_date: string;
  record_type: string;
  summary: string;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  blood_glucose?: number;
  created_at: string;
}

interface FieldItemProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconColor: string;
}

function FieldItem({ label, value, icon, iconColor }: FieldItemProps) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 12,
        background: 'var(--smc-surface-alt)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${iconColor}14`,
          color: iconColor,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, color: 'var(--smc-text-2)' }}>{label}</div>
        <div
          style={{
            marginTop: 4,
            fontWeight: 600,
            fontSize: 17,
            wordBreak: 'break-word',
            color: 'var(--smc-text)',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function getGreetingByTime(): string {
  const hour = dayjs().hour();
  if (hour < 6) return '夜深了，注意休息';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

const ElderHomePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const res = await getElderSelf();
        setProfile(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取个人信息失败');
      } finally {
        setProfileLoading(false);
      }
    };
    void fetchProfile();
  }, []);

  useEffect(() => {
    const elderId = user?.elder_id;
    if (!elderId) return;

    const fetchRecords = async () => {
      setRecordsLoading(true);
      try {
        const res = await getElderHealthRecords(elderId, { page: 1, page_size: 5 });
        setHealthRecords(res.data?.items || []);
      } catch {
        // Profile section is more important; keep the page usable.
      } finally {
        setRecordsLoading(false);
      }
    };
    void fetchRecords();
  }, [user?.elder_id]);

  const genderMap: Record<string, string> = {
    male: '男',
    female: '女',
    M: '男',
    F: '女',
  };

  const latestRecord = healthRecords.length > 0 ? healthRecords[0] : null;

  const latestBP =
    latestRecord?.blood_pressure_systolic && latestRecord?.blood_pressure_diastolic
      ? `${latestRecord.blood_pressure_systolic}/${latestRecord.blood_pressure_diastolic}`
      : '--';

  const latestHR =
    latestRecord?.heart_rate != null ? String(latestRecord.heart_rate) : '--';

  const latestGlucose =
    latestRecord?.blood_glucose != null ? String(latestRecord.blood_glucose) : '--';

  const columns = useMemo<AppTableColumn<HealthRecord>[]>(
    () => [
      {
        title: '记录日期',
        dataIndex: 'record_date',
        key: 'record_date',
        width: 120,
        render: (value) => formatDate(value as string | undefined),
      },
      {
        title: '类型',
        dataIndex: 'record_type',
        key: 'record_type',
        width: 120,
      },
      {
        title: '血压',
        dataIndex: 'blood_pressure_systolic',
        key: 'blood_pressure',
        width: 120,
        render: (_value, record) => {
          if (record.blood_pressure_systolic && record.blood_pressure_diastolic) {
            return `${record.blood_pressure_systolic}/${record.blood_pressure_diastolic}`;
          }
          return '-';
        },
      },
      {
        title: '心率',
        dataIndex: 'heart_rate',
        key: 'heart_rate',
        width: 100,
        render: (value) => (value != null ? `${value} bpm` : '-'),
      },
      {
        title: '血糖',
        dataIndex: 'blood_glucose',
        key: 'blood_glucose',
        width: 100,
        render: (value) => (value != null ? `${value} mmol/L` : '-'),
      },
      {
        title: '摘要',
        dataIndex: 'summary',
        key: 'summary',
        ellipsis: true,
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        render: (value) => formatDateTime(value as string | undefined),
      },
    ],
    [],
  );

  if (profileLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Alert severity="error" variant="filled">
        {error}
      </Alert>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Welcome Banner */}
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
        <CardBody style={{ padding: '32px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Smile size={48} style={{ opacity: 0.9, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 24, lineHeight: 1.2 }}>
                {profile?.name
                  ? `${profile.name}，${getGreetingByTime()}！`
                  : `${getGreetingByTime()}！`}
              </div>
              <div style={{ marginTop: 6, opacity: 0.85, fontSize: 16 }}>
                {dayjs().format('YYYY年M月D日 dddd')} &mdash; 祝您身体健康，心情愉快！
              </div>
            </div>
          </div>
          {/* Decorative circles */}
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
          <div
            style={{
              position: 'absolute',
              bottom: -20,
              right: 60,
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }}
          />
        </CardBody>
      </Card>

      {/* Health Summary Stat Cards */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4"
        style={{ display: 'grid', gap: 20 }}
      >
        <StatCard
          title="血压"
          value={latestBP}
          suffix="mmHg"
          icon={<Droplet size={24} />}
          color="#ef5350"
          loading={recordsLoading}
        />
        <StatCard
          title="心率"
          value={latestHR}
          suffix="bpm"
          icon={<Activity size={24} />}
          color="#ec407a"
          loading={recordsLoading}
        />
        <StatCard
          title="血糖"
          value={latestGlucose}
          suffix="mmol/L"
          icon={<Droplets size={24} />}
          color="#ab47bc"
          loading={recordsLoading}
        />
        <StatCard
          title="健康记录"
          value={healthRecords.length}
          suffix="条"
          icon={<FolderHeart size={24} />}
          color="#5c6bc0"
          loading={recordsLoading}
        />
      </div>

      {/* Profile Info */}
      <Card style={{ borderRadius: 18 }}>
        <CardBody style={{ padding: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Heart size={22} style={{ color: '#ef5350' }} />
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--smc-text)' }}>
                个人基础信息
              </div>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2"
              style={{ display: 'grid', gap: 16 }}
            >
              <FieldItem
                label="姓名"
                value={profile?.name || '-'}
                icon={<User size={18} />}
                iconColor="#5c6bc0"
              />
              <FieldItem
                label="性别"
                value={
                  profile?.gender ? genderMap[profile.gender] || profile.gender : '-'
                }
                icon={<Users size={18} />}
                iconColor="#26a69a"
              />
              <FieldItem
                label="出生日期"
                value={formatDate(profile?.birth_date)}
                icon={<Cake size={18} />}
                iconColor="#ffa726"
              />
              <FieldItem
                label="联系电话"
                value={profile?.phone || '-'}
                icon={<Phone size={18} />}
                iconColor="#42a5f5"
              />
              <FieldItem
                label="住址"
                value={profile?.address || '-'}
                icon={<Home size={18} />}
                iconColor="#66bb6a"
              />
              <FieldItem
                label="紧急联系人"
                value={profile?.emergency_contact_name || '-'}
                icon={<ShieldAlert size={18} />}
                iconColor="#ef5350"
              />
              <FieldItem
                label="紧急联系电话"
                value={profile?.emergency_contact_phone || '-'}
                icon={<PhoneCall size={18} />}
                iconColor="#ef5350"
              />
              <FieldItem
                label="标签"
                value={
                  profile?.tags && profile.tags.length > 0 ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {profile.tags.map((tag) => (
                        <Chip key={tag} tone="primary" outlined>
                          {tag}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    '-'
                  )
                }
                icon={<Tag size={18} />}
                iconColor="#ab47bc"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Health Records */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--smc-text)' }}>
            近期健康记录
          </div>
          {healthRecords.length > 0 && (
            <Button
              size="sm"
              variant="text"
              endIcon={<ArrowRight size={16} />}
            >
              查看更多
            </Button>
          )}
        </div>
        <AppTable<HealthRecord>
          columns={columns}
          dataSource={healthRecords}
          loading={recordsLoading}
          rowKey="id"
          pagination={false}
          emptyText="暂无健康记录，请等待医护人员录入"
        />
      </div>
    </div>
  );
};

export default ElderHomePage;
