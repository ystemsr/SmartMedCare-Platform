import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowLeft } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import {
  GlassInput,
  GradientBackground,
  GLASS_STYLES,
} from '@/components/ui/sign-up';
import { useAuthStore, getHomeRoute } from '../../store/auth';
import SlideCaptcha from '../../components/SlideCaptcha';
import { message } from '../../utils/message';
import { AnimatePresence, motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------
type Step = 'username' | 'password';

function validateUsername(v: string) { return v.trim().length > 0; }
function validatePassword(v: string) { return v.trim().length > 0; }

// Shared layout spring for all layout-animated elements
const layoutTransition = { type: 'spring' as const, stiffness: 350, damping: 30, mass: 0.8 };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [step, setStep] = useState<Step>('username');
  const [loading, setLoading] = useState(false);
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const sessionId = useMemo(() => crypto.randomUUID(), []);

  const isUsernameValid = validateUsername(username);
  const isPasswordValid = validatePassword(password);
  const isPasswordStep = step === 'password';

  const handleProgressStep = useCallback(() => {
    if (step === 'username' && isUsernameValid) setStep('password');
  }, [step, isUsernameValid]);

  const handleBack = useCallback(() => {
    setStep('username');
    setPassword('');
    setShowPassword(false);
  }, []);

  const handleUsernameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); handleProgressStep(); }
    },
    [handleProgressStep]
  );

  const handlePasswordKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); if (isPasswordValid) setCaptchaVisible(true); }
    },
    [isPasswordValid]
  );

  React.useEffect(() => {
    if (step === 'password') setTimeout(() => passwordInputRef.current?.focus(), 380);
  }, [step]);

  const handleCaptchaSuccess = useCallback(
    async (captchaToken: string) => {
      setCaptchaVisible(false);
      setLoading(true);
      try {
        await login({ username: username.trim(), password, captcha_token: captchaToken, session_id: sessionId });
        const user = useAuthStore.getState().user;
        const homeRoute = user ? getHomeRoute(user.roles) : '/dashboard';
        message.success('登录成功');
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        navigate(homeRoute, { replace: true });
      } catch (err) {
        message.error(err instanceof Error ? err.message : '登录失败');
      } finally {
        setLoading(false);
      }
    },
    [login, username, password, sessionId, navigate]
  );

  const handleCaptchaCancel = useCallback(() => setCaptchaVisible(false), []);

  return (
    <div className="bg-background min-h-screen w-screen flex flex-col">
      <style>{GLASS_STYLES}</style>

      {/* Brand header */}
      <div className={cn('fixed top-4 left-4 z-20 flex items-center gap-2', 'md:left-1/2 md:-translate-x-1/2')}>
        <img src="/favicon.svg" alt="Logo" className="h-6 w-6" />
        <h1 className="text-base font-bold text-foreground">智慧医养</h1>
      </div>

      {/* Main */}
      <div className={cn('flex w-full flex-1 h-full items-center justify-center bg-card', 'relative overflow-hidden')}>
        <div className="absolute inset-0 z-0">
          <GradientBackground />
        </div>

        <fieldset
          disabled={loading}
          className="relative z-10 w-[340px] mx-auto flex flex-col items-center"
          style={{ marginTop: '-6vh' }}
        >
          {/* ---- Title — crossfade in fixed-height container ---- */}
          <motion.div layout transition={layoutTransition} className="relative w-full" style={{ height: 88 }}>
            <AnimatePresence>
              {step === 'username' && (
                <motion.div
                  key="t-user"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="absolute inset-0 flex flex-col items-center"
                >
                  <motion.p
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.35, delay: 0.08, ease: 'easeOut' }}
                    className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-foreground whitespace-nowrap"
                  >
                    欢迎回来
                  </motion.p>
                  <motion.p
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.35, delay: 0.18, ease: 'easeOut' }}
                    className="mt-3 text-sm font-medium text-muted-foreground"
                  >
                    智慧医养大数据公共服务平台
                  </motion.p>
                </motion.div>
              )}
              {step === 'password' && (
                <motion.div
                  key="t-pass"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="absolute inset-0 flex flex-col items-center text-center"
                >
                  <motion.p
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-foreground whitespace-nowrap"
                  >
                    输入密码
                  </motion.p>
                  <motion.p
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.35, delay: 0.08, ease: 'easeOut' }}
                    className="mt-3 text-sm font-medium text-muted-foreground"
                  >
                    请输入您的密码以继续
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ---- Gap ---- */}
          <div style={{ height: 48 }} />

          {/* ---- Form ---- */}
          <form
            onSubmit={(e) => { e.preventDefault(); if (isPasswordStep && isPasswordValid) setCaptchaVisible(true); }}
            className="w-full flex flex-col items-center"
          >
            {/* Username — always visible, layout-animated for smooth repositioning */}
            <motion.div
              layout
              transition={layoutTransition}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative w-full"
            >
              <AnimatePresence>
                {(username.length > 0 || isPasswordStep) && (
                  <motion.div
                    initial={{ y: -8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute left-4 z-10"
                    style={{ top: -22 }}
                  >
                    <label className="text-xs text-muted-foreground font-semibold">用户名</label>
                  </motion.div>
                )}
              </AnimatePresence>
              <GlassInput
                icon={<User className="h-5 w-5 text-foreground/80 flex-shrink-0" />}
                placeholder="请输入用户名"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleUsernameKeyDown}
                readOnly={isPasswordStep}
                showArrow={isUsernameValid && !isPasswordStep}
                onArrowClick={handleProgressStep}
              />
            </motion.div>

            {/* Password — popLayout so siblings can layout-animate immediately on exit */}
            <AnimatePresence mode="popLayout">
              {isPasswordStep && (
                <motion.div
                  key="pw-section"
                  layout
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="w-full flex flex-col"
                  style={{ marginTop: 32 }}
                >
                  <div className="relative w-full">
                    <AnimatePresence>
                      {password.length > 0 && (
                        <motion.div
                          initial={{ y: -6, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="absolute left-4 z-10"
                          style={{ top: -22 }}
                        >
                          <label className="text-xs text-muted-foreground font-semibold">密码</label>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <GlassInput
                      icon={<Lock className="h-5 w-5 text-foreground/80 flex-shrink-0" />}
                      placeholder="请输入密码"
                      autoComplete="current-password"
                      inputRef={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handlePasswordKeyDown}
                      showArrow={isPasswordValid}
                      onArrowClick={() => setCaptchaVisible(true)}
                      toggleVisibility={() => setShowPassword((v) => !v)}
                      isVisible={showPassword}
                      validForToggle={isPasswordValid}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                    style={{ marginTop: 28 }}
                  >
                    <ArrowLeft className="w-4 h-4" /> 返回
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* ---- Register link — layout-animated so it smoothly follows content changes ---- */}
          <motion.div
            layout
            transition={layoutTransition}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{ marginTop: 48 }}
          >
            <button
              type="button"
              onClick={() => navigate('/register/family')}
              className="text-sm text-foreground/60 hover:text-foreground transition-colors underline underline-offset-4"
            >
              还没有账号？家属注册
            </button>
          </motion.div>
        </fieldset>
      </div>

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
