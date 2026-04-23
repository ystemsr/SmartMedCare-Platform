import React, { useState } from 'react';
import { Button, Card, Divider, Input } from '../../components/ui';
import { RefPageHead, RefAvatar, RefPill } from '../../components/ref';
import { useAuthStore } from '../../store/auth';
import { changePassword } from '../../api/auth';
import { message } from '../../utils/message';

interface PasswordFormValues {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

type PasswordFormErrors = Partial<Record<keyof PasswordFormValues, string>>;

const initialValues: PasswordFormValues = {
  old_password: '',
  new_password: '',
  confirm_password: '',
};

function validatePasswordForm(values: PasswordFormValues): PasswordFormErrors {
  const errors: PasswordFormErrors = {};

  if (!values.old_password) {
    errors.old_password = '请输入当前密码';
  }
  if (!values.new_password) {
    errors.new_password = '请输入新密码';
  } else if (values.new_password.length < 6) {
    errors.new_password = '密码至少6个字符';
  }
  if (!values.confirm_password) {
    errors.confirm_password = '请再次输入新密码';
  } else if (values.confirm_password !== values.new_password) {
    errors.confirm_password = '两次输入的密码不一致';
  }

  return errors;
}

const PersonalAccountPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<PasswordFormValues>(initialValues);
  const [errors, setErrors] = useState<PasswordFormErrors>({});

  const updateField = <K extends keyof PasswordFormValues>(key: K, value: PasswordFormValues[K]) => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: '',
    }));
  };

  const handleChangePassword = async (nextValues: PasswordFormValues) => {
    const nextErrors = validatePasswordForm(nextValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      await changePassword({
        old_password: nextValues.old_password,
        new_password: nextValues.new_password,
      });
      message.success('密码修改成功');
      setValues(initialValues);
      setErrors({});
    } catch (err) {
      message.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setLoading(false);
    }
  };

  const infoItems: [string, string][] = [
    ['用户名', user?.username || '-'],
    ['姓名', user?.real_name || '-'],
    ['手机号', user?.phone || '-'],
    ['邮箱', user?.email || '-'],
    ['角色', user?.roles?.join(', ') || '-'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <RefPageHead
        title="个人账户"
        subtitle="基本资料 · 安全设置"
      />

      <div
        className="ref-grid"
        style={{ gridTemplateColumns: '1fr 2fr', gap: 16 }}
      >
        <Card>
          <div
            style={{
              padding: 24,
              textAlign: 'center',
            }}
          >
            <RefAvatar
              name={user?.real_name || user?.username}
              size="xxl"
              style={{ margin: '0 auto' }}
            />
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginTop: 12,
                fontFamily: 'var(--smc-font-display)',
              }}
            >
              {user?.real_name || user?.username || '-'}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--smc-text-3)',
                marginTop: 4,
              }}
            >
              {user?.roles?.join(' · ') || '-'}
            </div>
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <RefPill tone="ok" dot>
                在线
              </RefPill>
            </div>
            <hr className="ref-hr" style={{ margin: '16px 0' }} />
            <div
              style={{
                textAlign: 'left',
                fontSize: 13,
                color: 'var(--smc-text-2)',
              }}
            >
              {infoItems.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                  }}
                >
                  <span style={{ color: 'var(--smc-text-3)' }}>{label}</span>
                  <span style={{ fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

      <Card>
        <div style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>修改密码</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--smc-text-2)' }}>
            密码至少 6 个字符，确认新密码需保持一致。
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleChangePassword(values);
            }}
            noValidate
            style={{ maxWidth: 440 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label="当前密码"
                type="password"
                value={values.old_password}
                onChange={(event) => updateField('old_password', event.target.value)}
                error={errors.old_password}
              />

              <Divider />

              <Input
                label="新密码"
                type="password"
                value={values.new_password}
                onChange={(event) => updateField('new_password', event.target.value)}
                error={errors.new_password}
              />

              <Input
                label="确认新密码"
                type="password"
                value={values.confirm_password}
                onChange={(event) => updateField('confirm_password', event.target.value)}
                error={errors.confirm_password}
              />

              <div>
                <Button type="submit" loading={loading} disabled={loading}>
                  {loading ? '修改中...' : '修改密码'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Card>
      </div>
    </div>
  );
};

export default PersonalAccountPage;
