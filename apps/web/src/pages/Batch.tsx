import { useEffect, useState } from "react";
import { FileJson, Pause, Play, RotateCcw, Square, UploadCloud } from "lucide-react";
import {
  cancelBatch,
  createBatch,
  getBatch,
  importCsv,
  importJsonl,
  listBatches,
  pauseBatch,
  resumeBatch,
  retryFailedBatch,
} from "../lib/api.js";
import type { Batch, ImageTask } from "../lib/types.js";
import { formatDate, shortText } from "../lib/utils.js";
import { useToast } from "../components/Toast.js";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Textarea,
} from "../components/ui.js";

export function BatchPage() {
  const [name, setName] = useState("新批次");
  const [prompts, setPrompts] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("medium");
  const [outputFormat, setOutputFormat] = useState("png");
  const [n, setN] = useState(1);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<Batch | null>(null);
  const [tasks, setTasks] = useState<ImageTask[]>([]);
  const { toast } = useToast();

  const load = async (selectedId?: string) => {
    const batchData = await listBatches();
    setBatches(batchData.items);
    const id = selectedId ?? selected?.id ?? batchData.items[0]?.id;
    if (id) {
      const detail = await getBatch(id);
      setSelected(detail.batch);
      setTasks(detail.tasks);
    }
  };

  useEffect(() => {
    void load().catch((error) => toast(error.message, "error"));
    const timer = window.setInterval(() => void load().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const createFromText = async () => {
    const items = prompts
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((prompt) => ({ prompt, size, quality, outputFormat, n }));
    if (!items.length) {
      toast("请输入至少一行 prompt", "error");
      return;
    }
    try {
      const result = await createBatch({ name, items });
      setPrompts("");
      toast("批次已创建", "success");
      await load(result.batch.id);
    } catch (error) {
      toast(error instanceof Error ? error.message : "创建失败", "error");
    }
  };

  const upload = async (file: File, type: "csv" | "jsonl") => {
    try {
      const result = type === "csv" ? await importCsv(file, name) : await importJsonl(file, name);
      toast("导入成功", "success");
      await load(result.batch.id);
    } catch (error) {
      toast(error instanceof Error ? error.message : "导入失败", "error");
    }
  };

  const action = async (fn: (id: string) => Promise<unknown>, message: string) => {
    if (!selected) return;
    try {
      await fn(selected.id);
      toast(message, "success");
      await load(selected.id);
    } catch (error) {
      toast(error instanceof Error ? error.message : "操作失败", "error");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-5">
        <Card>
          <CardHeader title="Create Batch" subtitle="一行一个 prompt，提交后自动进入队列。" />
          <div className="grid gap-4">
            <Field label="Batch Name">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Prompts">
              <Textarea
                value={prompts}
                onChange={(event) => setPrompts(event.target.value)}
                placeholder={"一只橘猫坐在未来城市窗边\n一只狸花猫穿着侦探风衣，雨夜霓虹街道"}
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-4">
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
              <Field label="Format">
                <Select
                  value={outputFormat}
                  onChange={(event) => setOutputFormat(event.target.value)}
                >
                  <option>png</option>
                  <option>jpeg</option>
                  <option>webp</option>
                </Select>
              </Field>
              <Field label="N">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={n}
                  onChange={(event) => setN(Number(event.target.value))}
                />
              </Field>
            </div>
            <Button onClick={createFromText}>创建批量任务</Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Batch Import" subtitle="上传 CSV 或 JSONL 文件创建批次。" />
          <div className="grid gap-3 md:grid-cols-2">
            <UploadButton
              label="Upload CSV"
              accept=".csv"
              icon={<UploadCloud className="h-4 w-4" />}
              onFile={(file) => upload(file, "csv")}
            />
            <UploadButton
              label="Upload JSONL"
              accept=".jsonl,.txt"
              icon={<FileJson className="h-4 w-4" />}
              onFile={(file) => upload(file, "jsonl")}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Batches" subtitle="查看批次详情并控制任务流。" />
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="grid max-h-[650px] gap-2 overflow-auto pr-1">
            {batches.map((batch) => (
              <button
                key={batch.id}
                onClick={() => void load(batch.id)}
                className={`rounded-md border p-3 text-left transition ${selected?.id === batch.id ? "border-violet-400/50 bg-violet-500/15" : "border-border bg-white/5 hover:bg-white/8"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{batch.name}</span>
                  <Badge status={batch.status} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {batch.successCount}/{batch.totalTasks} 成功 · {formatDate(batch.createdAt)}
                </div>
              </button>
            ))}
          </div>
          <div>
            {selected ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-white/5 p-3">
                  <div>
                    <div className="font-semibold">{selected.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Pending {selected.pendingCount} · Running {selected.runningCount} · Failed{" "}
                      {selected.failedCount}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => action(pauseBatch, "批次已暂停")}>
                      <Pause className="h-4 w-4" />
                      暂停
                    </Button>
                    <Button variant="secondary" onClick={() => action(resumeBatch, "批次已继续")}>
                      <Play className="h-4 w-4" />
                      继续
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => action(retryFailedBatch, "失败任务已重跑")}
                    >
                      <RotateCcw className="h-4 w-4" />
                      重跑失败
                    </Button>
                    <Button variant="danger" onClick={() => action(cancelBatch, "批次已取消")}>
                      <Square className="h-4 w-4" />
                      取消
                    </Button>
                  </div>
                </div>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">Prompt</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Retry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr key={task.id} className="border-t border-border">
                          <td className="px-3 py-3">{shortText(task.prompt, 76)}</td>
                          <td className="px-3 py-3">
                            <Badge status={task.status} />
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {task.retryCount}/{task.maxRetries}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid min-h-96 place-items-center rounded-md border border-dashed border-border text-muted-foreground">
                暂无批次
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function UploadButton({
  label,
  accept,
  icon,
  onFile,
}: {
  label: string;
  accept: string;
  icon: React.ReactNode;
  onFile: (file: File) => void;
}) {
  return (
    <label className="grid min-h-32 cursor-pointer place-items-center rounded-md border border-dashed border-border bg-white/5 text-sm text-muted-foreground transition hover:border-violet-400/50 hover:text-foreground">
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])}
      />
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
    </label>
  );
}
