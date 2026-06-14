import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./ui.js";

interface ToastItem {
  id: number;
  title: string;
  tone: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (title: string, tone?: ToastItem["tone"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((title: string, tone: ToastItem["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, title, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3600);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-5 top-5 z-[60] grid w-80 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="glass flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm"
          >
            <span
              className={
                item.tone === "error"
                  ? "text-red-100"
                  : item.tone === "success"
                    ? "text-emerald-100"
                    : "text-foreground"
              }
            >
              {item.title}
            </span>
            <IconButton
              onClick={() => setItems((current) => current.filter((inner) => inner.id !== item.id))}
            >
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
