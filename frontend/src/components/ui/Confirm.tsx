import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';
import Button from './Button';
import Input from './Input';

export type ConfirmIntent = 'info' | 'warning' | 'danger' | 'success';

export interface ConfirmOptions {
  title?: React.ReactNode;
  content?: React.ReactNode;
  intent?: ConfirmIntent;
  okText?: string;
  cancelText?: string;
  showCancel?: boolean;
  width?: number;
}

export interface PromptOptions extends ConfirmOptions {
  label?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  validate?: (value: string) => string | undefined;
}

interface ConfirmState extends ConfirmOptions {
  id: number;
  resolve: (v: boolean) => void;
}

interface PromptState extends PromptOptions {
  id: number;
  resolve: (v: string | null) => void;
}

let confirmController: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;
let promptController: ((opts: PromptOptions) => Promise<string | null>) | null = null;
let alertController: ((opts: ConfirmOptions) => Promise<void>) | null = null;

const iconFor = (intent: ConfirmIntent = 'warning') => {
  const common = { size: 22 } as const;
  switch (intent) {
    case 'info':
      return <Info {...common} />;
    case 'danger':
      return <XCircle {...common} />;
    case 'success':
      return <CheckCircle2 {...common} />;
    case 'warning':
    default:
      return <AlertTriangle {...common} />;
  }
};

/** Host that renders overlays and registers global controllers. */
export const ConfirmHost: React.FC = () => {
  const [confirmQueue, setConfirmQueue] = useState<ConfirmState[]>([]);
  const [promptQueue, setPromptQueue] = useState<PromptState[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    confirmController = (opts) =>
      new Promise<boolean>((resolve) => {
        idRef.current += 1;
        setConfirmQueue((q) => [...q, { ...opts, id: idRef.current, resolve }]);
      });
    alertController = (opts) =>
      new Promise<void>((resolve) => {
        idRef.current += 1;
        setConfirmQueue((q) => [
          ...q,
          {
            ...opts,
            showCancel: false,
            id: idRef.current,
            resolve: () => resolve(),
          },
        ]);
      });
    promptController = (opts) =>
      new Promise<string | null>((resolve) => {
        idRef.current += 1;
        setPromptQueue((q) => [...q, { ...opts, id: idRef.current, resolve }]);
      });
    return () => {
      confirmController = null;
      promptController = null;
      alertController = null;
    };
  }, []);

  const closeConfirm = (id: number, v: boolean) => {
    setConfirmQueue((q) => {
      const found = q.find((x) => x.id === id);
      found?.resolve(v);
      return q.filter((x) => x.id !== id);
    });
  };
  const closePrompt = (id: number, v: string | null) => {
    setPromptQueue((q) => {
      const found = q.find((x) => x.id === id);
      found?.resolve(v);
      return q.filter((x) => x.id !== id);
    });
  };

  return ReactDOM.createPortal(
    <>
      {confirmQueue.map((c) => (
        <ConfirmDialog key={c.id} state={c} onClose={(v) => closeConfirm(c.id, v)} />
      ))}
      {promptQueue.map((p) => (
        <PromptDialog key={p.id} state={p} onClose={(v) => closePrompt(p.id, v)} />
      ))}
    </>,
    document.body,
  );
};

const ConfirmDialog: React.FC<{ state: ConfirmState; onClose: (v: boolean) => void }> = ({
  state,
  onClose,
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.showCancel !== false) onClose(false);
      if (e.key === 'Enter') onClose(true);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state, onClose]);

  const intent = state.intent ?? 'warning';
  const iconClass =
    intent === 'danger' ? 'danger' : intent === 'info' ? 'info' : intent === 'success' ? 'success' : 'warning';
  return (
    <div className="smc-modal-overlay" onClick={(e) => e.target === e.currentTarget && state.showCancel !== false && onClose(false)}>
      <div className="smc-modal" style={{ width: state.width ?? 440 }}>
        <div className="smc-modal__header">
          <div className="smc-modal__title">{state.title ?? '请确认操作'}</div>
        </div>
        <div className="smc-modal__body">
          <div className="smc-confirm__row">
            <div className={`smc-confirm__icon smc-confirm__icon--${iconClass}`}>{iconFor(intent)}</div>
            <div className="smc-confirm__text">{state.content}</div>
          </div>
        </div>
        <div className="smc-modal__footer">
          {state.showCancel !== false && (
            <Button variant="outlined" onClick={() => onClose(false)}>
              {state.cancelText ?? '取消'}
            </Button>
          )}
          <Button
            variant={intent === 'danger' ? 'danger' : 'primary'}
            onClick={() => onClose(true)}
            autoFocus
          >
            {state.okText ?? '确认'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const PromptDialog: React.FC<{ state: PromptState; onClose: (v: string | null) => void }> = ({
  state,
  onClose,
}) => {
  const [value, setValue] = useState(state.defaultValue ?? '');
  const [error, setError] = useState<string | undefined>();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  const submit = () => {
    if (state.required && !value.trim()) {
      setError('此项必填');
      return;
    }
    if (state.validate) {
      const e = state.validate(value);
      if (e) {
        setError(e);
        return;
      }
    }
    onClose(value);
  };
  return (
    <div className="smc-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose(null)}>
      <div className="smc-modal" style={{ width: state.width ?? 440 }}>
        <div className="smc-modal__header">
          <div className="smc-modal__title">{state.title ?? '请输入'}</div>
        </div>
        <div className="smc-modal__body">
          {state.content && <div className="smc-confirm__text" style={{ marginBottom: 10 }}>{state.content}</div>}
          <Input
            label={state.label}
            placeholder={state.placeholder}
            required={state.required}
            value={value}
            autoFocus
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            error={error}
          />
        </div>
        <div className="smc-modal__footer">
          <Button variant="outlined" onClick={() => onClose(null)}>
            {state.cancelText ?? '取消'}
          </Button>
          <Button onClick={submit}>{state.okText ?? '确认'}</Button>
        </div>
      </div>
    </div>
  );
};

export const confirm = (opts: ConfirmOptions) => {
  if (!confirmController) return Promise.resolve(false);
  return confirmController(opts);
};

export const prompt = (opts: PromptOptions) => {
  if (!promptController) return Promise.resolve<string | null>(null);
  return promptController(opts);
};

export const alertDialog = (opts: ConfirmOptions) => {
  if (!alertController) return Promise.resolve();
  return alertController(opts);
};

export default ConfirmHost;
