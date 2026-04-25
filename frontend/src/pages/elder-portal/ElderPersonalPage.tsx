import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  ShieldCheck,
  Tag,
  Info,
  Lock,
  Phone,
  MapPin,
  Clock,
  Save,
  Eye,
  EyeOff,
  Edit3,
  BadgeCheck,
} from 'lucide-react';
import { Alert, Spinner } from '@/components/ui';
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

interface EditableInfo {
  phone: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

const emptyEditable: EditableInfo = {
  phone: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

const PHONE_REGEX = /^1\d{10}$/;

type ContactErrors = Partial<Record<keyof EditableInfo, string>>;

function validateContact(values: EditableInfo): ContactErrors {
  const errors: ContactErrors = {};
  if (!values.phone) errors.phone = '请输入手机号';
  else if (!PHONE_REGEX.test(values.phone)) errors.phone = '请输入 11 位手机号';
  if (!values.address.trim()) errors.address = '请输入家庭住址';
  if (!values.emergency_contact_name.trim())
    errors.emergency_contact_name = '请输入紧急联系人姓名';
  if (!values.emergency_contact_phone)
    errors.emergency_contact_phone = '请输入紧急联系电话';
  else if (!PHONE_REGEX.test(values.emergency_contact_phone))
    errors.emergency_contact_phone = '请输入 11 位手机号';
  return errors;
}

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

const COLORS = {
  pageBg: '#f8fafc',
  cardBg: '#ffffff',
  cardRing: 'rgba(15, 23, 42, 0.05)',
  cardShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  cardShadowHover: '0 4px 16px rgba(15, 23, 42, 0.08)',
  borderLight: '#f1f5f9',
  borderSoft: '#e2e8f0',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  emerald500: '#10b981',
  indigo500: '#6366f1',
  amberBg: '#fffbeb',
  amberText: '#b45309',
  amberRing: 'rgba(217, 119, 6, 0.25)',
  rose50: '#fff1f2',
  rose100: '#ffe4e6',
  rose400: '#fb7185',
  rose600: '#e11d48',
};

const cardStyle: React.CSSProperties = {
  background: COLORS.cardBg,
  boxShadow: `${COLORS.cardShadow}, 0 0 0 1px ${COLORS.cardRing}`,
  borderRadius: 16,
  overflow: 'hidden',
};

const inputBaseStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 12,
  border: 'none',
  padding: '14px 16px',
  fontSize: 16,
  color: COLORS.slate900,
  background: COLORS.cardBg,
  boxShadow: `inset 0 0 0 1px ${COLORS.slate300}`,
  outline: 'none',
  transition: 'box-shadow 150ms ease, background 150ms ease',
};

interface StyledInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  accent?: string;
  errorText?: string;
  softBg?: boolean;
}

