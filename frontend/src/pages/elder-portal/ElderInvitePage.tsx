import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Plus, Trash2, UserPlus } from 'lucide-react';
import { Alert, Button, Card, CardBody, Chip, Modal, Spinner } from '@/components/ui';
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

  const familyColumns = useMemo<AppTableColumn<FamilyMember>[]>(
    () => [
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
    ],
    [],
  );

  if (!elderId) {
    return (
      <Alert severity="warning" variant="filled">
        未找到关联的老人信息，请联系管理员。
      </Alert>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Card style={{ borderRadius: 18 }}>
        <CardBody style={{ padding: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <UserPlus size={22} style={{ color: '#5c6bc0' }} />
                <div
                  style={{ fontWeight: 700, fontSize: 18, color: 'var(--smc-text)' }}
                >
                  邀请家属
                </div>
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 15,
                  color: 'var(--smc-text-2)',
                  lineHeight: 1.8,
                }}
              >
                您可以生成一个邀请码，将其分享给您的家属。家属使用邀请码注册后，即可在手机上查看您的健康信息。每位老人最多可绑定{' '}
                <strong>{MAX_FAMILY_MEMBERS}</strong> 位家属。
              </div>
            </div>

            {codeLoading ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '32px 0',
                }}
              >
                <Spinner />
              </div>
            ) : inviteCode ? (
              <div
                style={{
                  padding: 24,
                  borderRadius: 12,
                  border: '1px solid var(--smc-border)',
                  background: 'var(--smc-surface-alt)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, color: 'var(--smc-text-2)' }}>
                      当前邀请码
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontWeight: 800,
                        fontSize: 32,
                        letterSpacing: 3,
                        wordBreak: 'break-all',
                        color: 'var(--smc-text)',
                      }}
                    >
                      {inviteCode.code}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip outlined>过期时间：{inviteCode.expires_at}</Chip>
                    <Chip
                      tone={
                        inviteCode.used_count >= inviteCode.max_uses
                          ? 'error'
                          : 'primary'
                      }
                    >
                      已使用 {inviteCode.used_count}/{inviteCode.max_uses}
                    </Chip>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Copy size={16} />}
                      onClick={handleCopyLink}
                    >
                      复制邀请链接
                    </Button>
                    <Button
                      variant="danger"
                      startIcon={<Trash2 size={16} />}
                      disabled={actionLoading}
                      onClick={handleRevoke}
                    >
                      撤销邀请码
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 14, color: 'var(--smc-text-2)' }}>
                  暂无有效邀请码
                </div>
                <div style={{ marginTop: 16, display: 'inline-block' }}>
                  <Button
                    variant="primary"
                    startIcon={<Plus size={16} />}
                    disabled={actionLoading}
                    onClick={handleGenerate}
                  >
                    生成邀请码
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <div>
        <div
          style={{
            fontWeight: 700,
            fontSize: 18,
            marginBottom: 16,
            color: 'var(--smc-text)',
          }}
        >
          已绑定家属
        </div>
        <AppTable<FamilyMember>
          columns={familyColumns}
          dataSource={familyMembers}
          loading={familyLoading}
          rowKey="id"
          pagination={false}
          emptyText="暂无绑定家属"
        />
        {error && (
          <div style={{ marginTop: 16 }}>
            <Alert severity="error">{error}</Alert>
          </div>
        )}
      </div>

      <Modal
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        title="确认撤销"
        width={420}
        footer={
          <>
            <Button variant="outlined" onClick={() => setRevokeOpen(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmRevoke}
              disabled={actionLoading}
            >
              确认撤销
            </Button>
          </>
        }
      >
        <div style={{ color: 'var(--smc-text-2)', lineHeight: 1.6 }}>
          撤销后，当前邀请码将立即失效，已绑定的家属不受影响。
        </div>
      </Modal>
    </div>
  );
};

export default ElderInvitePage;
