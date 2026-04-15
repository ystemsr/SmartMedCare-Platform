import React, { useRef, useEffect } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Glass CSS (injected via <style> tag)
// ---------------------------------------------------------------------------
export const glassCSS = `
input[type="password"]::-ms-reveal, input[type="password"]::-ms-clear { display: none !important; }
@property --angle-1 { syntax: "<angle>"; inherits: false; initial-value: -75deg; }
@property --angle-2 { syntax: "<angle>"; inherits: false; initial-value: -45deg; }
.glass-button-wrap { --anim-time: 400ms; --anim-ease: cubic-bezier(0.25, 1, 0.5, 1); --border-width: clamp(1px, 0.0625em, 4px); position: relative; z-index: 2; transform-style: preserve-3d; transition: transform var(--anim-time) var(--anim-ease); }
.glass-button-wrap:has(.glass-button:active) { transform: rotateX(25deg); }
.glass-button-shadow { --shadow-cutoff-fix: 2em; position: absolute; width: calc(100% + var(--shadow-cutoff-fix)); height: calc(100% + var(--shadow-cutoff-fix)); top: calc(0% - var(--shadow-cutoff-fix) / 2); left: calc(0% - var(--shadow-cutoff-fix) / 2); filter: blur(clamp(2px, 0.125em, 12px)); transition: filter var(--anim-time) var(--anim-ease); pointer-events: none; z-index: 0; }
.glass-button-shadow::after { content: ""; position: absolute; inset: 0; border-radius: 9999px; background: linear-gradient(180deg, oklch(from var(--foreground) l c h / 20%), oklch(from var(--foreground) l c h / 10%)); width: calc(100% - var(--shadow-cutoff-fix) - 0.25em); height: calc(100% - var(--shadow-cutoff-fix) - 0.25em); top: calc(var(--shadow-cutoff-fix) - 0.5em); left: calc(var(--shadow-cutoff-fix) - 0.875em); padding: 0.125em; box-sizing: border-box; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease); opacity: 1; }
.glass-button { -webkit-tap-highlight-color: transparent; backdrop-filter: blur(clamp(1px, 0.125em, 4px)); transition: all var(--anim-time) var(--anim-ease); background: linear-gradient(-75deg, oklch(from var(--background) l c h / 5%), oklch(from var(--background) l c h / 20%), oklch(from var(--background) l c h / 5%)); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.25em 0.125em -0.125em oklch(from var(--foreground) l c h / 20%), 0 0 0.1em 0.25em inset oklch(from var(--background) l c h / 20%), 0 0 0 0 oklch(from var(--background) l c h); }
.glass-button:hover { transform: scale(0.975); backdrop-filter: blur(0.01em); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.15em 0.05em -0.1em oklch(from var(--foreground) l c h / 25%), 0 0 0.05em 0.1em inset oklch(from var(--background) l c h / 50%), 0 0 0 0 oklch(from var(--background) l c h); }
.glass-button-text { color: oklch(from var(--foreground) l c h / 90%); text-shadow: 0em 0.25em 0.05em oklch(from var(--foreground) l c h / 10%); transition: all var(--anim-time) var(--anim-ease); }
.glass-button:hover .glass-button-text { text-shadow: 0.025em 0.025em 0.025em oklch(from var(--foreground) l c h / 12%); }
.glass-button-text::after { content: ""; display: block; position: absolute; width: calc(100% - var(--border-width)); height: calc(100% - var(--border-width)); top: calc(0% + var(--border-width) / 2); left: calc(0% + var(--border-width) / 2); box-sizing: border-box; border-radius: 9999px; overflow: clip; background: linear-gradient(var(--angle-2), transparent 0%, oklch(from var(--background) l c h / 50%) 40% 50%, transparent 55%); z-index: 3; mix-blend-mode: screen; pointer-events: none; background-size: 200% 200%; background-position: 0% 50%; transition: background-position calc(var(--anim-time) * 1.25) var(--anim-ease), --angle-2 calc(var(--anim-time) * 1.25) var(--anim-ease); }
.glass-button:hover .glass-button-text::after { background-position: 25% 50%; }
.glass-button:active .glass-button-text::after { background-position: 50% 15%; --angle-2: -15deg; }
.glass-button::after { content: ""; position: absolute; z-index: 1; inset: 0; border-radius: 9999px; width: calc(100% + var(--border-width)); height: calc(100% + var(--border-width)); top: calc(0% - var(--border-width) / 2); left: calc(0% - var(--border-width) / 2); padding: var(--border-width); box-sizing: border-box; background: conic-gradient(from var(--angle-1) at 50% 50%, oklch(from var(--foreground) l c h / 50%) 0%, transparent 5% 40%, oklch(from var(--foreground) l c h / 50%) 50%, transparent 60% 95%, oklch(from var(--foreground) l c h / 50%) 100%), linear-gradient(180deg, oklch(from var(--background) l c h / 50%), oklch(from var(--background) l c h / 50%)); mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease), --angle-1 500ms ease; box-shadow: inset 0 0 0 calc(var(--border-width) / 2) oklch(from var(--background) l c h / 50%); pointer-events: none; }
.glass-button:hover::after { --angle-1: -125deg; }
.glass-button:active::after { --angle-1: -75deg; }
.glass-button-wrap:has(.glass-button:hover) .glass-button-shadow { filter: blur(clamp(2px, 0.0625em, 6px)); }
.glass-button-wrap:has(.glass-button:hover) .glass-button-shadow::after { top: calc(var(--shadow-cutoff-fix) - 0.875em); opacity: 1; }
.glass-button-wrap:has(.glass-button:active) .glass-button-shadow { filter: blur(clamp(2px, 0.125em, 12px)); }
.glass-button-wrap:has(.glass-button:active) .glass-button-shadow::after { top: calc(var(--shadow-cutoff-fix) - 0.5em); opacity: 0.75; }
.glass-button-wrap:has(.glass-button:active) .glass-button-text { text-shadow: 0.025em 0.25em 0.05em oklch(from var(--foreground) l c h / 12%); }
.glass-button-wrap:has(.glass-button:active) .glass-button { box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.125em 0.125em -0.125em oklch(from var(--foreground) l c h / 20%), 0 0 0.1em 0.25em inset oklch(from var(--background) l c h / 20%), 0 0.225em 0.05em 0 oklch(from var(--foreground) l c h / 5%), 0 0.25em 0 0 oklch(from var(--background) l c h / 75%), inset 0 0.25em 0.05em 0 oklch(from var(--foreground) l c h / 15%); }
@media (hover: none) and (pointer: coarse) { .glass-button::after, .glass-button:hover::after, .glass-button:active::after { --angle-1: -75deg; } .glass-button .glass-button-text::after, .glass-button:active .glass-button-text::after { --angle-2: -45deg; } }
.glass-input-wrap { position: relative; z-index: 2; transform-style: preserve-3d; border-radius: 9999px; }
.glass-input { display: flex; position: relative; width: 100%; align-items: center; gap: 0.5rem; border-radius: 9999px; padding: 0.25rem; -webkit-tap-highlight-color: transparent; backdrop-filter: blur(clamp(1px, 0.125em, 4px)); transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1); background: linear-gradient(-75deg, oklch(from var(--background) l c h / 5%), oklch(from var(--background) l c h / 20%), oklch(from var(--background) l c h / 5%)); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.25em 0.125em -0.125em oklch(from var(--foreground) l c h / 20%), 0 0 0.1em 0.25em inset oklch(from var(--background) l c h / 20%), 0 0 0 0 oklch(from var(--background) l c h); }
.glass-input-wrap:focus-within .glass-input { backdrop-filter: blur(0.01em); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.15em 0.05em -0.1em oklch(from var(--foreground) l c h / 25%), 0 0 0.05em 0.1em inset oklch(from var(--background) l c h / 50%), 0 0 0 0 oklch(from var(--background) l c h); }
.glass-input::after { content: ""; position: absolute; z-index: 1; inset: 0; border-radius: 9999px; width: calc(100% + clamp(1px, 0.0625em, 4px)); height: calc(100% + clamp(1px, 0.0625em, 4px)); top: calc(0% - clamp(1px, 0.0625em, 4px) / 2); left: calc(0% - clamp(1px, 0.0625em, 4px) / 2); padding: clamp(1px, 0.0625em, 4px); box-sizing: border-box; background: conic-gradient(from var(--angle-1) at 50% 50%, oklch(from var(--foreground) l c h / 50%) 0%, transparent 5% 40%, oklch(from var(--foreground) l c h / 50%) 50%, transparent 60% 95%, oklch(from var(--foreground) l c h / 50%) 100%), linear-gradient(180deg, oklch(from var(--background) l c h / 50%), oklch(from var(--background) l c h / 50%)); mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1), --angle-1 500ms ease; box-shadow: inset 0 0 0 calc(clamp(1px, 0.0625em, 4px) / 2) oklch(from var(--background) l c h / 50%); pointer-events: none; }
.glass-input-wrap:focus-within .glass-input::after { --angle-1: -125deg; }
.glass-input-text-area { position: absolute; inset: 0; border-radius: 9999px; pointer-events: none; }
.glass-input-text-area::after { content: ""; display: block; position: absolute; width: calc(100% - clamp(1px, 0.0625em, 4px)); height: calc(100% - clamp(1px, 0.0625em, 4px)); top: calc(0% + clamp(1px, 0.0625em, 4px) / 2); left: calc(0% + clamp(1px, 0.0625em, 4px) / 2); box-sizing: border-box; border-radius: 9999px; overflow: clip; background: linear-gradient(var(--angle-2), transparent 0%, oklch(from var(--background) l c h / 50%) 40% 50%, transparent 55%); z-index: 3; mix-blend-mode: screen; pointer-events: none; background-size: 200% 200%; background-position: 0% 50%; transition: background-position calc(400ms * 1.25) cubic-bezier(0.25, 1, 0.5, 1), --angle-2 calc(400ms * 1.25) cubic-bezier(0.25, 1, 0.5, 1); }
.glass-input-wrap:focus-within .glass-input-text-area::after { background-position: 25% 50%; }
`;

