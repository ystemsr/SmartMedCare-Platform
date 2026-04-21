import React from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Pencil,
  Power,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button, Chip, Divider, Drawer } from './ui';
import PermissionGuard from './PermissionGuard';
import { formatDate, formatDateTime, formatGender } from '../utils/formatter';
import type { Elder } from '../types/elder';

export interface ElderDetailDrawerProps {
  open: boolean;
  elder: Elder | null;
  onClose: () => void;
  onEdit: (elder: Elder) => void;
  onActivate: (elder: Elder) => void;
  onResetPassword: (elder: Elder) => void;
  onToggleStatus: (elder: Elder) => void;
  onDelete: (elder: Elder) => void;
  onOpenFullArchive: (elder: Elder) => void;
}

interface DetailItemProps {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value, full }) => (
  <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
    <div style={{ fontSize: 12, color: 'var(--smc-text-2)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 14, wordBreak: 'break-word' }}>{value ?? '-'}</div>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--smc-text-2)',
      letterSpacing: 0.3,
      marginBottom: 10,
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

const ElderDetailDrawer: React.FC<ElderDetailDrawerProps> = ({
  open,
  elder,
  onClose,
  onEdit,
  onActivate,
  onResetPassword,
  onToggleStatus,
  onDelete,
  onOpenFullArchive,
}) => {
  if (!elder) {
    return (
      <Drawer open={open} onClose={onClose} width={520} title="老人档案">
        <div style={{ padding: 24, color: 'var(--smc-text-2)' }}>加载中...</div>
      </Drawer>
    );
  }

  const accountActive = elder.account_status === 'active';
  const hasRisk = elder.latest_risk_score !== null && elder.latest_risk_score !== undefined;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{elder.name}</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--smc-text-3)' }}>
            #{elder.id}
          </span>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Status row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip tone={accountActive ? 'success' : 'error'} outlined>
            {accountActive ? '账户正常' : '账户已禁用'}
          </Chip>
          {elder.username ? (
            <Chip outlined>账号: {elder.username}</Chip>
          ) : (
            <Chip tone="warning" outlined>
              未激活账户
            </Chip>
          )}
          {hasRisk ? (
            elder.latest_high_risk ? (
              <Chip tone="error" outlined icon={<AlertTriangle size={12} />}>
                高风险 {(elder.latest_risk_score as number).toFixed(0)}
              </Chip>
            ) : (
              <Chip tone="success" outlined>
                AI 评分 {(elder.latest_risk_score as number).toFixed(0)}
              </Chip>
            )
          ) : (
            <Chip outlined>未评估</Chip>
          )}
        </div>

        {/* Basic info */}
        <div>
          <SectionTitle>基本信息</SectionTitle>
          <div
            style={{
              display: 'grid',
              gap: 14,
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            }}
          >
            <DetailItem label="姓名" value={elder.name} />
            <DetailItem label="性别" value={formatGender(elder.gender)} />
            <DetailItem label="出生日期" value={formatDate(elder.birth_date)} />
            <DetailItem label="身份证号" value={elder.id_card || '-'} />
            <DetailItem label="联系电话" value={elder.phone || '-'} />
            <DetailItem label="家属数" value={elder.family_count ?? 0} />
            <DetailItem label="地址" value={elder.address || '-'} full />
            <DetailItem label="紧急联系人" value={elder.emergency_contact_name || '-'} />
            <DetailItem
              label="紧急联系电话"
              value={elder.emergency_contact_phone || '-'}
            />
            <DetailItem
              label="标签"
              full
              value={
                elder.tags?.length ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {elder.tags.map((tag) => (
                      <Chip key={tag} tone="primary" outlined>
                        {tag}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  '暂无'
                )
              }
            />
          </div>
        </div>

        <Divider />

        {/* Meta info */}
        <div>
          <SectionTitle>记录信息</SectionTitle>
          <div
            style={{
              display: 'grid',
              gap: 14,
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            }}
          >
            <DetailItem label="档案创建时间" value={formatDateTime(elder.created_at)} />
            <DetailItem
              label="最近 AI 评估"
              value={
                elder.latest_prediction_at
                  ? formatDateTime(elder.latest_prediction_at)
                  : '暂无'
              }
            />
          </div>
        </div>

        <Divider />

        {/* Actions */}
        <div>
          <SectionTitle>操作</SectionTitle>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<ExternalLink size={14} />}
              onClick={() => onOpenFullArchive(elder)}
            >
              打开完整档案
            </Button>
            <PermissionGuard permission="elder:update">
              <Button
                variant="outlined"
                startIcon={<Pencil size={14} />}
                onClick={() => onEdit(elder)}
              >
                编辑
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="elder:update">
              {!elder.username ? (
                <Button
                  variant="outlined"
                  startIcon={<ShieldCheck size={14} />}
                  onClick={() => onActivate(elder)}
                >
                  激活账户
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshCw size={14} />}
                    onClick={() => onResetPassword(elder)}
                  >
                    重置密码
                  </Button>
                  <Button
                    variant="outlined"
                    danger={accountActive}
                    startIcon={<Power size={14} />}
                    onClick={() => onToggleStatus(elder)}
                  >
                    {accountActive ? '禁用账户' : '启用账户'}
                  </Button>
                </>
              )}
            </PermissionGuard>
            <PermissionGuard permission="elder:delete">
              <Button
                variant="outlined"
                danger
                startIcon={<Trash2 size={14} />}
                onClick={() => onDelete(elder)}
              >
                删除档案
              </Button>
            </PermissionGuard>
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default ElderDetailDrawer;
