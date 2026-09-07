import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../chat/chatStore';
import type { ToastItem } from '../components/ToastFeed';

export type ToastInput = Omit<ToastItem, 'toastId'>;

const MAX_VISIBLE_TOASTS = 3;
const TOAST_LIFETIME_MS = 4000;

export function useToastQueue(messages: ChatMessage[], isChatOpen: boolean) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (toast: ToastInput) =>
    setToasts((prev) =>
      [...prev, { ...toast, toastId: Date.now() + Math.random() }].slice(
        -MAX_VISIBLE_TOASTS
      )
    );

  const prevMsgCount = useRef(messages.length);
  const isChatOpenRef = useRef(isChatOpen);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      if (!isChatOpenRef.current && prevMsgCount.current > 0) {
        const newMessages = messages.slice(prevMsgCount.current);
        newMessages.forEach((msg) => pushToast(msg));
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(
        () => setToasts((prev) => prev.slice(1)),
        TOAST_LIFETIME_MS
      );
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  return { toasts, pushToast };
}
