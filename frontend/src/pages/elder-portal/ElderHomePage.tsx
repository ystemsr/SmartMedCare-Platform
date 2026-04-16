import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import CakeRoundedIcon from '@mui/icons-material/CakeRounded';
import ContactPhoneRoundedIcon from '@mui/icons-material/ContactPhoneRounded';
import ContactEmergencyRoundedIcon from '@mui/icons-material/ContactEmergencyRounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import WcRoundedIcon from '@mui/icons-material/WcRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import BloodtypeRoundedIcon from '@mui/icons-material/BloodtypeRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import FolderSharedRoundedIcon from '@mui/icons-material/FolderSharedRounded';
import SentimentSatisfiedAltRoundedIcon from '@mui/icons-material/SentimentSatisfiedAltRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useAuthStore } from '../../store/auth';
import { getElderSelf, getElderHealthRecords } from '../../api/elderPortal';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import StatCard from '../../components/StatCard';
import { formatDate, formatDateTime } from '../../utils/formatter';
import dayjs from 'dayjs';

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
    <Box
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `${iconColor}14`,
          color: iconColor,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
          {label}
        </Typography>
        <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 600, fontSize: '1.05rem', wordBreak: 'break-word' }}>
          {value}
        </Typography>
      </Box>
    </Box>
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

  // Derive health summary from the latest record
  const latestRecord = healthRecords.length > 0 ? healthRecords[0] : null;

  const latestBP = latestRecord?.blood_pressure_systolic && latestRecord?.blood_pressure_diastolic
    ? `${latestRecord.blood_pressure_systolic}/${latestRecord.blood_pressure_diastolic}`
    : '--';

  const latestHR = latestRecord?.heart_rate != null
    ? String(latestRecord.heart_rate)
    : '--';

  const latestGlucose = latestRecord?.blood_glucose != null
    ? String(latestRecord.blood_glucose)
    : '--';

  const columns = useMemo<AppTableColumn<HealthRecord>[]>(() => [
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
  ], []);

  if (profileLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size={44} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" variant="filled" sx={{ alignItems: 'center' }}>
        {error}
      </Alert>
    );
  }

  return (
    <Stack spacing={3.5}>
      {/* Welcome Banner */}
      <Card
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <CardContent sx={{ py: { xs: 3.5, sm: 4 }, px: { xs: 3, sm: 4 } }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <SentimentSatisfiedAltRoundedIcon sx={{ fontSize: 48, opacity: 0.9 }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.35rem', sm: '1.6rem' } }}>
                {profile?.name ? `${profile.name}，${getGreetingByTime()}！` : `${getGreetingByTime()}！`}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mt: 0.5, opacity: 0.85, fontSize: { xs: '0.95rem', sm: '1.05rem' } }}
              >
                {dayjs().format('YYYY年M月D日 dddd')} &mdash; 祝您身体健康，心情愉快！
              </Typography>
            </Box>
          </Stack>
          {/* Decorative circles */}
          <Box
            sx={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 120,
              height: 120,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.08)',
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -20,
              right: 60,
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }}
          />
        </CardContent>
      </Card>

      {/* Health Summary Stat Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(4, 1fr)',
          },
          gap: 2.5,
        }}
      >
        <StatCard
          title="血压"
          value={latestBP}
          suffix="mmHg"
          icon={<BloodtypeRoundedIcon />}
          color="#ef5350"
          loading={recordsLoading}
        />
        <StatCard
          title="心率"
          value={latestHR}
          suffix="bpm"
          icon={<MonitorHeartRoundedIcon />}
          color="#ec407a"
          loading={recordsLoading}
        />
        <StatCard
          title="血糖"
          value={latestGlucose}
          suffix="mmol/L"
          icon={<WaterDropRoundedIcon />}
          color="#ab47bc"
          loading={recordsLoading}
        />
        <StatCard
          title="健康记录"
          value={healthRecords.length}
          suffix="条"
          icon={<FolderSharedRoundedIcon />}
          color="#5c6bc0"
          loading={recordsLoading}
        />
      </Box>

      {/* Profile Info */}
      <Card sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <FavoriteRoundedIcon sx={{ color: '#ef5350' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.15rem' }}>
                个人基础信息
              </Typography>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <FieldItem
                label="姓名"
                value={profile?.name || '-'}
                icon={<PersonRoundedIcon fontSize="small" />}
                iconColor="#5c6bc0"
              />
              <FieldItem
                label="性别"
                value={profile?.gender ? (genderMap[profile.gender] || profile.gender) : '-'}
                icon={<WcRoundedIcon fontSize="small" />}
                iconColor="#26a69a"
              />
              <FieldItem
                label="出生日期"
                value={formatDate(profile?.birth_date)}
                icon={<CakeRoundedIcon fontSize="small" />}
                iconColor="#ffa726"
              />
              <FieldItem
                label="联系电话"
                value={profile?.phone || '-'}
                icon={<PhoneRoundedIcon fontSize="small" />}
                iconColor="#42a5f5"
              />
              <FieldItem
                label="住址"
                value={profile?.address || '-'}
                icon={<HomeRoundedIcon fontSize="small" />}
                iconColor="#66bb6a"
              />
              <FieldItem
                label="紧急联系人"
                value={profile?.emergency_contact_name || '-'}
                icon={<ContactEmergencyRoundedIcon fontSize="small" />}
                iconColor="#ef5350"
              />
              <FieldItem
                label="紧急联系电话"
                value={profile?.emergency_contact_phone || '-'}
                icon={<ContactPhoneRoundedIcon fontSize="small" />}
                iconColor="#ef5350"
              />
              <FieldItem
                label="标签"
                value={
                  profile?.tags && profile.tags.length > 0 ? (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {profile.tags.map((tag) => (
                        <Chip key={tag} color="primary" variant="outlined" label={tag} size="small" />
                      ))}
                    </Stack>
                  ) : (
                    '-'
                  )
                }
                icon={<LocalOfferRoundedIcon fontSize="small" />}
                iconColor="#ab47bc"
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Health Records */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.15rem' }}>
            近期健康记录
          </Typography>
          {healthRecords.length > 0 && (
            <Button
              size="small"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ fontSize: '0.9rem' }}
            >
              查看更多
            </Button>
          )}
        </Stack>
        <AppTable<HealthRecord>
          columns={columns}
          dataSource={healthRecords}
          loading={recordsLoading}
          rowKey="id"
          pagination={false}
          emptyText="暂无健康记录，请等待医护人员录入"
        />
      </Box>
    </Stack>
  );
};

export default ElderHomePage;
