import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createCaptchaChallenge, verifyCaptchaChallenge } from '../api/auth';
import type { CaptchaChallengeResponse, TrajectoryPoint } from '../types/auth';

interface SlideCaptchaProps {
  visible: boolean;
  sessionId: string;
  onSuccess: (captchaToken: string) => void;
  onCancel: () => void;
}

const ORIGINAL_WIDTH = 320;

const SlideCaptcha: React.FC<SlideCaptchaProps> = ({
  visible,
  sessionId,
  onSuccess,
  onCancel,
}) => {
  const [challenge, setChallenge] = useState<CaptchaChallengeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shaking, setShaking] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const trajectoryRef = useRef<TrajectoryPoint[]>([]);
  const dragStartXRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const getDisplayWidth = useCallback(() => {
    const maxWidth = Math.min(window.innerWidth - 68, ORIGINAL_WIDTH);
    return Math.max(maxWidth, 200);
  }, []);

  const [displayWidth, setDisplayWidth] = useState(getDisplayWidth);

  useEffect(() => {
    const handleResize = () => setDisplayWidth(getDisplayWidth());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getDisplayWidth]);

  const ratio = challenge ? displayWidth / challenge.width : 1;
  const displayHeight = challenge ? challenge.height * ratio : 0;

  const loadChallenge = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setErrorMsg('');
    setDragOffset(0);
    try {
      const res = await createCaptchaChallenge(sessionId);
      setChallenge(res.data);
    } catch {
      setErrorMsg('验证码加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (visible) {
      loadChallenge();
    } else {
      setChallenge(null);
      setDragOffset(0);
      setErrorMsg('');
    }
  }, [visible, loadChallenge]);

  const handleVerify = useCallback(
    async (offsetX: number) => {
      if (!challenge) return;
      setVerifying(true);
      setErrorMsg('');

      const scaledX = Math.round(offsetX / ratio);
      const scaledY = challenge.thumb_y;
      const scaledTrajectory = trajectoryRef.current.map((p) => ({
        x: Math.round(p.x / ratio),
        t: p.t,
      }));

      try {
        const res = await verifyCaptchaChallenge({
          session_id: sessionId,
          challenge_id: challenge.challenge_id,
          x: scaledX,
          y: scaledY,
          trajectory: scaledTrajectory,
        });
        onSuccess(res.data.captcha_token);
      } catch {
        setErrorMsg('验证失败，请重试');
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setDragOffset(0);
          loadChallenge();
        }, 600);
      } finally {
        setVerifying(false);
      }
    },
    [challenge, ratio, sessionId, onSuccess, loadChallenge],
  );

  const handleDragStart = useCallback(
    (clientX: number) => {
      if (loading || verifying) return;
      setDragging(true);
      dragStartXRef.current = clientX;
      dragStartTimeRef.current = Date.now();
      trajectoryRef.current = [{ x: 0, t: 0 }];
    },
    [loading, verifying],
  );

  const trackWidth = displayWidth;
  const handleSize = 40;
  const maxOffset = trackWidth - handleSize;

  const handleDragMove = useCallback(
    (clientX: number) => {
      if (!dragging) return;
      const dx = clientX - dragStartXRef.current;
      const clamped = Math.max(0, Math.min(dx, maxOffset));
      setDragOffset(clamped);
      trajectoryRef.current.push({
        x: clamped,
        t: Date.now() - dragStartTimeRef.current,
      });
    },
    [dragging, maxOffset],
  );

  const handleDragEnd = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    if (dragOffset > 5) {
      handleVerify(dragOffset);
    } else {
      setDragOffset(0);
    }
  }, [dragging, dragOffset, handleVerify]);

  // Mouse events on document for smooth dragging
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const onUp = () => handleDragEnd();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging, handleDragMove, handleDragEnd]);

  // Touch events on document for smooth dragging
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      handleDragMove(e.touches[0].clientX);
    };
    const onEnd = () => handleDragEnd();
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    return () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [dragging, handleDragMove, handleDragEnd]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  if (!visible) return null;

  const thumbDisplayWidth = challenge ? challenge.thumb_width * ratio : 0;
  const thumbDisplayHeight = challenge ? challenge.thumb_height * ratio : 0;
  const thumbDisplayY = challenge ? challenge.thumb_y * ratio : 0;

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <style>{keyframesCSS}</style>
      <div
        ref={containerRef}
        style={{
          ...styles.dialog,
          animation: shaking ? 'slideCaptchaShake 0.4s ease' : undefined,
        }}
      >
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>登录安全验证</div>
            <div style={styles.hint}>请完成滑块验证以继续登录</div>
          </div>
          <div style={styles.headerActions}>
            <button
              style={styles.iconBtn}
              onClick={loadChallenge}
              title="刷新验证码"
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
            <button
              style={styles.iconBtn}
              onClick={onCancel}
              title="关闭"
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Image area */}
        <div
          style={{
            ...styles.imageArea,
            width: displayWidth,
            height: displayHeight,
          }}
        >
          {challenge && (
            <>
              <img
                src={challenge.image}
                alt="captcha background"
                style={{
                  width: displayWidth,
                  height: displayHeight,
                  display: 'block',
                  borderRadius: 8,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />
              <img
                src={challenge.thumb}
                alt="puzzle piece"
                style={{
                  position: 'absolute',
                  left: dragOffset,
                  top: thumbDisplayY,
                  width: thumbDisplayWidth,
                  height: thumbDisplayHeight,
                  userSelect: 'none',
                  pointerEvents: 'none',
                  filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))',
                }}
                draggable={false}
              />
            </>
          )}

          {/* Loading overlay */}
          {(loading || verifying) && (
            <div style={styles.loadingOverlay}>
              <div style={styles.spinner} />
              <div style={{ marginTop: 8, color: '#fff', fontSize: 13 }}>
                {loading ? '加载中...' : '验证中...'}
              </div>
            </div>
          )}

          {/* Error toast */}
          {errorMsg && (
            <div style={styles.errorToast}>{errorMsg}</div>
          )}
        </div>

        {/* Slider track */}
        <div
          style={{
            ...styles.sliderTrack,
            width: displayWidth,
          }}
        >
          {/* Filled portion */}
          <div
            style={{
              ...styles.sliderFill,
              width: dragOffset + handleSize / 2,
            }}
          />

          {/* Hint text */}
          {!dragging && dragOffset === 0 && (
            <div style={styles.sliderHint}>向右滑动完成验证</div>
          )}

          {/* Draggable handle */}
          <div
            style={{
              ...styles.sliderHandle,
              left: dragOffset,
              cursor: loading || verifying ? 'not-allowed' : 'grab',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              handleDragStart(e.clientX);
            }}
            onTouchStart={(e) => {
              handleDragStart(e.touches[0].clientX);
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1677ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

const keyframesCSS = `
@keyframes slideCaptchaShake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-8px); }
  30% { transform: translateX(8px); }
  45% { transform: translateX(-6px); }
  60% { transform: translateX(6px); }
  75% { transform: translateX(-3px); }
  90% { transform: translateX(3px); }
}
@keyframes slideCaptchaSpin {
  to { transform: rotate(360deg); }
}
`;

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    background: 'rgba(15,23,42,0.42)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: 'min(100%, 420px)',
    borderRadius: 16,
    background: '#fff',
    boxShadow: '0 18px 52px rgba(15,23,42,0.28)',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1e293b',
    lineHeight: '24px',
  },
  hint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  headerActions: {
    display: 'flex',
    gap: 4,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8,
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  },
  imageArea: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
    background: '#f1f5f9',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(15,23,42,0.5)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  spinner: {
    width: 28,
    height: 28,
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'slideCaptchaSpin 0.7s linear infinite',
  },
  errorToast: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#ef4444',
    color: '#fff',
    fontSize: 13,
    padding: '6px 16px',
    borderRadius: 6,
    whiteSpace: 'nowrap',
  },
  sliderTrack: {
    position: 'relative',
    height: 40,
    marginTop: 12,
    borderRadius: 20,
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    userSelect: 'none',
  },
  sliderFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 20,
    background: 'linear-gradient(90deg, #dbeafe, #93c5fd)',
    transition: 'none',
  },
  sliderHint: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    color: '#94a3b8',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  sliderHandle: {
    position: 'absolute',
    top: 0,
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    userSelect: 'none',
    touchAction: 'none',
  },
};

export default SlideCaptcha;
