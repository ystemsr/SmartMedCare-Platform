import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Activity } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import {
  GlassButton,
  GlassInput,
  GlassStyle,
  GradientBackground,
  BlurFade,
} from '@/components/ui/glass-auth';
import { useAuthStore, getHomeRoute } from '../../store/auth';
import SlideCaptcha from '../../components/SlideCaptcha';
import { message } from '../../utils/message';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LoginFormValues {
  username: string;
  password: string;
}

type LoginFormErrors = Partial<Record<keyof LoginFormValues, string>>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validateUsername(username: string): string | undefined {
  if (!username.trim()) return '请输入用户名';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password.trim()) return '请输入密码';
  return undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [values, setValues] = useState<LoginFormValues>({ username: '', password: '' });
  const [errors, setErrors] = useState<LoginFormErrors>({});

  const sessionId = useMemo(() => crypto.randomUUID(), []);

  // ---- field helpers ----
  const updateField = useCallback(
    <K extends keyof LoginFormValues>(key: K, value: LoginFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    []
  );

  // ---- step 1: submit username ----
  const handleUsernameSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const err = validateUsername(values.username);
      if (err) {
        setErrors({ username: err });
        return;
      }
      setStep(2);
    },
    [values.username]
  );

  // ---- step 2: submit password -> show captcha ----
  const handlePasswordSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const err = validatePassword(values.password);
      if (err) {
        setErrors({ password: err });
        return;
      }
      setCaptchaVisible(true);
    },
    [values.password]
  );

  // ---- captcha success -> login ----
  const handleCaptchaSuccess = useCallback(
    async (captchaToken: string) => {
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

        // Fire confetti
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
        });

        navigate(homeRoute, { replace: true });
      } catch (err) {
        message.error(err instanceof Error ? err.message : '登录失败');
      } finally {
        setLoading(false);
      }
    },
    [login, values, sessionId, navigate]
  );

  const handleCaptchaCancel = useCallback(() => {
    setCaptchaVisible(false);
  }, []);

  const handleBack = useCallback(() => {
    setStep(1);
    setErrors({});
  }, []);

  // ---- render ----
  return (
    <div className="bg-background min-h-screen w-screen flex flex-col">
      <GlassStyle />
      <GradientBackground />

      {/* Brand header */}
      <BlurFade delay={0}>
        <header className="flex items-center gap-3 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)]">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">智慧医养</span>
        </header>
      </BlurFade>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          {step === 1 && (
            <form onSubmit={handleUsernameSubmit} noValidate>
              <BlurFade delay={0.05}>
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                  欢迎回来
                </h1>
              </BlurFade>

              <BlurFade delay={0.1}>
                <p className="mt-2 text-base text-muted-foreground">
                  智慧医养大数据公共服务平台 &mdash; 请输入用户名继续
                </p>
              </BlurFade>

              <BlurFade delay={0.15}>
                <div className="mt-8">
                  <GlassInput
                    type="text"
                    placeholder="用户名"
                    autoComplete="username"
                    autoFocus
                    value={values.username}
                    onChange={(e) => updateField('username', e.target.value)}
                    icon={<User className="h-5 w-5" />}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUsernameSubmit(e);
                    }}
                  />
                  {errors.username && (
                    <p className="mt-2 pl-5 text-sm text-[var(--color-destructive)]">
                      {errors.username}
                    </p>
                  )}
                </div>
              </BlurFade>

              <BlurFade delay={0.2}>
                <div className="mt-6">
                  <GlassButton type="submit" className="w-full">
                    继续
                    <ArrowRight className="h-4 w-4" />
                  </GlassButton>
                </div>
              </BlurFade>

              <BlurFade delay={0.25}>
                <p className="mt-8 text-center text-sm text-muted-foreground">
                  还没有账号？{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/register/family')}
                    className="font-medium text-[var(--color-primary)] underline-offset-4 hover:underline"
                  >
                    家属注册
                  </button>
                </p>
              </BlurFade>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handlePasswordSubmit} noValidate>
              <BlurFade delay={0.05}>
                <button
                  type="button"
                  onClick={handleBack}
                  className={cn(
                    'mb-6 flex items-center gap-1 text-sm text-muted-foreground',
                    'transition-colors hover:text-foreground'
                  )}
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回
                </button>
              </BlurFade>

              <BlurFade delay={0.1}>
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                  输入密码
                </h1>
              </BlurFade>

              <BlurFade delay={0.15}>
                <p className="mt-2 text-base text-muted-foreground">
                  请输入您的密码
                </p>
              </BlurFade>

              <BlurFade delay={0.2}>
                <div className="mt-8">
                  <GlassInput
                    type={showPassword ? 'text' : 'password'}
                    placeholder="密码"
                    autoComplete="current-password"
                    autoFocus
                    value={values.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    icon={<Lock className="h-5 w-5" />}
                    trailing={
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="cursor-pointer p-1 transition-colors hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePasswordSubmit(e);
                    }}
                  />
                  {errors.password && (
                    <p className="mt-2 pl-5 text-sm text-[var(--color-destructive)]">
                      {errors.password}
                    </p>
                  )}
                </div>
              </BlurFade>

              <BlurFade delay={0.25}>
                <div className="mt-6">
                  <GlassButton type="submit" className="w-full" disabled={loading}>
                    {loading ? '登录中...' : '登录'}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </GlassButton>
                </div>
              </BlurFade>

              <BlurFade delay={0.3}>
                <p className="mt-8 text-center text-sm text-muted-foreground">
                  还没有账号？{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/register/family')}
                    className="font-medium text-[var(--color-primary)] underline-offset-4 hover:underline"
                  >
                    家属注册
                  </button>
                </p>
              </BlurFade>
            </form>
          )}
        </div>
      </main>

      <SlideCaptcha
        visible={captchaVisible}
        sessionId={sessionId}
        onSuccess={handleCaptchaSuccess}
        onCancel={handleCaptchaCancel}
      />
    </div>
  );
};

export default LoginPage;
