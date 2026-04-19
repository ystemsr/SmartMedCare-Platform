import React, { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  Plus,
  Trash2,
  UserPlus,
  Share2,
  QrCode,
  Users,
  Phone,
  Calendar,
  Heart,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { Alert, Button, Card, CardBody, Chip, Modal, Spinner } from '@/components/ui';
import { useAuthStore } from '../../store/auth';
import {
  getInviteCode,
  generateInviteCode,
  revokeInviteCode,
  getElderFamily,
} from '../../api/elderPortal';
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
  user_id: number;
  username?: string | null;
  real_name?: string | null;
  phone?: string | null;
  relationship: string;
  created_at: string;
}

const MAX_FAMILY_MEMBERS = 3;

const RELATIONSHIP_LABEL: Record<string, string> = {
  son: '儿子',
  daughter: '女儿',
  spouse: '配偶',
  grandson: '孙子',
  granddaughter: '孙女',
  other: '其他亲属',
};

const RELATIONSHIP_COLOR: Record<string, string> = {
  son: '#1f6feb',
  daughter: '#ec407a',
  spouse: '#d14343',
  grandson: '#1f9d63',
  granddaughter: '#9c27b0',
  other: '#64748b',
};

function relationshipLabel(value: string): string {
  return RELATIONSHIP_LABEL[value] || value || '亲属';
}

function relationshipColor(value: string): string {
  return RELATIONSHIP_COLOR[value] || '#1f6feb';
}

function maskPhone(phone?: string | null): string {
  if (!phone) return '-';
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function displayName(member: FamilyMember): string {
  return member.real_name || member.username || `家属#${member.user_id}`;
}

interface StepCardProps {
  index: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  active?: boolean;
}

function StepCard({ index, icon, title, description, active }: StepCardProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 220,
        padding: 20,
        borderRadius: 14,
        border: `1px solid ${active ? 'var(--smc-primary)' : 'var(--smc-border)'}`,
        background: active ? 'var(--smc-primary-50, rgba(31,111,235,0.06))' : 'var(--smc-surface)',
        transition: 'border-color .2s ease, background .2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: active ? 'var(--smc-primary)' : 'var(--smc-surface-alt)',
            color: active ? '#fff' : 'var(--smc-text-2)',
            fontWeight: 700,
            border: `1px solid ${active ? 'var(--smc-primary)' : 'var(--smc-border)'}`,
          }}
        >
          {index}
        </div>
        <div style={{ color: active ? 'var(--smc-primary)' : 'var(--smc-text-2)', display: 'flex' }}>
          {icon}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--smc-text)' }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 14, color: 'var(--smc-text-2)', lineHeight: 1.7 }}>
        {description}
      </div>
    </div>
  );
}

interface FamilyCardProps {
  member: FamilyMember;
}

