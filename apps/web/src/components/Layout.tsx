import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  Gauge,
  Images,
  Layers3,
  ListChecks,
  Moon,
  Paintbrush,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";
import { getDashboard, getSettings } from "../lib/api.js";
import type { DashboardData, Settings as SettingsType } from "../lib/types.js";
import { cn } from "../lib/utils.js";
import { IconButton } from "./ui.js";

const nav = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/create", label: "Create", icon: Sparkles },
  { to: "/batch", label: "Batch", icon: Layers3 },
  { to: "/gallery", label: "Gallery", icon: Images },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [light, setLight] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
  }, [light]);

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsData, dashboardData] = await Promise.all([getSettings(), getDashboard()]);
        setSettings(settingsData);
        setDashboard(dashboardData);
      } catch {
        setSettings(null);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="glass fixed inset-y-0 left-0 z-20 flex w-64 flex-col rounded-none border-y-0 border-l-0 px-4 py-6">
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 shadow-glow">
            <Paintbrush className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">GPT Image Batch</h1>
            <p className="text-xs text-muted-foreground">Local AI Tools</p>
          </div>
        </div>
        <nav className="grid gap-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex h-11 items-center gap-3 rounded-md border border-transparent px-3 text-sm text-muted-foreground transition",
                  isActive
                    ? "border-violet-400/40 bg-gradient-to-r from-violet-500/35 to-blue-500/35 text-white shadow-glow"
                    : "hover:bg-white/7 hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-border pt-5">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-semibold">
              JD
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">Jane Doe</div>
              <div className="truncate text-xs text-muted-foreground">local workspace</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="ml-64 min-h-screen flex-1">
        <header className="sticky top-0 z-10 border-b border-border bg-background/78 px-7 py-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill
                tone={settings?.apiKeyConfigured ? "green" : "red"}
                label={settings?.apiKeyConfigured ? "API Connected" : "API Key Missing"}
              />
              <StatusPill
                tone={dashboard?.queue.enabled ? "blue" : "gray"}
                label={dashboard?.queue.enabled ? "Queue Running" : "Queue Waiting"}
              />
              <StatusPill
                tone="purple"
                label={`Concurrency ${dashboard?.queue.running ?? 0} / ${dashboard?.queue.maxConcurrency ?? settings?.maxConcurrency ?? 0}`}
              />
            </div>
            <div className="flex items-center gap-3">
              <IconButton onClick={() => setLight((value) => !value)} aria-label="切换主题">
                {light ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </IconButton>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-semibold">
                JD
              </div>
            </div>
          </div>
        </header>
        <div className="px-7 py-6">{children}</div>
      </main>
    </div>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: "green" | "blue" | "purple" | "red" | "gray";
  label: string;
}) {
  const color = {
    green: "border-emerald-500/25 bg-emerald-500/12 text-emerald-200",
    blue: "border-blue-500/25 bg-blue-500/12 text-blue-200",
    purple: "border-violet-500/25 bg-violet-500/12 text-violet-200",
    red: "border-red-500/25 bg-red-500/12 text-red-200",
    gray: "border-slate-500/25 bg-slate-500/12 text-slate-200",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium",
        color,
      )}
    >
      {label}
    </span>
  );
}
