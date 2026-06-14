import { useEffect, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { listBatches, listTasks, retryTask } from "../lib/api.js";
import type { Batch, ImageTask } from "../lib/types.js";
import { formatDate, shortText } from "../lib/utils.js";
import { useToast } from "../components/Toast.js";
import { Badge, Button, Card, CardHeader, Field, Modal, Select } from "../components/ui.js";

export function TasksPage() {
  const [tasks, setTasks] = useState<ImageTask[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [status, setStatus] = useState("");
  const [batchId, setBatchId] = useState("");
  const [jsonTask, setJsonTask] = useState<ImageTask | null>(null);
  const { toast } = useToast();

  const load = async () => {
    const [taskData, batchData] = await Promise.all([
      listTasks({ status: status || undefined, batchId: batchId || undefined, pageSize: 100 }),
      listBatches(),
    ]);
    setTasks(taskData.items);
    setBatches(batchData.items);
  };

  useEffect(() => {
    void load().catch((error) => toast(error.message, "error"));
    const timer = window.setInterval(() => void load().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, [status, batchId]);

  const retry = async (id: string) => {
    try {
      await retryTask(id);
      toast("任务已重新入队", "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "重跑失败", "error");
    }
  };

  return (
    <Card>
      <CardHeader
        title="Tasks"
        subtitle="查看所有任务、失败原因和脱敏请求响应。"
        action={
          <div className="flex gap-3">
            <Field label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">全部</option>
                <option value="pending">pending</option>
                <option value="running">running</option>
                <option value="success">success</option>
                <option value="failed">failed</option>
                <option value="cancelled">cancelled</option>
              </Select>
            </Field>
            <Field label="Batch">
              <Select value={batchId} onChange={(event) => setBatchId(event.target.value)}>
                <option value="">全部批次</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        }
      />
      <div className="overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Prompt</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Retry</th>
              <th className="px-4 py-3">Error</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {shortText(task.id, 12)}
                </td>
                <td className="max-w-md px-4 py-3">{shortText(task.prompt, 80)}</td>
                <td className="px-4 py-3">
                  <Badge status={task.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {task.retryCount}/{task.maxRetries}
                </td>
                <td className="max-w-xs px-4 py-3 text-red-100">
                  {shortText(task.errorMessage ?? "-", 70)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(task.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setJsonTask(task)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {task.status === "failed" ? (
                      <Button variant="secondary" onClick={() => retry(task.id)}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={Boolean(jsonTask)} title="Request / Response" onClose={() => setJsonTask(null)}>
        <div className="grid gap-4 lg:grid-cols-2">
          <JsonBlock title="request_json" value={jsonTask?.requestJson} />
          <JsonBlock title="response_json" value={jsonTask?.responseJson} />
        </div>
      </Modal>
    </Card>
  );
}

function JsonBlock({ title, value }: { title: string; value: string | null | undefined }) {
  let formatted = value ?? "-";
  try {
    formatted = JSON.stringify(JSON.parse(value ?? "{}"), null, 2);
  } catch {
    formatted = value ?? "-";
  }
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <pre className="max-h-[60vh] overflow-auto rounded-md border border-border bg-black/30 p-3 text-xs text-muted-foreground">
        {formatted}
      </pre>
    </div>
  );
}
