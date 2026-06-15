"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkflowToast, WorkflowToastTone } from "@/components/workflow/WorkflowToasts";

type ShowToastOptions = {
  id?: string;
  message: string;
  tone: WorkflowToastTone;
  busy?: boolean;
  timeout?: number;
};

const DEFAULT_TOAST_TIMEOUT = 4200;
const MAX_VISIBLE_TOASTS = 4;

export function useWorkflowToasts() {
  const [toasts, setToasts] = useState<WorkflowToast[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ id, message, tone, busy = false, timeout }: ShowToastOptions) => {
      const toastId = id ?? `toast-${crypto.randomUUID?.() ?? Date.now()}`;
      const existingTimer = toastTimersRef.current.get(toastId);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
        toastTimersRef.current.delete(toastId);
      }

      setToasts((currentToasts) => {
        const nextToast: WorkflowToast = { id: toastId, message, tone, busy };
        const nextToasts = [
          ...currentToasts.filter((toast) => toast.id !== toastId),
          nextToast
        ];
        return nextToasts.slice(-MAX_VISIBLE_TOASTS);
      });

      const resolvedTimeout = timeout ?? (busy ? 0 : DEFAULT_TOAST_TIMEOUT);
      if (resolvedTimeout > 0) {
        const timer = window.setTimeout(() => dismissToast(toastId), resolvedTimeout);
        toastTimersRef.current.set(toastId, timer);
      }

      return toastId;
    },
    [dismissToast]
  );

  useEffect(
    () => () => {
      toastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      toastTimersRef.current.clear();
    },
    []
  );

  return { dismissToast, showToast, toasts };
}
