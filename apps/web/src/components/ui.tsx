import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn, statusClass, statusLabel } from "../lib/utils.js";
import type { BatchStatus, TaskStatus } from "../lib/types.js";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "border-transparent bg-gradient-to-r from-violet-500 to-cyan-400 text-white shadow-glow hover:brightness-110",
        variant === "secondary" &&
          "border-border bg-white/5 text-foreground hover:border-violet-400/50 hover:bg-white/8",
        variant === "ghost" &&
          "border-transparent bg-transparent text-muted-foreground hover:bg-white/8 hover:text-foreground",
        variant === "danger" && "border-red-500/30 bg-red-500/15 text-red-100 hover:bg-red-500/25",
        className,
      )}
      {...props}
    />
  );
}

export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button variant="secondary" className={cn("h-9 w-9 px-0", props.className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("glass rounded-lg p-4", className)}>{children}</section>;
}

export function CardHeader({
  title,
  action,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 rounded-md border border-border bg-black/20 px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-violet-400/70",
        props.className,
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 rounded-md border border-border bg-black/20 px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-violet-400/70",
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 rounded-md border border-border bg-black/20 px-3 text-sm text-foreground outline-none transition focus:border-violet-400/70",
        props.className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Badge({ status }: { status: TaskStatus | BatchStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
        statusClass[status],
      )}
    >
      {statusLabel[status]}
    </span>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="glass max-h-[88vh] w-full max-w-4xl overflow-auto rounded-lg p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
