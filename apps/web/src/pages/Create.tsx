import { useEffect, useState } from "react";
import { Copy, ExternalLink, Sparkles } from "lucide-react";
import { createTask, listOutputs, listTasks } from "../lib/api.js";
import type { ImageOutput, ImageTask } from "../lib/types.js";
import { absoluteApiUrl, formatDate } from "../lib/utils.js";
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

export function CreatePage() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("medium");
  const [outputFormat, setOutputFormat] = useState("png");
  const [n, setN] = useState(1);
  const [task, setTask] = useState<ImageTask | null>(null);
  const [outputs, setOutputs] = useState<ImageOutput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!task || !["pending", "running"].includes(task.status)) return;
    const timer = window.setInterval(async () => {
      const tasks = await listTasks({ pageSize: 50 });
      const fresh = tasks.items.find((item) => item.id === task.id);
      if (fresh) setTask(fresh);
      const outputData = await listOutputs({ taskId: task.id });
      setOutputs(outputData.items);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [task?.id, task?.status]);

  const submit = async () => {
    if (!prompt.trim()) {
      toast("请输入 prompt", "error");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createTask({ prompt, size, quality, outputFormat, n });
      setTask(created);
      setOutputs([]);
      toast("任务已创建", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "创建失败", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
      <Card>
        <CardHeader title="Create Image" subtitle="创建单条 prompt 生图任务。" />
        <div className="grid gap-4">
          <Field label="Prompt">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="一只橘猫坐在未来城市窗边，电影感光线"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
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
            <Field label="Output Format">
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
          <Button onClick={submit} disabled={submitting}>
            <Sparkles className="h-4 w-4" />
            Add to Queue
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Task Result" subtitle="任务状态和生成图片会自动刷新。" />
        {task ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-white/5 p-3">
              <Badge status={task.status} />
              <span className="text-sm text-muted-foreground">ID: {task.id}</span>
              <span className="text-sm text-muted-foreground">
                Created: {formatDate(task.createdAt)}
              </span>
            </div>
            {task.errorMessage ? (
              <div className="rounded-md border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">
                {task.errorMessage}
              </div>
            ) : null}
            {outputs.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {outputs.map((output) => (
                  <div key={output.id} className="rounded-lg border border-border bg-white/5 p-3">
                    <img
                      src={absoluteApiUrl(output.url)}
                      className="aspect-square w-full rounded-md object-cover"
                    />
                    <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{output.fileName}</span>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => navigator.clipboard.writeText(task.prompt)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <a href={absoluteApiUrl(output.url)} target="_blank" rel="noreferrer">
                          <Button variant="secondary">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-80 place-items-center rounded-md border border-dashed border-border text-muted-foreground">
                等待生成结果
              </div>
            )}
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center rounded-md border border-dashed border-border text-muted-foreground">
            提交任务后会显示状态和结果
          </div>
        )}
      </Card>
    </div>
  );
}