function FamilyCard({ member }: FamilyCardProps) {
  const name = displayName(member);
  const initials = name.slice(0, 1);
  const color = relationshipColor(member.relationship);
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 14,
        border: '1px solid var(--smc-border)',
        background: 'var(--smc-surface)',
        transition: 'border-color .2s ease, box-shadow .2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--smc-primary)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(31,111,235,0.10)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--smc-border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: color,
            color: '#fff',
            fontWeight: 700,
            fontSize: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 17,
                color: 'var(--smc-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
                background: `${color}1A`,
                color,
              }}
            >
              {relationshipLabel(member.relationship)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--smc-text-2)',
              fontSize: 14,
            }}
          >
            <Phone size={14} />
            <span>{maskPhone(member.phone)}</span>
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--smc-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--smc-text-3)',
          fontSize: 13,
        }}
      >
        <Calendar size={14} />
        <span>绑定于 {formatDateTime(member.created_at)}</span>
      </div>
    </div>
  );
}

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

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard
      .writeText(inviteCode.code)
      .then(() => message.success('邀请码已复制'))
      .catch(() => message.error('复制失败，请手动复制'));
  };

  const handleCopyLink = () => {
    if (!inviteCode) return;
    const link = `${window.location.origin}/register/family?code=${inviteCode.code}`;
    navigator.clipboard
      .writeText(link)
      .then(() => message.success('邀请链接已复制到剪贴板'))
      .catch(() => message.error('复制失败，请手动复制'));
  };

  if (!elderId) {
    return (
      <Alert severity="warning" variant="filled">
        未找到关联的老人信息，请联系管理员。
      </Alert>
    );
  }

  const boundCount = familyMembers.length;
  const progressValue = Math.min(boundCount, MAX_FAMILY_MEMBERS) / MAX_FAMILY_MEMBERS;
  const reachedLimit = boundCount >= MAX_FAMILY_MEMBERS;
  const hasActiveCode = !!inviteCode;
  const codeStep = hasActiveCode ? 2 : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(31,111,235,0.10)',
            color: 'var(--smc-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <UserPlus size={22} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--smc-text)' }}>邀请家属</div>
          <div style={{ marginTop: 2, fontSize: 14, color: 'var(--smc-text-2)' }}>
            生成一个邀请码，让家人在手机上随时查看您的健康状况
          </div>
        </div>
      </div>

      {/* Step guide */}
      <Card>
        <CardBody style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <StepCard
              index={1}
              icon={<Plus size={18} />}
              title="生成邀请码"
              description="点击下方按钮，立即生成一个一次性邀请码"
              active={codeStep === 1}
            />
            <StepCard
              index={2}
              icon={<Share2 size={18} />}
              title="分享给家属"
              description="把邀请码或邀请链接发送给您的子女或亲属"
              active={codeStep === 2}
            />
            <StepCard
              index={3}
              icon={<UserCheck size={18} />}
              title="家属注册绑定"
              description="家属在手机上输入邀请码完成注册，即可查看您的健康信息"
              active={boundCount > 0}
            />
          </div>
        </CardBody>
      </Card>

      {/* Two-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Left: invite code */}
        <Card>
          <CardBody style={{ padding: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <QrCode size={20} style={{ color: 'var(--smc-primary)' }} />
                  <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--smc-text)' }}>
                    我的邀请码
                  </div>
                </div>
                {hasActiveCode && (
                  <Chip tone="success" outlined>
                    有效
                  </Chip>
                )}
              </div>

              {codeLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                  <Spinner />
                </div>
              ) : inviteCode ? (
                <>
                  <div
                    style={{
                      padding: 24,
                      borderRadius: 14,
                      background: 'rgba(31,111,235,0.05)',
                      border: '1px dashed var(--smc-primary)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>
                      请把这串数字告诉您的家属
                    </div>
                    <div
                      title="点击复制"
                      onClick={handleCopyCode}
                      style={{
                        marginTop: 10,
                        fontWeight: 800,
                        fontSize: 40,
                        letterSpacing: 6,
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        color: 'var(--smc-primary)',
                        cursor: 'pointer',
                        userSelect: 'all',
                        wordBreak: 'break-all',
                        lineHeight: 1.2,
                      }}
                    >
                      {inviteCode.code}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip outlined icon={<Calendar size={14} />}>
                      过期 {formatDateTime(inviteCode.expires_at)}
                    </Chip>
                    <Chip
                      outlined
                      tone={inviteCode.used_count >= inviteCode.max_uses ? 'error' : 'primary'}
                    >
                      已使用 {inviteCode.used_count}/{inviteCode.max_uses}
                    </Chip>
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Button
                      variant="primary"
                      size="lg"
                      startIcon={<Copy size={16} />}
                      onClick={handleCopyLink}
                      style={{ flex: 1, minWidth: 160 }}
                    >
                      复制邀请链接
                    </Button>
                    <Button
                      variant="outlined"
                      danger
                      size="lg"
                      startIcon={<Trash2 size={16} />}
                      disabled={actionLoading}
                      onClick={handleRevoke}
                      style={{ flex: 1, minWidth: 160 }}
                    >
                      撤销邀请码
                    </Button>
                  </div>

                  <div>
                    <Button
                      variant="text"
                      size="sm"
                      startIcon={<RefreshCw size={14} />}
                      onClick={handleGenerate}
                      disabled={actionLoading}
                    >
                      重新生成新的邀请码
                    </Button>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    padding: '40px 16px',
                    borderRadius: 14,
                    border: '1px dashed var(--smc-border-strong)',
                    textAlign: 'center',
                  }}
                >
                  <QrCode
                    size={56}
                    style={{ color: 'var(--smc-text-3)', margin: '0 auto 12px' }}
                  />
                  <div
                    style={{
                      fontSize: 15,
                      color: 'var(--smc-text-2)',
                      marginBottom: 20,
                      lineHeight: 1.7,
                    }}
                  >
                    暂无有效邀请码
                    <br />
                    点击下方按钮生成
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    startIcon={<Plus size={18} />}
                    disabled={actionLoading}
                    loading={actionLoading}
                    onClick={handleGenerate}
                  >
                    生成邀请码
                  </Button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Right: family members */}
        <Card>
          <CardBody style={{ padding: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Users size={20} style={{ color: 'var(--smc-success)' }} />
                  <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--smc-text)' }}>
                    我的家属
                  </div>
                </div>
                <Chip tone={reachedLimit ? 'success' : 'primary'}>
                  已绑定 {boundCount}/{MAX_FAMILY_MEMBERS}
                </Chip>
              </div>

              <div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progressValue * 100}%`,
                      height: '100%',
                      background: reachedLimit ? 'var(--smc-success)' : 'var(--smc-primary)',
                      borderRadius: 4,
                      transition: 'width .3s ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: 'var(--smc-text-2)',
                  }}
                >
                  {reachedLimit
                    ? '已达到绑定上限，撤销现有家属后可邀请新成员'
                    : `还可邀请 ${MAX_FAMILY_MEMBERS - boundCount} 位家属`}
                </div>
              </div>

              {familyLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <Spinner />
                </div>
              ) : familyMembers.length === 0 ? (
                <div
                  style={{
                    padding: '40px 16px',
                    borderRadius: 14,
                    border: '1px dashed var(--smc-border-strong)',
                    textAlign: 'center',
                  }}
                >
                  <Heart
                    size={48}
                    style={{ color: 'var(--smc-text-3)', margin: '0 auto 12px' }}
                  />
                  <div
                    style={{
                      fontSize: 15,
                      color: 'var(--smc-text-2)',
                      lineHeight: 1.7,
                    }}
                  >
                    还没有家属绑定
                    <br />
                    生成邀请码后分享给家人即可
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 14,
                  }}
                >
                  {familyMembers.map((member) => (
                    <FamilyCard key={member.id} member={member} />
                  ))}
                </div>
              )}

              {error && <Alert severity="error">{error}</Alert>}
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        title="确认撤销邀请码"
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
        <div style={{ color: 'var(--smc-text-2)', fontSize: 14, lineHeight: 1.7 }}>
          撤销后，当前邀请码将立即失效，已绑定的家属不受影响。如需重新邀请，您需要再次生成新的邀请码。
        </div>
      </Modal>
    </div>
  );
};

export default ElderInvitePage;
