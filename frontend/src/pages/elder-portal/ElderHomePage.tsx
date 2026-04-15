import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import { useAuthStore } from '../../store/auth';
import { getElderSelf, getElderHealthRecords } from '../../api/elderPortal';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
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
  created_at: string;
}

function FieldItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  );
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
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <FavoriteRoundedIcon color="error" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {profile?.name ? `${profile.name}，您好！` : '您好！'}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                以下是您的基础信息与最近健康记录。
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <FieldItem label="姓名" value={profile?.name || '-'} />
              <FieldItem
                label="性别"
                value={profile?.gender ? (genderMap[profile.gender] || profile.gender) : '-'}
              />
              <FieldItem label="出生日期" value={formatDate(profile?.birth_date)} />
              <FieldItem label="联系电话" value={profile?.phone || '-'} />
              <FieldItem label="住址" value={profile?.address || '-'} />
              <FieldItem label="紧急联系人" value={profile?.emergency_contact_name || '-'} />
              <FieldItem label="紧急联系电话" value={profile?.emergency_contact_phone || '-'} />
              <FieldItem
                label="标签"
                value={
                  profile?.tags && profile.tags.length > 0 ? (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {profile.tags.map((tag) => (
                        <Chip key={tag} color="primary" variant="outlined" label={tag} />
                      ))}
                    </Stack>
                  ) : (
                    '-'
                  )
                }
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
          近期健康记录
        </Typography>
        <AppTable<HealthRecord>
          columns={columns}
          dataSource={healthRecords}
          loading={recordsLoading}
          rowKey="id"
          pagination={false}
          emptyText="暂无健康记录"
        />
      </Box>
    </Stack>
  );
};

export default ElderHomePage;
