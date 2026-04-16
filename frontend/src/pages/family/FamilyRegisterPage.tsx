import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  Lock,
  KeyRound,
  User,
  Phone,
  Heart,
  X,
  AlertCircle,
  PartyPopper,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  GlassButton,
  GlassInput,
  BlurFade,
  GradientBackground,
  Confetti,
  GLASS_STYLES,
} from '@/components/ui/sign-up';
import type { ConfettiRef } from '@/components/ui/sign-up';
import SlideCaptcha from '../../components/SlideCaptcha';
import { validateInviteCode, registerFamily } from '../../api/family';
import { useAuthStore, getHomeRoute } from '../../store/auth';
import { setToken } from '../../utils/storage';
import type { InviteCodeValidation } from '../../types/family';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const relationshipOptions = [
  { value: '子女', label: '子女' },
  { value: '配偶', label: '配偶' },
  { value: '兄弟姐妹', label: '兄弟姐妹' },
  { value: '其他', label: '其他' },
];

const LOADING_STEPS = [
  '正在注册...',
  '正在初始化账户...',
  '即将完成...',
];
const STEP_DURATION = 1200; // ms per step

type Step = 'inviteAndName' | 'phoneAndRelation' | 'password';

// ---------------------------------------------------------------------------
// Shared logo
// ---------------------------------------------------------------------------
const BrandLogo = () => (
  <img src="/favicon.svg" alt="Logo" className="h-6 w-6" />
);

// ---------------------------------------------------------------------------
// RelationshipSelect — module-level to avoid re-mount on parent re-render
// ---------------------------------------------------------------------------
interface RelationshipSelectProps {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
}

