import React from 'react';
import { motion, type Transition } from 'motion/react';
import { Bell } from 'lucide-react';
import { Card, CardBody, Checkbox } from '@/components/ui';

export interface ReminderItem {
  id: number | string;
  label: string;
  time?: string;
  defaultChecked?: boolean;
}

const getPathAnimate = (isChecked: boolean) => ({
  pathLength: isChecked ? 1 : 0,
  opacity: isChecked ? 1 : 0,
});

const getPathTransition = (isChecked: boolean): Transition => ({
  pathLength: { duration: 0.8, ease: 'easeInOut' },
  opacity: {
    duration: 0.01,
    delay: isChecked ? 0 : 0.8,
  },
});

interface RemindersCardProps {
  items: ReminderItem[];
}

const RemindersCard: React.FC<RemindersCardProps> = ({ items }) => {
  const [checked, setChecked] = React.useState<boolean[]>(() =>
    items.map((i) => !!i.defaultChecked),
  );

  React.useEffect(() => {
    setChecked(items.map((i) => !!i.defaultChecked));
  }, [items]);

  const remaining = checked.filter((c) => !c).length;

  return (
    <Card style={{ borderRadius: 18, height: '100%' }}>
      <CardBody style={{ padding: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={22} style={{ color: '#f59e0b' }} />
            <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--smc-text)' }}>
              今日提醒
            </span>
          </div>
          <span style={{ fontSize: 14, color: 'var(--smc-text-2)' }}>
            {remaining > 0 ? `还有 ${remaining} 项待办` : '今日已全部完成'}
          </span>
        </div>

        {items.length === 0 ? (
          <div
            style={{
              padding: '32px 0',
              textAlign: 'center',
              color: 'var(--smc-text-2)',
              fontSize: 16,
            }}
          >
            暂无提醒
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {items.map((item, idx) => {
              const isChecked = checked[idx];
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: isChecked
                      ? 'color-mix(in oklab, var(--smc-success, #16a34a) 10%, transparent)'
                      : 'var(--smc-surface-alt)',
                    transition: 'background 200ms ease',
                  }}
                >
                  <Checkbox
                    checked={isChecked}
                    onChange={(e) => {
                      const updated = [...checked];
                      updated[idx] = e.target.checked;
                      setChecked(updated);
                    }}
                  />
                  <div style={{ position: 'relative', display: 'inline-block', flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 17,
                        color: 'var(--smc-text)',
                        fontWeight: 500,
                        opacity: isChecked ? 0.55 : 1,
                        transition: 'opacity 200ms ease',
                      }}
                    >
                      {item.label}
                    </span>
                    <motion.svg
                      width="100%"
                      height="32"
                      viewBox="0 0 340 32"
                      preserveAspectRatio="none"
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        zIndex: 2,
                      }}
                    >
                      <motion.path
                        d="M 10 16.91 s 79.8 -11.36 98.1 -11.34 c 22.2 0.02 -47.82 14.25 -33.39 22.02 c 12.61 6.77 124.18 -27.98 133.31 -17.28 c 7.52 8.38 -26.8 20.02 4.61 22.05 c 24.55 1.93 113.37 -20.36 113.37 -20.36"
                        vectorEffect="non-scaling-stroke"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeMiterlimit={10}
                        fill="none"
                        stroke="var(--smc-text)"
                        initial={false}
                        animate={getPathAnimate(isChecked)}
                        transition={getPathTransition(isChecked)}
                      />
                    </motion.svg>
                  </div>
                  {item.time && (
                    <span
                      style={{
                        fontSize: 14,
                        color: 'var(--smc-text-2)',
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}
                    >
                      {item.time}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default RemindersCard;
