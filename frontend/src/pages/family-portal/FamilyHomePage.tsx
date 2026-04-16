import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import WcRoundedIcon from '@mui/icons-material/WcRounded';
import CakeRoundedIcon from '@mui/icons-material/CakeRounded';
import ContactEmergencyRoundedIcon from '@mui/icons-material/ContactEmergencyRounded';
import LocalPhoneRoundedIcon from '@mui/icons-material/LocalPhoneRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import CircleIcon from '@mui/icons-material/Circle';
import { useNavigate } from 'react-router-dom';
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
    <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.default' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
        <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>{icon}</Box>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Stack>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, pl: 0.25 }}>
        {value || '-'}
      </Typography>
    </Box>
  );
}

function SkeletonPage() {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={100} sx={{ borderRadius: 3 }} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
      <Skeleton variant="rounded" height={200} sx={{ borderRadius: 3 }} />
    </Stack>
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
    <Stack spacing={3}>
      {/* Welcome banner */}
      <Card
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <CardContent sx={{ py: 3.5, px: 3.5 }}>
          <Box
            sx={{
              position: 'absolute',
              top: -30,
              right: -20,
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -40,
              right: 60,
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
            }}
          />
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.75 }}>
            您好，{familyInfo?.real_name}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            您是 <strong>{familyInfo?.elder_name}</strong> 的{familyInfo?.relationship}，感谢您的关爱与陪伴
          </Typography>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        <StatCard
          title="健康状态"
          value={pendingAlerts > 0 ? '需关注' : '良好'}
          icon={<FavoriteRoundedIcon />}
          color={pendingAlerts > 0 ? '#f59e0b' : '#10b981'}
          loading={statsLoading}
        />
        <StatCard
          title="风险预警"
          value={alertsTotal}
          suffix="条"
          icon={<WarningAmberRoundedIcon />}
          color="#ef4444"
          loading={statsLoading}
        />
        <StatCard
          title="健康记录"
          value={healthTotal}
          suffix="条"
          icon={<AssignmentRoundedIcon />}
          color="#3b82f6"
          loading={statsLoading}
        />
        <StatCard
          title="最近体检"
          value={latestRecordDate || '暂无'}
          icon={<EventNoteRoundedIcon />}
          color="#8b5cf6"
          loading={statsLoading}
        />
      </Box>

      {/* Elder basic info */}
      {elderInfo && (
        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <FavoriteRoundedIcon color="error" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  老人基本信息
                </Typography>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(3, minmax(0, 1fr))',
                  },
                  gap: 2,
                }}
              >
                <InfoField
                  icon={<PersonRoundedIcon fontSize="small" />}
                  label="姓名"
                  value={elderInfo.name}
                />
                <InfoField
                  icon={<WcRoundedIcon fontSize="small" />}
                  label="性别"
                  value={elderInfo.gender}
                />
                {elderInfo.birth_date && (
                  <InfoField
                    icon={<CakeRoundedIcon fontSize="small" />}
                    label="出生日期"
                    value={elderInfo.birth_date}
                  />
                )}
                <InfoField
                  icon={<PhoneRoundedIcon fontSize="small" />}
                  label="联系电话"
                  value={elderInfo.phone}
                />
                <InfoField
                  icon={<HomeRoundedIcon fontSize="small" />}
                  label="住址"
                  value={elderInfo.address}
                />
                <InfoField
                  icon={<ContactEmergencyRoundedIcon fontSize="small" />}
                  label="紧急联系人"
                  value={elderInfo.emergency_contact_name}
                />
                <InfoField
                  icon={<LocalPhoneRoundedIcon fontSize="small" />}
                  label="紧急联系电话"
                  value={elderInfo.emergency_contact_phone}
                />
              </Box>

              {elderInfo.tags.length > 0 && (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {elderInfo.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        bgcolor: 'primary.main',
                        color: '#fff',
                        '&:hover': { bgcolor: 'primary.dark' },
                      }}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Recent alerts preview */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <NotificationsActiveRoundedIcon sx={{ color: '#f59e0b' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  最近预警
                </Typography>
              </Stack>
              {alertsTotal > 0 && (
                <Button
                  size="small"
                  onClick={() => navigate('/family/elder')}
                  endIcon={<ArrowForwardRoundedIcon />}
                >
                  查看全部
                </Button>
              )}
            </Stack>

            {statsLoading ? (
              <Stack spacing={1.5}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={52} sx={{ borderRadius: 2 }} />
                ))}
              </Stack>
            ) : recentAlerts.length === 0 ? (
              <Box
                sx={{
                  py: 4,
                  textAlign: 'center',
                  borderRadius: 2,
                  bgcolor: 'background.default',
                }}
              >
                <Typography color="text.secondary">暂无预警信息，老人状态良好</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {recentAlerts.slice(0, 5).map((alert) => (
                  <Box
                    key={alert.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'background.default',
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <CircleIcon
                      sx={{
                        fontSize: 10,
                        color: alertLevelColorMap[alert.level] || '#3b82f6',
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {alert.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {alert.alert_type} &middot; {formatDateTime(alert.created_at)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={alertLevelLabelMap[alert.level] || alert.level}
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 22,
                        bgcolor: `${alertLevelColorMap[alert.level] || '#3b82f6'}18`,
                        color: alertLevelColorMap[alert.level] || '#3b82f6',
                        flexShrink: 0,
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Health records CTA */}
      <Card
        sx={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#fff',
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
          },
        }}
        onClick={() => navigate('/family/elder')}
      >
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={2}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AssignmentRoundedIcon sx={{ fontSize: 32 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                查看老人健康记录
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
                查看最近的体征数据、血压心率变化和风险预警信息
              </Typography>
            </Box>
            <ArrowForwardRoundedIcon sx={{ fontSize: 28, opacity: 0.8 }} />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default FamilyHomePage;
