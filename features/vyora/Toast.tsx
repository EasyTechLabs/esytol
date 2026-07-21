"use client";

/**
 * Vyora Alpha — tiny toast system. Every successful action reassures the merchant
 * ("✓ Credit recorded · Outstanding updated"), and destructive/undoable actions
 * carry an inline **Undo**. No dependency, no portal library — one context.
 */

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "info" | "warn";
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastApi {
  show: (t: Omit<Toast, "id">) => void;
  success: (message: string, action?: { label: string; onAction: () => void }) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq.current;
      setToasts((ts) => [...ts.filter((x) => x.tone !== "success"), { ...t, id }]);
      const ttl = t.actionLabel ? 6000 : 3000;
      setTimeout(() => remove(id), ttl);
    },
    [remove]
  );

  const api: ToastApi = {
    show,
    success: (message, action) =>
      show({ message, tone: "success", actionLabel: action?.label, onAction: action?.onAction }),
    info: (message) => show({ message, tone: "info" }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toaster — sits above the bottom action bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 mx-auto flex w-full max-w-lg flex-col items-center gap-2 px-4 print:hidden">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-lg",
              t.tone === "success"
                ? "bg-emerald-700"
                : t.tone === "warn"
                  ? "bg-amber-700"
                  : "bg-gray-900"
            )}
          >
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  remove(t.id);
                }}
                className="shrink-0 rounded-lg bg-white/20 px-3 py-1 font-semibold hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