// ---------------------------------------------------------------------------
// GlassButton
// ---------------------------------------------------------------------------
const glassButtonVariants = cva(
  'glass-button relative flex items-center justify-center rounded-full cursor-pointer font-medium text-base',
  {
    variants: {
      variant: {
        default: '',
        outline: 'bg-transparent',
      },
      size: {
        default: 'h-12 px-8',
        sm: 'h-10 px-6 text-sm',
        lg: 'h-14 px-10 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, children, disabled, ...props }, ref) => {
    return (
      <div className={cn('glass-button-wrap', disabled && 'pointer-events-none opacity-50')}>
        <div className="glass-button-shadow" />
        <button
          className={cn(glassButtonVariants({ variant, size, className }))}
          ref={ref}
          disabled={disabled}
          {...props}
        >
          <span className="glass-button-text relative z-[2] flex items-center gap-2">
            {children}
          </span>
        </button>
      </div>
    );
  }
);
GlassButton.displayName = 'GlassButton';

// ---------------------------------------------------------------------------
// GlassInput
// ---------------------------------------------------------------------------
export interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, icon, trailing, ...props }, ref) => {
    return (
      <div className="glass-input-wrap">
        <div className="glass-input">
          <div className="glass-input-text-area" />
          {icon && (
            <span className="relative z-[2] ml-3 flex items-center text-muted-foreground">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              'relative z-[2] flex-1 bg-transparent px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground',
              !icon && 'pl-5',
              className
            )}
            {...props}
          />
          {trailing && (
            <span className="relative z-[2] mr-3 flex items-center text-muted-foreground">
              {trailing}
            </span>
          )}
        </div>
      </div>
    );
  }
);
GlassInput.displayName = 'GlassInput';

