import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, getHomeRoute } from '../../store/auth';
import SlideCaptcha from '../../components/SlideCaptcha';
import { message } from '../../utils/message';

interface LoginFormValues {
  username: string;
  password: string;
}

type LoginFormErrors = Partial<Record<keyof LoginFormValues, string>>;

function validateLoginForm(values: LoginFormValues): LoginFormErrors {
  const errors: LoginFormErrors = {};

  if (!values.username.trim()) {
    errors.username = '请输入用户名';
  }
  if (!values.password.trim()) {
    errors.password = '请输入密码';
  }

  return errors;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(false);
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [values, setValues] = useState<LoginFormValues>({ username: '', password: '' });
  const [errors, setErrors] = useState<LoginFormErrors>({});

  const sessionId = useMemo(() => crypto.randomUUID(), []);

  const updateField = <K extends keyof LoginFormValues>(key: K, value: LoginFormValues[K]) => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: '',
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateLoginForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setCaptchaVisible(true);
    }
  };

  const handleCaptchaSuccess = async (captchaToken: string) => {
    setCaptchaVisible(false);
    setLoading(true);
    try {
      await login({
        username: values.username,
        password: values.password,
        captcha_token: captchaToken,
        session_id: sessionId,
      });
      const user = useAuthStore.getState().user;
      const homeRoute = user ? getHomeRoute(user.roles) : '/dashboard';
      message.success('登录成功');
      navigate(homeRoute, { replace: true });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaCancel = () => {
    setCaptchaVisible(false);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 480 }}>
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
                智慧医养大数据公共服务平台
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                医生服务系统
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2.5}>
                <TextField
                  label="用户名"
                  value={values.username}
                  onChange={(event) => updateField('username', event.target.value)}
                  error={Boolean(errors.username)}
                  helperText={errors.username || ' '}
                  autoComplete="username"
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
                  label="密码"
                  type="password"
                  value={values.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  error={Boolean(errors.password)}
                  helperText={errors.password || ' '}
                  autoComplete="current-password"
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <Button type="submit" variant="contained" size="large" fullWidth disabled={loading}>
                  {loading ? '登录中...' : '登录'}
                </Button>
              </Stack>
            </Box>

            <Box sx={{ textAlign: 'center', mt: -0.5 }}>
              <Button variant="text" onClick={() => navigate('/register/family')}>
                家属注册
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

export default LoginPage;
