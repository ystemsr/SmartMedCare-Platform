import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { getElderDetail, getHealthRecords, getMedicalRecords, getCareRecords } from '../../api/elders';
import { formatGender, formatDate, formatDateTime } from '../../utils/formatter';
import { message } from '../../utils/message';
import type { Elder, HealthRecord, MedicalRecord, CareRecord } from '../../types/elder';

interface TimelineEntry {
  time: string;
  type: 'health' | 'medical' | 'care';
  label: string;
  content: string;
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card variant="outlined" sx={{ flex: 1 }}>
      <Box sx={{ p: 2.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="h4" sx={{ color, fontWeight: 700 }}>
          {value}
        </Typography>
      </Box>
    </Card>
  );
}

const ElderArchivePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const elderId = Number(id);

  const [elder, setElder] = useState<Elder | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [stats, setStats] = useState({ health: 0, medical: 0, care: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [elderRes, healthRes, medicalRes, careRes] = await Promise.all([
        getElderDetail(elderId),
        getHealthRecords(elderId, { page_size: 100 }),
        getMedicalRecords(elderId, { page_size: 100 }),
        getCareRecords(elderId, { page_size: 100 }),
      ]);

      setElder(elderRes.data);
      setStats({
        health: healthRes.data.total,
        medical: medicalRes.data.total,
        care: careRes.data.total,
      });

      const entries: TimelineEntry[] = [];
      healthRes.data.items.forEach((record: HealthRecord) => {
        entries.push({
          time: record.recorded_at,
          type: 'health',
          label: '健康记录',
          content: `血压 ${record.blood_pressure_systolic || '-'}/${record.blood_pressure_diastolic || '-'}，心率 ${record.heart_rate || '-'}，血糖 ${record.blood_glucose || '-'}`,
        });
      });
      medicalRes.data.items.forEach((record: MedicalRecord) => {
        entries.push({
          time: record.visit_date,
          type: 'medical',
          label: '医疗记录',
          content: `${record.hospital_name} ${record.department} - ${record.diagnosis}`,
        });
      });
      careRes.data.items.forEach((record: CareRecord) => {
        entries.push({
          time: record.care_date,
          type: 'care',
          label: '照护记录',
          content: `${record.caregiver_name}: ${record.content}`,
        });
      });

      entries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setTimeline(entries);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [elderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const typeColorMap = useMemo<Record<string, string>>(
    () => ({
      health: '#1f6feb',
      medical: '#1f9d63',
      care: '#d9822b',
    }),
    [],
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size={36} />
      </Box>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Button
        variant="text"
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate(-1)}
        sx={{ alignSelf: 'flex-start' }}
      >
        返回
      </Button>

      <Card>
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            {elder?.name || ''} - 健康档案
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                姓名
              </Typography>
              <Typography variant="body2">{elder?.name || '-'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                性别
              </Typography>
              <Typography variant="body2">{formatGender(elder?.gender)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                出生日期
              </Typography>
              <Typography variant="body2">{formatDate(elder?.birth_date)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                联系电话
              </Typography>
              <Typography variant="body2">{elder?.phone || '-'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                地址
              </Typography>
              <Typography variant="body2">{elder?.address || '-'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                标签
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                {elder?.tags?.length ? (
                  elder.tags.map((tag) => (
                    <Chip key={tag} label={tag} color="primary" variant="outlined" size="small" />
                  ))
                ) : (
                  <Typography variant="body2">-</Typography>
                )}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Card>

      <Card>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            统计概览
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <StatCard label="健康记录数" value={stats.health} color="#1f6feb" />
            <StatCard label="医疗记录数" value={stats.medical} color="#1f9d63" />
            <StatCard label="照护记录数" value={stats.care} color="#d9822b" />
          </Stack>
        </Box>
      </Card>

      <Card>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            时间线
          </Typography>
          <Stack spacing={2}>
            {timeline.length ? (
              timeline.map((entry, index) => (
                <Box key={`${entry.type}-${entry.time}-${index}`} sx={{ display: 'flex', gap: 2 }}>
                  <Box
                    sx={{
                      width: 12,
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        mt: 0.8,
                        backgroundColor: typeColorMap[entry.type],
                        boxShadow: `0 0 0 6px ${typeColorMap[entry.type]}22`,
                      }}
                    />
                  </Box>
                  <Box sx={{ flex: 1, pb: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip
                        label={entry.label}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: typeColorMap[entry.type], color: typeColorMap[entry.type] }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(entry.time)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2">{entry.content}</Typography>
                    {index < timeline.length - 1 && <Divider sx={{ mt: 2 }} />}
                  </Box>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                暂无记录
              </Typography>
            )}
          </Stack>
        </Box>
      </Card>
    </Stack>
  );
};

export default ElderArchivePage;
