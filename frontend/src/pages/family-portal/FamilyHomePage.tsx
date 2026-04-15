import React, { useEffect, useState } from 'react';
import {
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
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useNavigate } from 'react-router-dom';
import { getFamilySelf, getFamilyElder } from '../../api/family';
import type { FamilyMemberInfo, FamilyElderInfo } from '../../types/family';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
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

const FamilyHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [familyInfo, setFamilyInfo] = useState<FamilyMemberInfo | null>(null);
  const [elderInfo, setElderInfo] = useState<FamilyElderInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [selfRes, elderRes] = await Promise.all([getFamilySelf(), getFamilyElder()]);
        setFamilyInfo(selfRes.data as FamilyMemberInfo);
        setElderInfo(elderRes.data as FamilyElderInfo);
      } catch {
        // Error is handled by the http interceptor
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size={44} />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              您好，{familyInfo?.real_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              关系：{familyInfo?.relationship} | 关联老人：{familyInfo?.elder_name}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

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
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                <InfoRow label="姓名" value={elderInfo.name} />
                <InfoRow label="性别" value={elderInfo.gender} />
                {elderInfo.birth_date && <InfoRow label="出生日期" value={elderInfo.birth_date} />}
                <InfoRow
                  label="联系电话"
                  value={
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <PhoneRoundedIcon fontSize="small" />
                      <span>{elderInfo.phone}</span>
                    </Stack>
                  }
                />
                <InfoRow
                  label="住址"
                  value={
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <HomeRoundedIcon fontSize="small" />
                      <span>{elderInfo.address}</span>
                    </Stack>
                  }
                />
                <InfoRow label="紧急联系人" value={elderInfo.emergency_contact_name} />
                <InfoRow label="紧急联系电话" value={elderInfo.emergency_contact_phone} />
              </Box>

              {elderInfo.tags.length > 0 && (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {elderInfo.tags.map((tag) => (
                    <Chip key={tag} color="primary" variant="outlined" label={tag} />
                  ))}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                查看老人健康记录
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                进入健康页查看最近的体征数据和预警信息。
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<ArrowForwardRoundedIcon />}
              onClick={() => navigate('/family/elder')}
            >
              打开健康页
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default FamilyHomePage;