const StyledInput: React.FC<StyledInputProps> = ({
  accent = COLORS.blue500,
  errorText,
  softBg,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const ringColor = errorText ? COLORS.rose600 : focused ? accent : COLORS.slate300;
  const ringWidth = focused || errorText ? 2 : 1;
  const bg = softBg && !focused ? COLORS.slate50 : COLORS.cardBg;
  return (
    <>
      <input
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={{
          ...inputBaseStyle,
          background: bg,
          boxShadow: `inset 0 0 0 ${ringWidth}px ${ringColor}`,
          ...style,
        }}
      />
      {errorText && (
        <div style={{ marginTop: 6, fontSize: 13, color: COLORS.rose600 }}>
          {errorText}
        </div>
      )}
    </>
  );
};

const ElderPersonalPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editableInfo, setEditableInfo] = useState<EditableInfo>(emptyEditable);
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});
  const [contactSaving, setContactSaving] = useState(false);

  const [passwordValues, setPasswordValues] = useState<PasswordFormValues>(initialPasswordValues);
  const [passwordErrors, setPasswordErrors] = useState<PasswordFormErrors>({});
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await getElderSelf();
        setProfile(res.data);
        setEditableInfo({
          phone: res.data?.phone || '',
          address: res.data?.address || '',
          emergency_contact_name: res.data?.emergency_contact_name || '',
          emergency_contact_phone: res.data?.emergency_contact_phone || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取个人信息失败');
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile();
  }, []);

  const isContactDirty = useMemo(() => {
    if (!profile) return false;
    return (
      editableInfo.phone !== (profile.phone || '') ||
      editableInfo.address !== (profile.address || '') ||
      editableInfo.emergency_contact_name !== (profile.emergency_contact_name || '') ||
      editableInfo.emergency_contact_phone !== (profile.emergency_contact_phone || '')
    );
  }, [editableInfo, profile]);

  const handleContactChange = (key: keyof EditableInfo, value: string) => {
    setEditableInfo((prev) => ({ ...prev, [key]: value }));
    setContactErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSaveContact = async () => {
    const errors = validateContact(editableInfo);
    setContactErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setContactSaving(true);
    try {
      const payload: ElderSelfUpdatePayload = {
        phone: editableInfo.phone.trim(),
        address: editableInfo.address.trim(),
        emergency_contact_name: editableInfo.emergency_contact_name.trim(),
        emergency_contact_phone: editableInfo.emergency_contact_phone.trim(),
      };
      await updateElderSelf(payload);
      setProfile((prev) => (prev ? { ...prev, ...payload } as ElderProfile : prev));
      message.success('联系方式已更新');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setContactSaving(false);
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

  const displayName = profile?.name || user?.real_name || '个人账户';
  const initial = displayName.charAt(0);

  return (
    <div
      style={{
        background: COLORS.pageBg,
        margin: '-24px',
        padding: '40px 24px',
        minHeight: 'calc(100vh - 64px)',
        color: COLORS.slate900,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            paddingBottom: 12,
            borderBottom: `1px solid ${COLORS.borderSoft}`,
          }}
        >
          <div
            style={{
              height: 56,
              width: 56,
              background: COLORS.blue100,
              color: COLORS.blue600,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              border: `1px solid ${COLORS.blue200}`,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {initial}
          </div>
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: COLORS.slate900,
                margin: 0,
              }}
            >
              你好，{displayName}
            </h1>
            <p style={{ fontSize: 14, color: COLORS.slate500, marginTop: 4, marginBottom: 0 }}>
              这里是您的专属信息管家，您可以随时查看档案或更新联系方式。
            </p>
          </div>
        </div>

        {/* Card 1: Account info */}
        <section style={cardStyle}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${COLORS.borderLight}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ShieldCheck color={COLORS.blue500} size={20} />
            <h2 style={{ fontSize: 18, fontWeight: 600, color: COLORS.slate800, margin: 0 }}>
              账户信息
            </h2>
          </div>
          <div
            style={{
              padding: '24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 24,
            }}
          >
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.slate500,
                  marginBottom: 4,
                }}
              >
                <User size={14} style={{ marginRight: 6 }} /> 登录用户名
              </label>
              <div style={{ fontSize: 16, fontWeight: 500, color: COLORS.slate900, padding: '8px 0' }}>
                {profile?.username || user?.username || '-'}
              </div>
            </div>
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.slate500,
                  marginBottom: 4,
                }}
              >
                <BadgeCheck size={14} style={{ marginRight: 6 }} /> 角色
              </label>
              <div style={{ fontSize: 16, fontWeight: 500, color: COLORS.slate900, padding: '8px 0' }}>
                {user?.roles?.join('、') || '老人'}
              </div>
            </div>
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.slate500,
                  marginBottom: 4,
                }}
              >
                <Clock size={14} style={{ marginRight: 6 }} /> 注册时间
              </label>
              <div style={{ fontSize: 16, fontWeight: 500, color: COLORS.slate900, padding: '8px 0' }}>
                {formatDateTime(profile?.created_at || user?.created_at)}
              </div>
            </div>
          </div>
        </section>

        {/* Card 2: Personal profile */}
        <section style={cardStyle}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${COLORS.borderLight}`,
              background: 'rgba(248, 250, 252, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <User color={COLORS.emerald500} size={22} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: COLORS.slate800, margin: 0 }}>
              我的基本信息
            </h2>
          </div>

          <div style={{ padding: 24 }}>
            {/* 身份档案 (read-only) */}
            <div style={{ marginBottom: 32 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: COLORS.slate800,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  身份档案
                  <span
                    style={{
                      marginLeft: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 9999,
                      background: COLORS.amberBg,
                      padding: '2px 10px',
                      fontSize: 12,
                      fontWeight: 500,
                      color: COLORS.amberText,
                      boxShadow: `inset 0 0 0 1px ${COLORS.amberRing}`,
                    }}
                  >
                    <Lock size={12} style={{ marginRight: 4 }} /> 医护人员专属修改
                  </span>
                </h3>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                  background: COLORS.slate50,
                  padding: 20,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.borderLight}`,
                }}
              >
                <div
                  style={{
                    background: COLORS.cardBg,
                    padding: 16,
                    borderRadius: 12,
                    border: `1px solid ${COLORS.borderLight}`,
                    boxShadow: COLORS.cardShadow,
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 500, color: COLORS.slate500, margin: 0, marginBottom: 4 }}>
                    姓名
                  </p>
                  <p style={{ color: COLORS.slate900, fontWeight: 700, fontSize: 18, margin: 0 }}>
                    {profile?.name || '-'}
                  </p>
                </div>
                <div
                  style={{
                    background: COLORS.cardBg,
                    padding: 16,
                    borderRadius: 12,
                    border: `1px solid ${COLORS.borderLight}`,
                    boxShadow: COLORS.cardShadow,
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 500, color: COLORS.slate500, margin: 0, marginBottom: 4 }}>
                    性别
                  </p>
                  <p style={{ color: COLORS.slate900, fontWeight: 700, fontSize: 18, margin: 0 }}>
                    {formatGender(profile?.gender) || '-'}
                  </p>
                </div>
                <div
                  style={{
                    background: COLORS.cardBg,
                    padding: 16,
                    borderRadius: 12,
                    border: `1px solid ${COLORS.borderLight}`,
                    boxShadow: COLORS.cardShadow,
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 500, color: COLORS.slate500, margin: 0, marginBottom: 4 }}>
                    出生日期
                  </p>
                  <p style={{ color: COLORS.slate900, fontWeight: 700, fontSize: 18, margin: 0 }}>
                    {formatDate(profile?.birth_date) || '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* 联系方式 (editable) */}
            <div
              style={{
                background: 'rgba(239, 246, 255, 0.4)',
                padding: 24,
                borderRadius: 12,
                border: `1px solid rgba(219, 234, 254, 0.7)`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 20,
                  borderBottom: `1px solid ${COLORS.blue100}`,
                  paddingBottom: 12,
                }}
              >
                <Edit3 size={18} color={COLORS.blue500} style={{ marginRight: 8 }} />
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: COLORS.slate800,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  联系方式
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 400,
                      color: COLORS.slate500,
                      marginLeft: 8,
                    }}
                  >
                    （如有变动，请及时更新下方信息）
                  </span>
                </h3>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  columnGap: 24,
                  rowGap: 20,
                }}
              >
                <div>
                  <label
                    htmlFor="phone"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 15,
                      fontWeight: 500,
                      color: COLORS.slate700,
                      marginBottom: 8,
                    }}
                  >
                    <Phone size={16} style={{ marginRight: 6, color: COLORS.blue400 }} />
                    您的联系电话
                  </label>
                  <StyledInput
                    type="tel"
                    id="phone"
                    value={editableInfo.phone}
                    onChange={(e) => handleContactChange('phone', e.target.value)}
                    placeholder="请输入 11 位手机号"
                    errorText={contactErrors.phone}
                  />
                </div>

                <div>
                  <label
                    htmlFor="address"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 15,
                      fontWeight: 500,
                      color: COLORS.slate700,
                      marginBottom: 8,
                    }}
                  >
                    <MapPin size={16} style={{ marginRight: 6, color: COLORS.blue400 }} />
                    家庭住址
                  </label>
                  <StyledInput
                    type="text"
                    id="address"
                    value={editableInfo.address}
                    onChange={(e) => handleContactChange('address', e.target.value)}
                    placeholder="省 / 市 / 区 / 详细地址"
                    errorText={contactErrors.address}
                  />
                </div>

                <div>
                  <label
                    htmlFor="emergency_contact_name"
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: COLORS.slate700,
                      marginBottom: 8,
                      display: 'block',
                    }}
                  >
                    紧急联系人姓名
                  </label>
                  <StyledInput
                    type="text"
                    id="emergency_contact_name"
                    value={editableInfo.emergency_contact_name}
                    onChange={(e) => handleContactChange('emergency_contact_name', e.target.value)}
                    placeholder="亲属或朋友的姓名"
                    errorText={contactErrors.emergency_contact_name}
                  />
                </div>

                <div>
                  <label
                    htmlFor="emergency_contact_phone"
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: COLORS.slate700,
                      marginBottom: 8,
                      display: 'block',
                    }}
                  >
                    紧急联系人电话
                  </label>
                  <StyledInput
                    type="tel"
                    id="emergency_contact_phone"
                    value={editableInfo.emergency_contact_phone}
                    onChange={(e) => handleContactChange('emergency_contact_phone', e.target.value)}
                    placeholder="请输入 11 位手机号"
                    errorText={contactErrors.emergency_contact_phone}
                  />
                </div>
              </div>

              <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => void handleSaveContact()}
                  disabled={contactSaving || !isContactDirty}
                  style={{
                    display: 'inline-flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 12,
                    background: contactSaving || !isContactDirty ? COLORS.slate400 : COLORS.blue600,
                    padding: '14px 32px',
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#fff',
                    border: 'none',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)',
                    cursor: contactSaving || !isContactDirty ? 'not-allowed' : 'pointer',
                    transition: 'background 150ms ease, transform 100ms ease',
                  }}
                  onMouseDown={(e) => {
                    if (!contactSaving && isContactDirty) {
                      e.currentTarget.style.transform = 'scale(0.97)';
                    }
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <Save size={20} />
                  {contactSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Card 3: Tags */}
        <section style={cardStyle}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${COLORS.borderLight}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Tag color={COLORS.indigo500} size={20} />
            <h2 style={{ fontSize: 18, fontWeight: 600, color: COLORS.slate800, margin: 0 }}>
              我的标签
            </h2>
          </div>

          {profile?.tags && profile.tags.length > 0 ? (
            <div style={{ padding: 24, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profile.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 14px',
                    borderRadius: 9999,
                    background: COLORS.blue50,
                    color: COLORS.blue600,
                    fontSize: 14,
                    fontWeight: 500,
                    boxShadow: `inset 0 0 0 1px ${COLORS.blue100}`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                background: 'rgba(248, 250, 252, 0.3)',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: COLORS.slate100,
                  marginBottom: 16,
                }}
              >
                <Tag size={24} color={COLORS.slate400} />
              </div>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.slate900,
                  margin: 0,
                }}
              >
                暂无个人标签
              </h3>
              <p
                style={{
                  marginTop: 4,
                  marginBottom: 0,
                  fontSize: 14,
                  color: COLORS.slate500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Info size={14} style={{ marginRight: 4 }} />
                您的健康/护理标签将由专业医护人员根据评估结果进行维护。
              </p>
            </div>
          )}
        </section>

        {/* Card 4: Password */}
        <section style={cardStyle}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${COLORS.borderLight}`,
              background: 'rgba(248, 250, 252, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ShieldCheck color={COLORS.rose600} size={22} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: COLORS.slate800, margin: 0 }}>
              账户安全设置
            </h2>
          </div>

          <div style={{ padding: 32 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 32,
              }}
            >
              {/* Left info panel */}
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div
                  style={{
                    background: 'rgba(255, 241, 242, 0.5)',
                    borderRadius: 16,
                    padding: 24,
                    border: `1px solid ${COLORS.rose100}`,
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      background: COLORS.rose100,
                      color: COLORS.rose600,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Lock size={24} />
                  </div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: COLORS.slate800,
                      margin: 0,
                      marginBottom: 12,
                    }}
                  >
                    修改登录密码
                  </h3>
                  <p
                    style={{
                      color: '#475569',
                      fontSize: 15,
                      lineHeight: 1.6,
                      margin: 0,
                      marginBottom: 20,
                    }}
                  >
                    为了保护您的个人隐私和健康数据，建议您定期更换密码。
                  </p>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 16,
                      margin: 0,
                      background: COLORS.cardBg,
                      borderRadius: 12,
                      border: `1px solid ${COLORS.rose50}`,
                      fontSize: 14,
                      color: '#475569',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <li style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <ShieldCheck
                        size={16}
                        color={COLORS.rose400}
                        style={{ marginRight: 8, marginTop: 2, flexShrink: 0 }}
                      />
                      <span>
                        密码至少包含 <strong>6 个字符</strong>
                      </span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <ShieldCheck
                        size={16}
                        color={COLORS.rose400}
                        style={{ marginRight: 8, marginTop: 2, flexShrink: 0 }}
                      />
                      <span>请勿使用简单的生日或电话号码组合</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Right form */}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleChangePassword();
                }}
                noValidate
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 24,
                  flex: '2 1 360px',
                  minWidth: 0,
                }}
              >
                <div>
                  <label
                    htmlFor="current"
                    style={{
                      display: 'block',
                      fontSize: 15,
                      fontWeight: 700,
                      color: COLORS.slate700,
                      marginBottom: 8,
                    }}
                  >
                    现在的密码
                  </label>
                  <StyledInput
                    type={showPassword ? 'text' : 'password'}
                    id="current"
                    placeholder="请输入您现在正在使用的密码"
                    value={passwordValues.old_password}
                    onChange={(e) => updatePasswordField('old_password', e.target.value)}
                    errorText={passwordErrors.old_password}
                    accent={COLORS.rose600}
                    softBg
                  />
                </div>

                <div style={{ paddingTop: 16, borderTop: `1px solid ${COLORS.borderLight}` }}>
                  <label
                    htmlFor="new"
                    style={{
                      display: 'block',
                      fontSize: 15,
                      fontWeight: 700,
                      color: COLORS.slate700,
                      marginBottom: 8,
                    }}
                  >
                    想设置的新密码
                  </label>
                  <StyledInput
                    type={showPassword ? 'text' : 'password'}
                    id="new"
                    placeholder="请输入新密码（最少 6 位）"
                    value={passwordValues.new_password}
                    onChange={(e) => updatePasswordField('new_password', e.target.value)}
                    errorText={passwordErrors.new_password}
                    accent={COLORS.rose600}
                    softBg
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm"
                    style={{
                      display: 'block',
                      fontSize: 15,
                      fontWeight: 700,
                      color: COLORS.slate700,
                      marginBottom: 8,
                    }}
                  >
                    再输一次新密码
                  </label>
                  <div style={{ position: 'relative' }}>
                    <StyledInput
                      type={showPassword ? 'text' : 'password'}
                      id="confirm"
                      placeholder="请再次确认您的新密码"
                      value={passwordValues.confirm_password}
                      onChange={(e) => updatePasswordField('confirm_password', e.target.value)}
                      errorText={passwordErrors.confirm_password}
                      accent={COLORS.rose600}
                      softBg
                      style={{ paddingRight: 48 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      title={showPassword ? '隐藏密码' : '显示密码'}
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        height: 52,
                        display: 'flex',
                        alignItems: 'center',
                        paddingRight: 16,
                        color: COLORS.slate400,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                    </button>
                  </div>
                </div>

                <div style={{ paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    style={{
                      display: 'inline-flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 12,
                      background: passwordSaving ? COLORS.slate400 : COLORS.slate800,
                      padding: '14px 32px',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#fff',
                      border: 'none',
                      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.2)',
                      cursor: passwordSaving ? 'not-allowed' : 'pointer',
                      transition: 'background 150ms ease, transform 100ms ease',
                    }}
                    onMouseDown={(e) => {
                      if (!passwordSaving) e.currentTarget.style.transform = 'scale(0.97)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {passwordSaving ? '修改中...' : '确认并更新密码'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ElderPersonalPage;
