type MessageType = 'success' | 'error' | 'warning' | 'info';

interface MessageEvent {
  id: number;
  type: MessageType;
  content: string;
  duration: number;
}

type MessageListener = (event: MessageEvent) => void;

const listeners = new Set<MessageListener>();

function emit(type: MessageType, content: string, duration = 3000) {
  const event: MessageEvent = {
    id: Date.now() + Math.random(),
    type,
    content,
    duration,
  };

  listeners.forEach((listener) => listener(event));
}

export const message = {
  success(content: string, duration?: number) {
    emit('success', content, duration);
  },
  error(content: string, duration?: number) {
    emit('error', content, duration ?? 4000);
  },
  warning(content: string, duration?: number) {
    emit('warning', content, duration);
  },
  info(content: string, duration?: number) {
    emit('info', content, duration);
  },
};

export function subscribeMessage(listener: MessageListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
