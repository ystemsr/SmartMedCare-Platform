import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SlideCaptcha from '../../components/SlideCaptcha';
import { validateInviteCode, registerFamily } from '../../api/family';
import type { InviteCodeValidation } from '../../types/family';
import { message } from '../../utils/message';

interface RegisterFormValues {
  invite_code: string;
  real_name: string;
  phone: string;
  password: string;
  confirm_password: string;
  relationship: string;
}

type RegisterFormErrors = Partial<Record<keyof RegisterFormValues, string>>;

const relationshipOptions = [
  { value: '子女', label: '子女' },
  { value: '配偶', label: '配偶' },
  { value: '兄弟姐妹', label: '兄弟姐妹' },
  { value: '其他', label: '其他' },
];

const initialValues: RegisterFormValues = {
  invite_code: '',
  real_name: '',
  phone: '',
  password: '',
  confirm_password: '',
  relationship: '',
};

const FamilyRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [codeValidation, setCodeValidation] = useState<InviteCodeValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [values, setValues] = useState<RegisterFormValues>(initialValues);
  const [errors, setErrors] = useState<RegisterFormErrors>({});

  const sessionId = useMemo(() => crypto.randomUUID(), []);

  const doValidateCode = useCallback(async (code: string) => {
    if (!code.trim()) {
      setCodeValidation(null);
      return;
    }
    setValidating(true);
    try {
      const res = await validateInviteCode(code.trim());
      setCodeValidation(res.data as InviteCodeValidation);
    } catch {
      setCodeValidation({ valid: false, elder_name: '', remaining_slots: 0 });
    } finally {
      setValidating(false);
    }
  }, []);

  const ensureInviteCodeValid = useCallback(async (code: string) => {
    setValidating(true);
    try {
      const res = await validateInviteCode(code);
      const data = res.data as InviteCodeValidation;
      setCodeValidation(data);
      return data.valid;
    } catch {
      setCodeValidation({ valid: false, elder_name: '', remaining_slots: 0 });
      return false;
    } finally {
      setValidating(false);
    }
  }, []);

  const validateValues = useCallback((nextValues: RegisterFormValues) => {
    const nextErrors: RegisterFormErrors = {};

    if (!nextValues.invite_code.trim()) {
      nextErrors.invite_code = '请输入邀请码';
    }
    if (!nextValues.real_name.trim()) {
      nextErrors.real_name = '请输入姓名';
    }
    if (!nextValues.phone.trim()) {
      nextErrors.phone = '请输入手机号';
    } else if (!/^1\d{10}$/.test(nextValues.phone.trim())) {
      nextErrors.phone = '请输入正确的手机号';
    }
    if (!nextValues.password) {
      nextErrors.password = '请设置密码';
    } else if (nextValues.password.length < 6) {
      nextErrors.password = '密码至少6位';
    }
    if (!nextValues.confirm_password) {
      nextErrors.confirm_password = '请确认密码';
    } else if (nextValues.confirm_password !== nextValues.password) {
      nextErrors.confirm_password = '两次密码不一致';
    }
    if (!nextValues.relationship) {
      nextErrors.relationship = '请选择与老人的关系';
    }

    return nextErrors;
  }, []);

  const updateField = <K extends keyof RegisterFormValues>(key: K, value: RegisterFormValues[K]) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (
        key === 'password'
        && current.confirm_password
        && current.confirm_password !== value
      ) {
        setErrors((previous) => ({
          ...previous,
          confirm_password: '两次密码不一致',
        }));
      }
      return next;
    });
    setErrors((current) => ({
      ...current,
      [key]: '',
    }));
  };

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setValues((current) => ({
        ...current,
        invite_code: code,
      }));
      void doValidateCode(code);
    }
  }, [searchParams, doValidateCode]);

  const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    updateField('invite_code', value);
    if (value.trim().length >= 8) {
      void doValidateCode(value);
    } else {
      setCodeValidation(null);
    }
  };

  const handleCodeBlur = () => {
    const code = values.invite_code;
    if (code.trim()) {
      void doValidateCode(code);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateValues(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const isValid = await ensureInviteCodeValid(values.invite_code.trim());
    if (!isValid) {
      message.error('邀请码无效');
      return;
    }

    setCaptchaVisible(true);
  };

  const handleCaptchaSuccess = async (captchaToken: string) => {
    setCaptchaVisible(false);
    setLoading(true);
    try {
      await registerFamily({
        invite_code: values.invite_code,
        real_name: values.real_name,
        phone: values.phone,
        password: values.password,
        relationship: values.relationship,
        captcha_token: captchaToken,
        session_id: sessionId,
      });
      message.success('注册成功，请登录');
      navigate('/login', { replace: true });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaCancel = () => {
    setCaptchaVisible(false);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 560 }}>
      <Card
        sx={{
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>
                家属注册
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                智慧医养大数据公共服务平台
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2.5}>
                <TextField
                  label="邀请码"
                  value={values.invite_code}
                  onChange={handleCodeChange}
                  onBlur={handleCodeBlur}
                  error={Boolean(errors.invite_code)}
                  helperText={errors.invite_code || ' '}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <KeyRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                {(validating || codeValidation) && (
                  <Alert severity={validating ? 'info' : codeValidation?.valid ? 'success' : 'error'}>
                    {validating
                      ? '验证中...'
                      : codeValidation?.valid
                        ? `关联老人：${codeValidation.elder_name}`
                        : '邀请码无效'}
                  </Alert>
                )}

                <TextField
                  label="姓名"
                  value={values.real_name}
                  onChange={(event) => updateField('real_name', event.target.value)}
                  error={Boolean(errors.real_name)}
                  helperText={errors.real_name || ' '}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutlineRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  label="手机号"
                  value={values.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  error={Boolean(errors.phone)}
                  helperText={errors.phone || ' '}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  label="密码"
                  type="password"
                  value={values.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  error={Boolean(errors.password)}
                  helperText={errors.password || ' '}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  label="确认密码"
                  type="password"
                  value={values.confirm_password}
                  onChange={(event) => updateField('confirm_password', event.target.value)}
                  error={Boolean(errors.confirm_password)}
                  helperText={errors.confirm_password || ' '}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  select
                  label="与老人关系"
                  value={values.relationship}
                  onChange={(event) => updateField('relationship', String(event.target.value))}
                  error={Boolean(errors.relationship)}
                  helperText={errors.relationship || ' '}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <GroupsRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                >
                  <MenuItem value="">
                    <em>请选择与老人的关系</em>
                  </MenuItem>
                  {relationshipOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>

                <Button type="submit" variant="contained" size="large" fullWidth disabled={loading}>
                  {loading ? '注册中...' : '注册'}
                </Button>
              </Stack>
            </Box>

            <Box sx={{ textAlign: 'center', mt: -0.5 }}>
              <Button variant="text" onClick={() => navigate('/login')}>
                返回登录
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <SlideCaptcha
        visible={captchaVisible}
        sessionId={sessionId}
        onSuccess={handleCaptchaSuccess}
        onCancel={handleCaptchaCancel}
      />
    </Box>
  );
};

export default FamilyRegisterPage;
