import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardBody } from '@/components/ui';
import type { FeatureContribution } from '../../types/bigdata';

interface Props {
  items?: FeatureContribution[] | null;
  title?: string;
}

const FeatureContributions: React.FC<Props> = ({ items, title = '特征归因（与平均值的偏离）' }) => {
  if (!items || items.length === 0) return null;

  return (
    <Card>
      <CardBody>
        <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700, marginBottom: 4 }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 'var(--smc-fs-xs)',
            color: 'var(--smc-text-2)',
            marginBottom: 14,
          }}
        >
          展示当前输入中最偏离人群平均水平的特征，供医生判断哪些因素推动了风险评估。
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => {
            const up = item.direction === 'higher';
            const color = up ? 'var(--smc-warning)' : 'var(--smc-info)';
            const magnitude = Math.min(100, Math.abs(item.z_score) * 25);
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: `color-mix(in oklab, ${color} 8%, transparent)`,
                  borderRadius: 10,
                }}
              >
                {up ? (
                  <ArrowUpRight size={18} style={{ color }} />
                ) : (
                  <ArrowDownRight size={18} style={{ color }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  <div
                    style={{
                      fontSize: 'var(--smc-fs-xs)',
                      color: 'var(--smc-text-2)',
                    }}
                  >
                    输入值 {item.value} · 偏差 Z={item.z_score}（{up ? '高于' : '低于'}平均）
                  </div>
                </div>
                <div
                  style={{
                    width: 80,
                    height: 6,
                    borderRadius: 6,
                    background: 'color-mix(in oklab, var(--smc-border) 40%, transparent)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${magnitude}%`,
                      height: '100%',
                      background: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
};

export default FeatureContributions;
