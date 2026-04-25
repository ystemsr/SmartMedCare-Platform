import React, { useState } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import { Button, Modal } from './ui';
import { message } from '../utils/message';

export interface CredentialsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  username?: string | null;
  password: string;
}

/** One-time-view modal for newly generated credentials.
 *
 * Stays open until the user closes it explicitly so a password cannot be
 * missed (unlike toast messages). Credentials are never persisted again
 * after closing, so the user is nudged to copy them first.
 */
const CredentialsModal: React.FC<CredentialsModalProps> = ({
  open,
  onClose,
  title,
  description,
  username,
  password,
}) => {
  const [copiedKey, setCopiedKey] = useState<'username' | 'password' | 'combo' | null>(null);

  const copy = async (value: string, key: 'username' | 'password' | 'combo') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      message.success('已复制到剪贴板');
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500);
    } catch {
      message.error('复制失败，请手动选取');
    }
  };

  const comboValue = username ? `${username} / ${password}` : password;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={460}
      closeOnOverlay={false}
      footer={
        <>
          {username ? (
            <Button
              variant="outlined"
              startIcon={copiedKey === 'combo' ? <Check size={14} /> : <Copy size={14} />}
              onClick={() => copy(comboValue, 'combo')}
            >
              一键复制
            </Button>
          ) : null}
          <Button onClick={onClose}>我已记录</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {description ? (
          <div style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>{description}</div>
        ) : null}

        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            padding: '10px 12px',
            background: 'var(--smc-warning-bg, #FFF7E6)',
            border: '1px solid var(--smc-warning, #FAAD14)',
            borderRadius: 8,
            color: 'var(--smc-warning-text, #AD6800)',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>关闭窗口后将无法再次查看，请先复制并妥善保存，并尽快通知使用者修改密码。</span>
        </div>

        {username ? (
          <CredentialRow
            label="账号"
            value={username}
            copied={copiedKey === 'username'}
            onCopy={() => copy(username, 'username')}
          />
        ) : null}
        <CredentialRow
          label="密码"
          value={password}
          copied={copiedKey === 'password'}
          onCopy={() => copy(password, 'password')}
          mono
        />
      </div>
    </Modal>
  );
};

interface CredentialRowProps {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
}

const CredentialRow: React.FC<CredentialRowProps> = ({ label, value, copied, onCopy, mono }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 12, color: 'var(--smc-text-2)' }}>{label}</span>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        border: '1px solid var(--smc-border)',
        borderRadius: 6,
        background: 'var(--smc-bg-2, #FAFAFA)',
      }}
    >
      <span
        style={{
          flex: 1,
          fontFamily: mono ? 'var(--smc-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' : undefined,
          fontSize: mono ? 14 : 13,
          fontWeight: mono ? 600 : 500,
          wordBreak: 'break-all',
          userSelect: 'all',
        }}
      >
        {value}
      </span>
      <Button
        size="sm"
        variant="text"
        startIcon={copied ? <Check size={14} /> : <Copy size={14} />}
        onClick={onCopy}
      >
        {copied ? '已复制' : '复制'}
      </Button>
    </div>
  </div>
);

export default CredentialsModal;
