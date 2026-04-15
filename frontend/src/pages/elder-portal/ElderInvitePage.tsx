import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useAuthStore } from '../../store/auth';
import {
  getInviteCode,
  generateInviteCode,
  revokeInviteCode,
  getElderFamily,
} from '../../api/elderPortal';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import { formatDateTime } from '../../utils/formatter';
import { message } from '../../utils/message';

interface InviteCode {
  code: string;
  expires_at: string;
  used_count: number;
  max_uses: number;
}

interface FamilyMember {
  id: number;
  real_name: string;
  relationship: string;
  created_at: string;
}

const MAX_FAMILY_MEMBERS = 3;

const ElderInvitePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const elderId = user?.elder_id;

  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [codeLoading, setCodeLoading] = useState(true);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const fetchInviteCode = useCallback(async () => {
    if (!elderId) return;
    setCodeLoading(true);
    try {
      const res = await getInviteCode(elderId);
      setInviteCode(res.data || null);
    } catch {
      setInviteCode(null);
    } finally {
      setCodeLoading(false);
    }
  }, [elderId]);

  const fetchFamily = useCallback(async () => {
    setFamilyLoading(true);
    try {
      const res = await getElderFamily();
      setFamilyMembers(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取家属列表失败');
    } finally {
      setFamilyLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInviteCode();
    void fetchFamily();
  }, [fetchInviteCode, fetchFamily]);

  const handleGenerate = async () => {
    if (!elderId) return;
    setActionLoading(true);
    try {
      await generateInviteCode(elderId);
      message.success('邀请码已生成');
      await fetchInviteCode();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '生成邀请码失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = () => {
    if (!elderId) return;
    setRevokeOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!elderId) return;
    setActionLoading(true);
    try {
      await revokeInviteCode(elderId);
      message.success('邀请码已撤销');
      setInviteCode(null);
      setRevokeOpen(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '撤销邀请码失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteCode) return;
    const link = `${window.location.origin}/register/family?code=${inviteCode.code}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        message.success('邀请链接已复制到剪贴板');
      })
      .catch(() => {
        message.error('复制失败，请手动复制');
      });
  };

  const familyColumns = useMemo<AppTableColumn<FamilyMember>[]>(() => [
    {
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
    },
    {
      title: '关系',
      dataIndex: 'relationship',
      key: 'relationship',
    },
    {
      title: '绑定时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value) => formatDateTime(value as string | undefined),
    },
  ], []);

  if (!elderId) {
    return (
      <Alert severity="warning" variant="filled" icon={<WarningAmberRoundedIcon />}>
        未找到关联的老人信息，请联系管理员。
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                邀请家属
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                生成邀请码分享给家属，家属可通过邀请码注册并绑定账号。每位老人最多绑定 {MAX_FAMILY_MEMBERS} 位家属。
              </Typography>
            </Box>

            {codeLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : inviteCode ? (
              <Box
                sx={{
                  p: { xs: 2.5, sm: 3 },
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                }}
              >
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      当前邀请码
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{ mt: 1, fontWeight: 800, letterSpacing: 3, wordBreak: 'break-all' }}
                    >
                      {inviteCode.code}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip variant="outlined" label={`过期时间：${inviteCode.expires_at}`} />
                    <Chip
                      color={inviteCode.used_count >= inviteCode.max_uses ? 'error' : 'primary'}
                      label={`已使用 ${inviteCode.used_count}/${inviteCode.max_uses}`}
                    />
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <Button
                      variant="outlined"
                      startIcon={<ContentCopyRoundedIcon />}
                      onClick={handleCopyLink}
                    >
                      复制邀请链接
                    </Button>
                    <Button
                      color="error"
                      variant="contained"
                      startIcon={<DeleteOutlineRoundedIcon />}
                      disabled={actionLoading}
                      onClick={handleRevoke}
                    >
                      撤销邀请码
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  暂无有效邀请码
                </Typography>
                <Button
                  sx={{ mt: 2 }}
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  disabled={actionLoading}
                  onClick={handleGenerate}
                >
                  生成邀请码
                </Button>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
          已绑定家属
        </Typography>
        <AppTable<FamilyMember>
          columns={familyColumns}
          dataSource={familyMembers}
          loading={familyLoading}
          rowKey="id"
          pagination={false}
          emptyText="暂无绑定家属"
        />
        {error && (
          <Alert severity="error" variant="outlined" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>

      <Dialog open={revokeOpen} onClose={() => setRevokeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>确认撤销</DialogTitle>
        <DialogContent>
          <DialogContentText>
            撤销后，当前邀请码将立即失效，已绑定的家属不受影响。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setRevokeOpen(false)} color="inherit">
            取消
          </Button>
          <Button onClick={handleConfirmRevoke} color="error" variant="contained" disabled={actionLoading}>
            确认撤销
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default ElderInvitePage;