// ---------------------------------------------------------------------------
// BlurFade
// ---------------------------------------------------------------------------
interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  variant?: {
    hidden: { y: number };
    visible: { y: number };
  };
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
  inViewMargin?: string;
  blur?: string;
}

export function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  yOffset = 6,
  inView = false,
  inViewMargin = '-50px',
  blur = '6px',
}: BlurFadeProps) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin as `${number}px` });
  const isInView = !inView || inViewResult;
  const defaultVariants = variant || {
    hidden: { y: yOffset },
    visible: { y: -yOffset },
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        exit="hidden"
        variants={{
          hidden: {
            ...defaultVariants.hidden,
            opacity: 0,
            filter: `blur(${blur})`,
          },
          visible: {
            ...defaultVariants.visible,
            opacity: 1,
            filter: 'blur(0px)',
          },
        }}
        transition={{
          delay: 0.04 + delay,
          duration,
          ease: 'easeOut',
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// GradientBackground - animated SVG gradient
// ---------------------------------------------------------------------------
export function GradientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="g1" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="transparent" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="0 0; 0.15 0.08; -0.1 0.12; 0 0"
              dur="12s"
              repeatCount="indefinite"
            />
          </radialGradient>
          <radialGradient id="g2" cx="30%" cy="70%" r="50%">
            <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="transparent" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="0 0; -0.1 -0.1; 0.12 -0.06; 0 0"
              dur="15s"
              repeatCount="indefinite"
            />
          </radialGradient>
          <radialGradient id="g3" cx="70%" cy="30%" r="45%">
            <stop offset="0%" stopColor="var(--color-chart-4)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="transparent" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="0 0; 0.08 -0.12; -0.06 0.1; 0 0"
              dur="18s"
              repeatCount="indefinite"
            />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="var(--background)" />
        <rect width="100%" height="100%" fill="url(#g1)" />
        <rect width="100%" height="100%" fill="url(#g2)" />
        <rect width="100%" height="100%" fill="url(#g3)" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GlassStyle - injects the glass CSS via <style> tag
// ---------------------------------------------------------------------------
export function GlassStyle() {
  useEffect(() => {
    const id = 'glass-auth-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = glassCSS;
    document.head.appendChild(style);
    return () => {
      const existing = document.getElementById(id);
      if (existing) existing.remove();
    };
  }, []);
  return null;
}
