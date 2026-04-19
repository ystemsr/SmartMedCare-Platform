import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ChevronRight, HeartPulse } from 'lucide-react';
import { Button, Card, CardBody, Chip } from '@/components/ui';

export interface PendingItem {
  key: string;
  kind: 'survey' | 'prediction';
  title: string;
  fields_count: number;
  doctor_name?: string | null;
}

interface Props {
  items: PendingItem[];
  loading?: boolean;
}

const PendingSurveysCard: React.FC<Props> = ({ items, loading }) => {
  return (
    <Card style={{ borderRadius: 18, height: '100%' }}>
      <CardBody style={{ padding: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={22} style={{ color: 'var(--smc-primary)' }} />
            <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--smc-text)' }}>
              待完成任务
            </span>
          </div>
          <Link
            to="/elder/surveys"
            style={{
              fontSize: 13,
              color: 'var(--smc-primary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            查看全部
            <ChevronRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div
            style={{
              padding: '24px 0',
              textAlign: 'center',
              color: 'var(--smc-text-2)',
            }}
          >
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: '32px 0',
              textAlign: 'center',
              color: 'var(--smc-text-2)',
              fontSize: 15,
            }}
          >
            目前没有待完成的任务，继续保持！
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.slice(0, 4).map((task) => (
              <div
                key={task.key}
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: 'var(--smc-surface-alt)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                {task.kind === 'prediction' && (
                  <HeartPulse size={18} style={{ color: 'var(--smc-primary)' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 16,
                      color: 'var(--smc-text)',
                    }}
                  >
                    {task.title}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: 'var(--smc-text-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Chip tone={task.kind === 'prediction' ? 'info' : 'warning'} outlined>
                      {task.kind === 'prediction' ? '健康评估' : '信息采集'}
                    </Chip>
                    <Chip tone="warning" outlined>
                      {task.fields_count} 项待填
                    </Chip>
                    {task.doctor_name && <span>来自：{task.doctor_name}</span>}
                  </div>
                </div>
                <Link to="/elder/surveys" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" size="sm">
                    去填写
                  </Button>
                </Link>
              </div>
            ))}
            {items.length > 4 && (
              <Link
                to="/elder/surveys"
                style={{
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--smc-primary)',
                  textDecoration: 'none',
                  padding: '6px 0',
                }}
              >
                还有 {items.length - 4} 项任务，点击查看
              </Link>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default PendingSurveysCard;
