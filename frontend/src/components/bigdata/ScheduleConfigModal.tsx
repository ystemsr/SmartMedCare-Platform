import React, { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Switch } from '@/components/ui';
import { updatePipelineSchedule } from '../../api/bigdata';
import { message } from '../../utils/message';
import type { PipelineSchedule } from '../../types/bigdata';

interface Props {
  open: boolean;
  onClose: () => void;
  schedule: PipelineSchedule;
  onSaved: () => void;
}

/** Convert a UTC "HH:MM" to the device-local "HH:MM" for display. */
function utcToLocalHHMM(utcHHMM: string): string {
  const parts = (utcHHMM || '').split(':');
  if (parts.length !== 2) return '03:00';
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '03:00';
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  const lh = String(d.getHours()).padStart(2, '0');
  const lm = String(d.getMinutes()).padStart(2, '0');
  return `${lh}:${lm}`;
}

/** Convert a device-local "HH:MM" to UTC "HH:MM" for storage. */
function localToUtcHHMM(localHHMM: string): string {
  const parts = localHHMM.split(':');
  if (parts.length !== 2) return localHHMM;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return localHHMM;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  const uh = String(d.getUTCHours()).padStart(2, '0');
  const um = String(d.getUTCMinutes()).padStart(2, '0');
  return `${uh}:${um}`;
}

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时区';
  } catch {
    return '本地时区';
  }
}

const ScheduleConfigModal: React.FC<Props> = ({ open, onClose, schedule, onSaved }) => {
  const [enabled, setEnabled] = useState(schedule.enabled);
  const [localTime, setLocalTime] = useState(() => utcToLocalHHMM(schedule.utc_time));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEnabled(schedule.enabled);
      setLocalTime(utcToLocalHHMM(schedule.utc_time));
    }
  }, [open, schedule.enabled, schedule.utc_time]);

  const tzLabel = useMemo(deviceTimezone, []);
  const previewUtc = useMemo(() => localToUtcHHMM(localTime), [localTime]);

  const handleSave = async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) {
      message.warning('请输入有效的时间（HH:MM）');
      return;
    }
    setSaving(true);
    try {
      await updatePipelineSchedule({
        enabled,
        utc_time: localToUtcHHMM(localTime),
      });
      message.success('已更新自动刷新配置');
      onSaved();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="自动刷新配置"
      width={460}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="text" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            保存
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--smc-fs-md)', fontWeight: 600 }}>
              启用每日自动刷新
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--smc-text-2)',
                marginTop: 2,
              }}
            >
              关闭后后端不再自动触发，但仍可手动"一键刷新"。
            </div>
          </div>
          <Switch
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: 'var(--smc-fs-md)',
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            每天执行时间
          </label>
          <input
            type="time"
            value={localTime}
            onChange={(e) => setLocalTime(e.target.value)}
            disabled={!enabled}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--smc-border)',
              background: enabled ? 'var(--smc-surface)' : 'var(--smc-surface-alt)',
              color: 'var(--smc-text)',
              fontSize: 'var(--smc-fs-md)',
              fontFamily: 'inherit',
            }}
          />
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: 'var(--smc-text-2)',
              lineHeight: 1.6,
            }}
          >
            按你当前设备时区显示（<code style={{ fontFamily: 'monospace' }}>{tzLabel}</code>），
            保存时将自动换算为 UTC 存入后端。
            <br />
            对应 UTC 时刻：<code style={{ fontFamily: 'monospace' }}>{previewUtc}</code>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ScheduleConfigModal;
