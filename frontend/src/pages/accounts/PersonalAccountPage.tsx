import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
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

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            个人信息
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            {[
              ['用户名', user?.username || '-'],
              ['姓名', user?.real_name || '-'],
              ['手机号', user?.phone || '-'],
              ['邮箱', user?.email || '-'],
              ['角色', user?.roles?.join(', ') || '-'],
            ].map(([label, value]) => (
              <Box key={label as string} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                <Typography variant="body2" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 600 }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            修改密码
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            密码至少 6 个字符，确认新密码需保持一致。
          </Typography>

          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleChangePassword(values);
            }}
            noValidate
            sx={{ maxWidth: 440 }}
          >
            <Stack spacing={2.25}>
              <TextField
                label="当前密码"
                type="password"
                value={values.old_password}
                onChange={(event) => updateField('old_password', event.target.value)}
                error={Boolean(errors.old_password)}
                helperText={errors.old_password || ' '}
                fullWidth
              />

              <Divider />

              <TextField
                label="新密码"
                type="password"
                value={values.new_password}
                onChange={(event) => updateField('new_password', event.target.value)}
                error={Boolean(errors.new_password)}
                helperText={errors.new_password || ' '}
                fullWidth
              />

              <TextField
                label="确认新密码"
                type="password"
                value={values.confirm_password}
                onChange={(event) => updateField('confirm_password', event.target.value)}
                error={Boolean(errors.confirm_password)}
                helperText={errors.confirm_password || ' '}
                fullWidth
              />

              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? '修改中...' : '修改密码'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default PersonalAccountPage;
