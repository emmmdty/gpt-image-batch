import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ImageIcon,
  ListChecks,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { createTask, getDashboard, listOutputs } from "../lib/api.js";
import type { DashboardData, ImageOutput } from "../lib/types.js";
import { absoluteApiUrl, formatDate, shortText } from "../lib/utils.js";
import { useToast } from "../components/Toast.js";
import { Badge, Button, Card, CardHeader, Field, Select, Textarea } from "../components/ui.js";

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [outputs, setOutputs] = useState<ImageOutput[]>([]);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("medium");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const [dashboardData, outputsData] = await Promise.all([getDashboard(), listOutputs()]);
    setDashboard(dashboardData);
    setOutputs(outputsData.items.slice(0, 6));
  };

  useEffect(() => {
    void load().catch((error) => toast(error.message, "error"));
    const timer = window.setInterval(() => void load().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const submit = async () => {
    if (!prompt.trim()) {
      toast("请输入 prompt", "error");
      return;
    }
    setLoading(true);
    try {
      await createTask({ prompt, size, quality, outputFormat: "png", n: 1 });
      setPrompt("");
      toast("任务已加入队列", "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "创建失败", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 xl:grid-cols-4">
        <Metric
          title="今日生成"
          value={dashboard?.todayGenerated ?? 0}
          icon={<ImageIcon />}
          tone="violet"
        />
        <Metric
          title="队列中"
          value={(dashboard?.pending ?? 0) + (dashboard?.running ?? 0)}
          icon={<ListChecks />}
          tone="blue"
        />
        <Metric
          title="Success"
          value={dashboard?.success ?? 0}
          icon={<CheckCircle2 />}
          tone="green"
        />
        <Metric title="Failed" value={dashboard?.failed ?? 0} icon={<XCircle />} tone="red" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr_0.72fr]">
        <Card>
          <CardHeader title="Prompt Studio" subtitle="快速创建单条图片任务。" />
          <div className="grid gap-4">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="描述你想生成的图片，包含主体、风格、光线、构图和情绪..."
            />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Size">
                <Select value={size} onChange={(event) => setSize(event.target.value)}>
                  <option>1024x1024</option>
                  <option>1536x1024</option>
                  <option>1024x1536</option>
                  <option>auto</option>
                </Select>
              </Field>
              <Field label="Quality">
                <Select value={quality} onChange={(event) => setQuality(event.target.value)}>
                  <option>low</option>
                  <option>medium</option>
                  <option>high</option>
                  <option>auto</option>
                </Select>
              </Field>
              <div className="flex items-end">
                <Button className="w-full" onClick={submit} disabled={loading}>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent Outputs"
            action={
              <Link className="text-sm text-violet-200" to="/gallery">
                View all
              </Link>
            }
          />
          {outputs.length ? (
            <div className="grid grid-cols-3 gap-3">
              {outputs.map((output) => (
                <img
                  key={output.id}
                  src={absoluteApiUrl(output.url)}
                  alt={output.task?.prompt ?? output.fileName}
                  className="aspect-square rounded-md border border-border object-cover"
                />
              ))}
            </div>
          ) : (
            <EmptyState text="还没有生成图片" />
          )}
        </Card>

        <Card>
          <CardHeader title="Queue Monitor" subtitle="当前队列状态。" />
          <div className="grid gap-4 text-sm">
            <QueueRow
              label="Pending"
              value={dashboard?.pending ?? 0}
              total={dashboard?.totalTasks ?? 0}
            />
            <QueueRow
              label="Running"
              value={dashboard?.running ?? 0}
              total={dashboard?.totalTasks ?? 0}
            />
            <QueueRow
              label="Success"
              value={dashboard?.success ?? 0}
              total={dashboard?.totalTasks ?? 0}
            />
            <QueueRow
              label="Failed"
              value={dashboard?.failed ?? 0}
              total={dashboard?.totalTasks ?? 0}
            />
          </div>
          <Link to="/tasks" className="mt-5 inline-flex items-center gap-2 text-sm text-violet-200">
            View all tasks <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent Tasks" />
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Prompt</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Quality</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.recentTasks ?? []).map((task) => (
                <tr key={task.id} className="border-t border-border">
                  <td className="max-w-lg px-4 py-3">{shortText(task.prompt, 72)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{task.size}</td>
                  <td className="px-4 py-3 text-muted-foreground">{task.quality}</td>
                  <td className="px-4 py-3">
                    <Badge status={task.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(task.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Metric({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: "violet" | "blue" | "green" | "red";
}) {
  const toneClass = {
    violet: "text-violet-300 bg-violet-500/15",
    blue: "text-blue-300 bg-blue-500/15",
    green: "text-emerald-300 bg-emerald-500/15",
    red: "text-red-300 bg-red-500/15",
  }[tone];
  return (
    <Card className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="mt-4 text-3xl font-semibold">{value.toLocaleString()}</div>
      </div>
      <div className={`grid h-11 w-11 place-items-center rounded-lg ${toneClass}`}>{icon}</div>
    </Card>
  );
}

function QueueRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[80px_1fr_48px] items-center gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="h-2 rounded-full bg-white/8">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-right text-muted-foreground">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
      <div className="grid justify-items-center gap-2">
        <Clock3 className="h-7 w-7" />
        {text}
      </div>
    </div>
  );
}
