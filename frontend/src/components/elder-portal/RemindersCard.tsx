import React from 'react';
import { motion } from 'motion/react';
import { Bell } from 'lucide-react';
import { Card, CardBody, Checkbox } from '@/components/ui';

export interface ReminderItem {
  id: number | string;
  label: string;
  time?: string;
  defaultChecked?: boolean;
}

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
                  <div
                    style={{
                      position: 'relative',
                      flex: 1,
                      minWidth: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        position: 'relative',
                        fontSize: 17,
                        color: 'var(--smc-text)',
                        fontWeight: 500,
                        opacity: isChecked ? 0.55 : 1,
                        transition: 'opacity 200ms ease',
                      }}
                    >
                      {item.label}
                      <motion.span
                        aria-hidden
                        initial={false}
                        animate={{ scaleX: isChecked ? 1 : 0 }}
                        transition={{ duration: 0.45, ease: 'easeInOut' }}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: '50%',
                          height: 2,
                          borderRadius: 2,
                          background: 'var(--smc-text)',
                          transformOrigin: 'left center',
                          pointerEvents: 'none',
                        }}
                      />
                    </span>
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
