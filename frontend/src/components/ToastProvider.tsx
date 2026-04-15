import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { subscribeMessage } from '../utils/message';

interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  content: string;
  duration: number;
}

const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [current, setCurrent] = useState<ToastItem | null>(null);

  useEffect(() => {
    return subscribeMessage((event) => {
      setQueue((previous) => [...previous, event]);
    });
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrent(next);
      setQueue(rest);
    }
  }, [current, queue]);

  const handleClose = () => {
    setCurrent(null);
  };

  const alert = useMemo(() => {
    if (!current) {
      return undefined;
    }

    return (
      <Alert variant="filled" severity={current.type} onClose={handleClose} sx={{ width: '100%' }}>
        {current.content}
      </Alert>
    );
  }, [current]);

  return (
    <>
      {children}
      <Snackbar
        open={Boolean(current)}
        autoHideDuration={current?.duration ?? 3000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {alert}
      </Snackbar>
    </>
  );
};

export default ToastProvider;
