import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCircle2,
  BadgeCheck,
  CalendarClock,
  User,
  UserSquare,
  Cake,
  Phone,
  Home,
  ShieldAlert,
  PhoneCall,
  Tag,
  Pencil,
  KeyRound,
} from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Input,
  Modal,
  Spinner,
  Textarea,
} from '@/components/ui';
import { useAuthStore } from '../../store/auth';
import { changePassword } from '../../api/auth';
import {
  getElderSelf,
  updateElderSelf,
  type ElderSelfUpdatePayload,
} from '../../api/elderPortal';
import { formatDate, formatDateTime, formatGender } from '../../utils/formatter';
import { message } from '../../utils/message';

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
  username?: string;
  created_at?: string;
}

type EditableField =
  | 'phone'
  | 'address'
  | 'emergency_contact_name'
  | 'emergency_contact_phone';

interface FieldConfig {
  key: EditableField;
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  placeholder: string;
  multiline?: boolean;
  validate: (value: string) => string | null;
}

const PHONE_REGEX = /^1\d{10}$/;

function validatePhone(value: string): string | null {
  if (!value) return '请输入手机号';
  if (!PHONE_REGEX.test(value)) return '请输入 11 位手机号';
  return null;
}

function validateRequired(label: string) {
  return (value: string): string | null => {
    if (!value || !value.trim()) return `请输入${label}`;
    return null;
  };
}

const editableFields: FieldConfig[] = [
  {
    key: 'phone',
    label: '联系电话',
    icon: <Phone size={20} />,
    iconColor: '#42a5f5',
    placeholder: '请输入 11 位手机号',
    validate: validatePhone,
  },
  {
    key: 'address',
    label: '住址',
    icon: <Home size={20} />,
    iconColor: '#66bb6a',
    placeholder: '省 / 市 / 区 / 详细地址',
    multiline: true,
    validate: validateRequired('住址'),
  },
  {
    key: 'emergency_contact_name',
    label: '紧急联系人姓名',
    icon: <ShieldAlert size={20} />,
    iconColor: '#ef5350',
    placeholder: '亲属或朋友的姓名',
    validate: validateRequired('紧急联系人姓名'),
  },
  {
    key: 'emergency_contact_phone',
    label: '紧急联系电话',
    icon: <PhoneCall size={20} />,
    iconColor: '#ef5350',
    placeholder: '请输入 11 位手机号',
    validate: validatePhone,
  },
];

interface PasswordFormValues {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

type PasswordFormErrors = Partial<Record<keyof PasswordFormValues, string>>;

const initialPasswordValues: PasswordFormValues = {
  old_password: '',
  new_password: '',
  confirm_password: '',
};

function validatePasswordForm(values: PasswordFormValues): PasswordFormErrors {
  const errors: PasswordFormErrors = {};
  if (!values.old_password) errors.old_password = '请输入当前密码';
  if (!values.new_password) errors.new_password = '请输入新密码';
  else if (values.new_password.length < 6) errors.new_password = '密码至少 6 个字符';
  if (!values.confirm_password) errors.confirm_password = '请再次输入新密码';
  else if (values.confirm_password !== values.new_password)
    errors.confirm_password = '两次输入的密码不一致';
  return errors;
}

interface InfoTileProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconColor: string;
  hint?: string;
  action?: React.ReactNode;
}

function InfoTile({ label, value, icon, iconColor, hint, action }: InfoTileProps) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 12,
        background: 'var(--smc-surface-alt)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${iconColor}14`,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>{label}</div>
        <div
          style={{
            marginTop: 4,
            fontSize: 17,
            fontWeight: 600,
            wordBreak: 'break-word',
            color: 'var(--smc-text)',
          }}
        >
          {value || '—'}
        </div>
        {hint && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--smc-text-3)' }}>{hint}</div>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

interface EditDialogProps {
  open: boolean;
  config: FieldConfig | null;
  initialValue: string;
  saving: boolean;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
}

function EditDialog({ open, config, initialValue, saving, onClose, onSave }: EditDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
    }
  }, [open, initialValue]);

  if (!config) return null;

  const handleSubmit = async () => {
    const trimmed = value.trim();
    const validationError = config.validate(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    await onSave(trimmed);
  };

  const handleChange = (next: string) => {
    setValue(next);
    if (error) setError(null);
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={`修改${config.label}`}
      width={460}
      closeOnOverlay={!saving}
      closeOnEsc={!saving}
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              void handleSubmit();
            }}
            loading={saving}
          >
            保存
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>
          请填写新的{config.label}，修改后请记得保存。
        </div>
        {config.multiline ? (
          <Textarea
            label={config.label}
            value={value}
            placeholder={config.placeholder}
            error={error || undefined}
            onChange={(event) => handleChange(event.target.value)}
            rows={3}
          />
        ) : (
          <Input
            label={config.label}
            value={value}
            placeholder={config.placeholder}
            error={error || undefined}
            onChange={(event) => handleChange(event.target.value)}
          />
        )}
      </div>
    </Modal>
  );
}

const ElderPersonalPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingField, setEditingField] = useState<FieldConfig | null>(null);
  const [savingField, setSavingField] = useState(false);

  const [passwordValues, setPasswordValues] = useState<PasswordFormValues>(initialPasswordValues);
  const [passwordErrors, setPasswordErrors] = useState<PasswordFormErrors>({});
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await getElderSelf();
        setProfile(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取个人信息失败');
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile();
  }, []);

  const handleSaveField = async (value: string) => {
    if (!editingField) return;
    setSavingField(true);
    try {
      const payload: ElderSelfUpdatePayload = { [editingField.key]: value };
      await updateElderSelf(payload);
      setProfile((prev) => (prev ? { ...prev, [editingField.key]: value } : prev));
      message.success(`${editingField.label}已更新`);
      setEditingField(null);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSavingField(false);
    }
  };

  const updatePasswordField = <K extends keyof PasswordFormValues>(
    key: K,
    value: PasswordFormValues[K],
  ) => {
    setPasswordValues((current) => ({ ...current, [key]: value }));
    setPasswordErrors((current) => ({ ...current, [key]: '' }));
  };

  const handleChangePassword = async () => {
    const nextErrors = validatePasswordForm(passwordValues);
    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPasswordSaving(true);
    try {
      await changePassword({
        old_password: passwordValues.old_password,
        new_password: passwordValues.new_password,
      });
      message.success('密码修改成功');
      setPasswordValues(initialPasswordValues);
      setPasswordErrors({});
    } catch (err) {
      message.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setPasswordSaving(false);
    }
  };

  const editingValue = useMemo(() => {
    if (!editingField || !profile) return '';
    return (profile[editingField.key] as string | undefined) || '';
  }, [editingField, profile]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert severity="error" variant="filled">
        {error}
      </Alert>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Welcome banner */}
      <Card style={{ overflow: 'hidden', position: 'relative', border: 'none' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
            color: '#3a2e1d',
            padding: '32px 32px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative', zIndex: 1 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7c4a14',
              }}
            >
              <UserCircle2 size={40} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
                {profile?.name || user?.real_name || '个人账户'}
              </div>
              <div style={{ marginTop: 6, fontSize: 15, opacity: 0.85 }}>
                您可以在这里查看与修改个人信息，并定期更新密码
              </div>
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -24,
              right: 70,
              width: 90,
              height: 90,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </Card>

      {/* Card A: Account info */}
      <Card>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BadgeCheck size={22} style={{ color: '#5c6bc0' }} />
              <div style={{ fontSize: 18, fontWeight: 700 }}>账户信息</div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 16,
              }}
            >
              <InfoTile
                label="登录用户名"
                value={profile?.username || user?.username || '-'}
                icon={<User size={20} />}
                iconColor="#5c6bc0"
              />
              <InfoTile
                label="角色"
                value={user?.roles?.join('、') || '老人'}
                icon={<BadgeCheck size={20} />}
                iconColor="#26a69a"
              />
              <InfoTile
                label="注册时间"
                value={formatDateTime(profile?.created_at || user?.created_at)}
                icon={<CalendarClock size={20} />}
                iconColor="#ffa726"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Card B: Personal profile */}
      <Card>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <User size={22} style={{ color: '#42a5f5' }} />
                <div style={{ fontSize: 18, fontWeight: 700 }}>个人基础档案</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>
                姓名、性别、出生日期需由医护人员核对修改
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--smc-text-2)' }}>
                只读信息
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                }}
              >
                <InfoTile
                  label="姓名"
                  value={profile?.name || '-'}
                  icon={<UserSquare size={20} />}
                  iconColor="#5c6bc0"
                />
                <InfoTile
                  label="性别"
                  value={formatGender(profile?.gender)}
                  icon={<User size={20} />}
                  iconColor="#26a69a"
                />
                <InfoTile
                  label="出生日期"
                  value={formatDate(profile?.birth_date)}
                  icon={<Cake size={20} />}
                  iconColor="#ffa726"
                />
              </div>
            </div>

            <Divider />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--smc-text-2)' }}>
                可修改信息
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {editableFields.map((field) => (
                  <InfoTile
                    key={field.key}
                    label={field.label}
                    value={(profile?.[field.key] as string | undefined) || ''}
                    icon={field.icon}
                    iconColor={field.iconColor}
                    action={
                      <Button
                        variant="outlined"
                        size="sm"
                        startIcon={<Pencil size={14} />}
                        onClick={() => setEditingField(field)}
                      >
                        修改
                      </Button>
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Card C: Tags (read-only) */}
      <Card>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tag size={22} style={{ color: '#ab47bc' }} />
              <div style={{ fontSize: 18, fontWeight: 700 }}>我的标签</div>
            </div>
            {profile?.tags && profile.tags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {profile.tags.map((tag) => (
                  <Chip key={tag} tone="primary" outlined size="md">
                    {tag}
                  </Chip>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--smc-text-2)' }}>
                暂无标签，标签由医护人员维护
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Card D: Change password */}
      <Card>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <KeyRound size={22} style={{ color: '#ef5350' }} />
              <div style={{ fontSize: 18, fontWeight: 700 }}>修改密码</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>
              密码至少 6 个字符，建议定期更换以保障账户安全
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleChangePassword();
              }}
              noValidate
              style={{ maxWidth: 460 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Input
                  label="当前密码"
                  type="password"
                  value={passwordValues.old_password}
                  onChange={(event) => updatePasswordField('old_password', event.target.value)}
                  error={passwordErrors.old_password}
                />
                <Input
                  label="新密码"
                  type="password"
                  value={passwordValues.new_password}
                  onChange={(event) => updatePasswordField('new_password', event.target.value)}
                  error={passwordErrors.new_password}
                />
                <Input
                  label="确认新密码"
                  type="password"
                  value={passwordValues.confirm_password}
                  onChange={(event) => updatePasswordField('confirm_password', event.target.value)}
                  error={passwordErrors.confirm_password}
                />
                <div>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={passwordSaving}
                    disabled={passwordSaving}
                  >
                    {passwordSaving ? '修改中...' : '修改密码'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </CardBody>
      </Card>

      <EditDialog
        open={editingField !== null}
        config={editingField}
        initialValue={editingValue}
        saving={savingField}
        onClose={() => setEditingField(null)}
        onSave={handleSaveField}
      />
    </div>
  );
};

export default ElderPersonalPage;