const RelationshipSelect: React.FC<RelationshipSelectProps> = ({
  value,
  onChange,
  open,
  onToggle,
}) => (
  <div className="relative w-full">
    <AnimatePresence>
      {value && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute -top-6 left-4 z-10"
        >
          <label className="text-xs text-muted-foreground font-semibold">与老人关系</label>
        </motion.div>
      )}
    </AnimatePresence>
    <div className="glass-input-wrap w-full">
      <div className="glass-input cursor-pointer" onClick={onToggle}>
        <span className="glass-input-text-area"></span>
        <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
          <Heart className="h-5 w-5 text-foreground/80 flex-shrink-0" />
        </div>
        <div className="relative z-10 h-full w-0 flex-grow flex items-center py-3 text-foreground">
          {value ? (
            <span>{relationshipOptions.find((o) => o.value === value)?.label}</span>
          ) : (
            <span className="text-foreground/60">请选择与老人的关系</span>
          )}
        </div>
      </div>
    </div>
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="absolute top-full mt-2 left-0 w-full z-30 rounded-xl overflow-hidden border border-border bg-card/90 backdrop-blur-md shadow-lg"
        >
          {relationshipOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'w-full px-4 py-3 text-left text-sm transition-colors hover:bg-accent',
                value === opt.value
                  ? 'text-foreground font-semibold bg-accent/50'
                  : 'text-foreground/80'
              )}
            >
              {opt.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// ---------------------------------------------------------------------------
// ProgressStep — animated step indicator with checkmark
// ---------------------------------------------------------------------------
const ProgressStep: React.FC<{
  label: string;
  state: 'pending' | 'active' | 'done';
  delay?: number;
}> = ({ label, state, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -12 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="flex items-center gap-3"
  >
    <div className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center">
      {state === 'done' ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-7 h-7 rounded-full bg-[#1f9d63] flex items-center justify-center"
        >
          <Check className="w-4 h-4 text-white" strokeWidth={3} />
        </motion.div>
      ) : state === 'active' ? (
        <div className="w-7 h-7 rounded-full border-2 border-[#1f6feb] flex items-center justify-center">
          <motion.div
            className="w-3 h-3 rounded-full bg-[#1f6feb]"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full border-2 border-border" />
      )}
    </div>
    <span
      className={cn(
        'text-sm font-medium transition-colors duration-300',
        state === 'done' && 'text-[#1f9d63]',
        state === 'active' && 'text-foreground',
        state === 'pending' && 'text-muted-foreground/50'
      )}
    >
      {label}
    </span>
  </motion.div>
);

// ---------------------------------------------------------------------------
// ProgressRing — circular progress indicator
// ---------------------------------------------------------------------------
const ProgressRing: React.FC<{ progress: number }> = ({ progress }) => {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - progress * circumference;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="mb-2">
      <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-border" />
      <motion.circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke="#1f6feb"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// StatusModal — module-level
// ---------------------------------------------------------------------------
interface StatusModalProps {
  status: 'closed' | 'loading' | 'error' | 'success';
  errorMessage: string;
  onClose: () => void;
  activeLoadingStep: number;
}

const StatusModal: React.FC<StatusModalProps> = ({ status, errorMessage, onClose, activeLoadingStep }) => (
  <AnimatePresence>
    {status !== 'closed' && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative bg-card/80 border-4 border-border rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-4 mx-4"
        >
          {(status === 'error' || status === 'success') && (
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {status === 'error' && (
            <>
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="text-lg font-medium text-foreground">{errorMessage}</p>
              <GlassButton onClick={onClose} size="sm" className="mt-4">
                重试
              </GlassButton>
            </>
          )}
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-5 w-full">
              <ProgressRing progress={(activeLoadingStep + 1) / LOADING_STEPS.length} />
              <div className="flex flex-col gap-3 w-full pl-4">
                {LOADING_STEPS.map((label, i) => (
                  <ProgressStep
                    key={label}
                    label={label}
                    state={i < activeLoadingStep ? 'done' : i === activeLoadingStep ? 'active' : 'pending'}
                    delay={i * 0.1}
                  />
                ))}
              </div>
            </div>
          )}
          {status === 'success' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-[#1f9d63] flex items-center justify-center"
              >
                <PartyPopper className="w-8 h-8 text-white" />
              </motion.div>
              <p className="text-xl font-semibold text-foreground">注册成功！</p>
              <p className="text-sm text-muted-foreground">正在为您自动登录...</p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ---------------------------------------------------------------------------
// FamilyRegisterPage
// ---------------------------------------------------------------------------
const FamilyRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Form state
  const [inviteCode, setInviteCode] = useState('');
  const [realName, setRealName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<Step>('inviteAndName');
  const [modalStatus, setModalStatus] = useState<'closed' | 'loading' | 'error' | 'success'>('closed');
  const [modalErrorMessage, setModalErrorMessage] = useState('');
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [relationDropdownOpen, setRelationDropdownOpen] = useState(false);

  // Business logic state
  const [codeValidation, setCodeValidation] = useState<InviteCodeValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [activeLoadingStep, setActiveLoadingStep] = useState(0);

  const confettiRef = useRef<ConfettiRef>(null);
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  // Input refs for auto-focus
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Validation helpers
  const isInviteCodeValid = inviteCode.trim().length >= 8;
  const isRealNameValid = realName.trim().length > 0;
  const isStep1Valid = isInviteCodeValid && isRealNameValid && codeValidation?.valid === true;

  const isPhoneValid = /^1\d{10}$/.test(phone);
  const isRelationshipValid = relationship.length > 0;
  const isStep2Valid = isPhoneValid && isRelationshipValid;

  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = confirmPassword.length >= 6;

  // Invite code validation
  const doValidateCode = useCallback(async (code: string) => {
    if (!code || code.trim().length < 8) {
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

  // Auto-fill from URL query
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setInviteCode(code);
      doValidateCode(code);
    }
  }, [searchParams, doValidateCode]);

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInviteCode(value);
      if (value.length >= 8) {
        doValidateCode(value);
      } else {
        setCodeValidation(null);
      }
    },
    [doValidateCode]
  );

  const handleCodeBlur = useCallback(() => {
    if (inviteCode && inviteCode.trim().length > 0) {
      doValidateCode(inviteCode);
    }
  }, [inviteCode, doValidateCode]);

  const fireSideCanons = useCallback(() => {
    const fire = confettiRef.current?.fire;
    if (fire) {
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
      const particleCount = 50;
      fire({ ...defaults, particleCount, origin: { x: 0, y: 1 }, angle: 60 });
      fire({ ...defaults, particleCount, origin: { x: 1, y: 1 }, angle: 120 });
    }
  }, []);

  // Step navigation
  const handleProgressStep = useCallback(() => {
    if (step === 'inviteAndName' && isStep1Valid) {
      setStep('phoneAndRelation');
    } else if (step === 'phoneAndRelation' && isStep2Valid) {
      setStep('password');
    }
  }, [step, isStep1Valid, isStep2Valid]);

  const handleGoBack = useCallback(() => {
    if (step === 'password') {
      setStep('phoneAndRelation');
      setPassword('');
      setConfirmPassword('');
    } else if (step === 'phoneAndRelation') {
      setStep('inviteAndName');
    }
  }, [step]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (step === 'password' && isPasswordValid && isConfirmPasswordValid) {
          if (password !== confirmPassword) {
            setModalErrorMessage('两次密码不一致');
            setModalStatus('error');
          } else {
            setCaptchaVisible(true);
          }
        } else {
          handleProgressStep();
        }
      }
    },
    [step, isPasswordValid, isConfirmPasswordValid, password, confirmPassword, handleProgressStep]
  );

  // Final submit triggers captcha
  const handleFinalSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (step !== 'password') return;
      if (!isPasswordValid || !isConfirmPasswordValid) return;

      if (password !== confirmPassword) {
        setModalErrorMessage('两次密码不一致');
        setModalStatus('error');
        return;
      }

      setCaptchaVisible(true);
    },
    [step, isPasswordValid, isConfirmPasswordValid, password, confirmPassword]
  );

  const handleCaptchaSuccess = useCallback(
    async (captchaToken: string) => {
      setCaptchaVisible(false);
      setModalStatus('loading');
      setActiveLoadingStep(0);

      try {
        // Step through loading animation while registering
        const stepTimer = setInterval(() => {
          setActiveLoadingStep((prev) => {
            if (prev < LOADING_STEPS.length - 1) return prev + 1;
            clearInterval(stepTimer);
            return prev;
          });
        }, STEP_DURATION);

        const res = await registerFamily({
          invite_code: inviteCode.trim(),
          real_name: realName.trim(),
          phone: phone.trim(),
          password,
          relationship,
          captcha_token: captchaToken,
          session_id: sessionId,
        });

        // Ensure all loading steps have animated through
        clearInterval(stepTimer);
        setActiveLoadingStep(LOADING_STEPS.length - 1);

        // Auto-login: use the access_token returned by register
        const accessToken = res.data?.access_token;
        if (accessToken) {
          setToken(accessToken);
          useAuthStore.setState({ token: accessToken });
          await fetchUser();
        }

        // Show success after a brief moment for the last step to animate
        setTimeout(() => {
          fireSideCanons();
          setModalStatus('success');

          // Navigate to family home
          setTimeout(() => {
            const user = useAuthStore.getState().user;
            const home = getHomeRoute(user?.roles || []);
            navigate(home, { replace: true });
          }, 1500);
        }, STEP_DURATION);
      } catch (err) {
        setModalErrorMessage(err instanceof Error ? err.message : '注册失败');
        setModalStatus('error');
      }
    },
    [inviteCode, realName, phone, password, relationship, sessionId, fireSideCanons, navigate, fetchUser]
  );

  const handleCaptchaCancel = useCallback(() => {
    setCaptchaVisible(false);
  }, []);

  const closeModal = useCallback(() => {
    setModalStatus('closed');
    setModalErrorMessage('');
  }, []);

  const handleRelationChange = useCallback((value: string) => {
    setRelationship(value);
    setRelationDropdownOpen(false);
  }, []);

  const handleRelationToggle = useCallback(() => {
    setRelationDropdownOpen((v) => !v);
  }, []);

  // Auto-focus on step change
  useEffect(() => {
    if (step === 'phoneAndRelation') setTimeout(() => phoneInputRef.current?.focus(), 500);
    else if (step === 'password') setTimeout(() => passwordInputRef.current?.focus(), 500);
  }, [step]);

  useEffect(() => {
    if (modalStatus === 'success') {
      fireSideCanons();
    }
  }, [modalStatus, fireSideCanons]);

  return (
    <div className="bg-background min-h-screen w-screen flex flex-col">
      <style>{GLASS_STYLES}</style>

      <Confetti
        ref={confettiRef}
        manualstart
        className="fixed top-0 left-0 w-full h-full pointer-events-none z-[999]"
      />
      <StatusModal status={modalStatus} errorMessage={modalErrorMessage} onClose={closeModal} activeLoadingStep={activeLoadingStep} />

      {/* Brand header */}
      <div
        className={cn(
          'fixed top-4 left-4 z-20 flex items-center gap-2',
          'md:left-1/2 md:-translate-x-1/2'
        )}
      >
        <BrandLogo />
        <h1 className="text-base font-bold text-foreground">智慧医养</h1>
      </div>

      <div
        className={cn(
          'flex w-full flex-1 h-full items-center justify-center bg-card',
          'relative overflow-hidden'
        )}
      >
        <div className="absolute inset-0 z-0">
          <GradientBackground />
        </div>
        <fieldset
          disabled={modalStatus !== 'closed'}
          className="relative z-10 flex flex-col items-center gap-8 w-full max-w-[440px] mx-auto px-5 sm:px-4 py-4"
        >
          {/* Step titles */}
          <AnimatePresence mode="wait">
            {step === 'inviteAndName' && (
              <motion.div
                key="step1-title"
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="w-full flex flex-col items-center gap-4"
              >
                <BlurFade delay={0.25} className="w-full">
                  <div className="text-center">
                    <p className="font-serif font-light text-3xl sm:text-4xl md:text-5xl tracking-tight text-foreground whitespace-nowrap">
                      家属注册
                    </p>
                  </div>
                </BlurFade>
                <BlurFade delay={0.5}>
                  <p className="text-sm font-medium text-muted-foreground">
                    智慧医养大数据公共服务平台
                  </p>
                </BlurFade>
              </motion.div>
            )}
            {step === 'phoneAndRelation' && (
              <motion.div
                key="step2-title"
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="w-full flex flex-col items-center text-center gap-4"
              >
                <BlurFade delay={0} className="w-full">
                  <div className="text-center">
                    <p className="font-serif font-light text-3xl sm:text-4xl md:text-5xl tracking-tight text-foreground whitespace-nowrap">
                      联系方式
                    </p>
                  </div>
                </BlurFade>
                <BlurFade delay={0.25}>
                  <p className="text-sm font-medium text-muted-foreground">
                    请填写您的手机号和与老人的关系
                  </p>
                </BlurFade>
              </motion.div>
            )}
            {step === 'password' && (
              <motion.div
                key="step3-title"
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="w-full flex flex-col items-center text-center gap-4"
              >
                <BlurFade delay={0} className="w-full">
                  <div className="text-center">
                    <p className="font-serif font-light text-3xl sm:text-4xl md:text-5xl tracking-tight text-foreground whitespace-nowrap">
                      设置密码
                    </p>
                  </div>
                </BlurFade>
                <BlurFade delay={0.25}>
                  <p className="text-sm font-medium text-muted-foreground">
                    密码至少6位，请妥善保管
                  </p>
                </BlurFade>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleFinalSubmit} className="w-full flex flex-col gap-6">
            <AnimatePresence mode="wait">
              {/* Step 1: Invite code + Real name */}
              {step === 'inviteAndName' && (
                <motion.div
                  key="step1-fields"
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="w-full flex flex-col gap-8"
                >
                  <BlurFade delay={0.25 * 3} inView className="w-full">
                    <div className="relative w-full">
                      <AnimatePresence>
                        {inviteCode.length > 0 && (
                          <motion.div
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="absolute -top-6 left-4 z-10"
                          >
                            <label className="text-xs text-muted-foreground font-semibold">
                              邀请码
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <GlassInput
                        icon={<KeyRound className="h-5 w-5 text-foreground/80 flex-shrink-0" />}
                        placeholder="请输入邀请码"
                        value={inviteCode}
                        onChange={handleCodeChange}
                        onBlur={handleCodeBlur}
                        onKeyDown={handleKeyDown}
                      />
                      {(validating || codeValidation) && (
                        <div className="mt-2 ml-4 text-xs">
                          {validating && (
                            <span className="text-muted-foreground">验证中...</span>
                          )}
                          {!validating && codeValidation?.valid && (
                            <span className="text-green-500">
                              关联老人：{codeValidation.elder_name}
                            </span>
                          )}
                          {!validating && codeValidation && !codeValidation.valid && (
                            <span className="text-destructive">邀请码无效</span>
                          )}
                        </div>
                      )}
                    </div>
                  </BlurFade>

                  <BlurFade delay={0.25 * 4} inView className="w-full">
                    <div className="relative w-full">
                      <AnimatePresence>
                        {realName.length > 0 && (
                          <motion.div
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="absolute -top-6 left-4 z-10"
                          >
                            <label className="text-xs text-muted-foreground font-semibold">
                              姓名
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <GlassInput
                        icon={<User className="h-5 w-5 text-foreground/80 flex-shrink-0" />}
                        placeholder="请输入姓名"
                        value={realName}
                        onChange={(e) => setRealName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        showArrow={isStep1Valid}
                        onArrowClick={handleProgressStep}
                      />
                    </div>
                  </BlurFade>
                </motion.div>
              )}

              {/* Step 2: Phone + Relationship */}
              {step === 'phoneAndRelation' && (
                <motion.div
                  key="step2-fields"
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="w-full flex flex-col gap-8"
                >
                  <BlurFade delay={0} inView className="w-full">
                    <div className="relative w-full">
                      <AnimatePresence>
                        {phone.length > 0 && (
                          <motion.div
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="absolute -top-6 left-4 z-10"
                          >
                            <label className="text-xs text-muted-foreground font-semibold">
                              手机号
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <GlassInput
                        icon={<Phone className="h-5 w-5 text-foreground/80 flex-shrink-0" />}
                        placeholder="请输入手机号"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={handleKeyDown}
                        inputRef={phoneInputRef}
                      />
                    </div>
                  </BlurFade>

                  <BlurFade delay={0.15} inView className="w-full">
                    <RelationshipSelect
                      value={relationship}
                      onChange={handleRelationChange}
                      open={relationDropdownOpen}
                      onToggle={handleRelationToggle}
                    />
                  </BlurFade>

                  <BlurFade delay={0.3} inView className="w-full">
                    <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleGoBack}
                        className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" /> 上一步
                      </button>
                      <div
                        className={cn(
                          'transition-all duration-300 ease-in-out w-full sm:w-auto',
                          isStep2Valid ? 'opacity-100' : 'opacity-40 pointer-events-none'
                        )}
                      >
                        <GlassButton type="button" onClick={handleProgressStep} size="sm" className="w-full sm:w-auto">
                          <span className="flex items-center justify-center gap-2">
                            下一步 <ArrowRight className="w-4 h-4" />
                          </span>
                        </GlassButton>
                      </div>
                    </div>
                  </BlurFade>
                </motion.div>
              )}

              {/* Step 3: Password + Confirm password */}
              {step === 'password' && (
                <motion.div
                  key="step3-fields"
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="w-full flex flex-col gap-8"
                >
                  <BlurFade delay={0} inView className="w-full">
                    <div className="relative w-full">
                      <AnimatePresence>
                        {password.length > 0 && (
                          <motion.div
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="absolute -top-6 left-4 z-10"
                          >
                            <label className="text-xs text-muted-foreground font-semibold">
                              密码
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <GlassInput
                        icon={<Lock className="h-5 w-5 text-foreground/80 flex-shrink-0" />}
                        placeholder="请设置密码（至少6位）"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        type={showPassword ? 'text' : 'password'}
                        inputRef={passwordInputRef}
                        toggleVisibility={() => setShowPassword((v) => !v)}
                        isVisible={showPassword}
                        validForToggle={isPasswordValid}
                      />
                    </div>
                  </BlurFade>

                  <BlurFade delay={0.15} inView className="w-full">
                    <div className="relative w-full">
                      <AnimatePresence>
                        {confirmPassword.length > 0 && (
                          <motion.div
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="absolute -top-6 left-4 z-10"
                          >
                            <label className="text-xs text-muted-foreground font-semibold">
                              确认密码
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <GlassInput
                        icon={<Lock className="h-5 w-5 text-foreground/80 flex-shrink-0" />}
                        placeholder="请确认密码"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        type={showConfirmPassword ? 'text' : 'password'}
                        showArrow={isConfirmPasswordValid}
                        onArrowClick={() =>
                          handleFinalSubmit({ preventDefault: () => {} } as React.FormEvent)
                        }
                        toggleVisibility={() => setShowConfirmPassword((v) => !v)}
                        isVisible={showConfirmPassword}
                        validForToggle={isConfirmPasswordValid}
                      />
                    </div>
                  </BlurFade>

                  <BlurFade delay={0.3} inView className="w-full">
                    <button
                      type="button"
                      onClick={handleGoBack}
                      className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> 上一步
                    </button>
                  </BlurFade>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Login link */}
          <BlurFade delay={0.25 * 5} inView>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-foreground/60 hover:text-foreground transition-colors underline underline-offset-4"
            >
              已有账号？返回登录
            </button>
          </BlurFade>
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

export default FamilyRegisterPage;
