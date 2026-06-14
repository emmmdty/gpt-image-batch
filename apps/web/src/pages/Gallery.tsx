import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink } from "lucide-react";
import { listBatches, listOutputs } from "../lib/api.js";
import type { Batch, ImageOutput } from "../lib/types.js";
import { absoluteApiUrl, formatDate, shortText } from "../lib/utils.js";
import { useToast } from "../components/Toast.js";
import { Button, Card, CardHeader, Field, Modal, Select } from "../components/ui.js";

export function GalleryPage() {
  const [outputs, setOutputs] = useState<ImageOutput[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [selected, setSelected] = useState<ImageOutput | null>(null);
  const { toast } = useToast();

  const load = async () => {
    const [batchData, outputData] = await Promise.all([
      listBatches(),
      listOutputs({ batchId: batchId || undefined }),
    ]);
    setBatches(batchData.items);
    setOutputs(outputData.items);
  };

  useEffect(() => {
    void load().catch((error) => toast(error.message, "error"));
  }, [batchId]);

  return (
    <Card>
      <CardHeader
        title="Gallery"
        subtitle="查看本地 outputs 目录中的生成图片。"
        action={
          <Field label="Batch">
            <Select
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              className="w-64"
            >
              <option value="">全部批次</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </Select>
          </Field>
        }
      />
      {outputs.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {outputs.map((output) => (
            <article
              key={output.id}
              className="overflow-hidden rounded-lg border border-border bg-white/5"
            >
              <button className="block w-full" onClick={() => setSelected(output)}>
                <img
                  src={absoluteApiUrl(output.url)}
                  alt={output.task?.prompt ?? output.fileName}
                  className="aspect-square w-full object-cover"
                />
              </button>
              <div className="grid gap-3 p-3">
                <p className="min-h-10 text-sm">
                  {shortText(output.task?.prompt ?? output.fileName, 60)}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{output.task?.size ?? "-"}</span>
                  <span>{output.task?.quality ?? "-"}</span>
                  <span>{formatDate(output.createdAt)}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => navigator.clipboard.writeText(output.task?.prompt ?? "")}
                  >
                    <Copy className="h-4 w-4" />
                    复制
                  </Button>
                  <a href={absoluteApiUrl(output.url)} target="_blank" rel="noreferrer">
                    <Button variant="secondary">
                      <ExternalLink className="h-4 w-4" />
                      打开
                    </Button>
                  </a>
                  <a href={absoluteApiUrl(output.url)} download>
                    <Button variant="secondary">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid min-h-[520px] place-items-center rounded-md border border-dashed border-border text-muted-foreground">
          暂无图片输出
        </div>
      )}
      <Modal
        open={Boolean(selected)}
        title={selected?.fileName ?? "Image"}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <img
              src={absoluteApiUrl(selected.url)}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
            <div className="grid content-start gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Prompt</span>
                <p className="mt-1">{selected.task?.prompt ?? "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">File</span>
                <p className="mt-1 break-all">{selected.filePath}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Params</span>
                <p className="mt-1">
                  {selected.task?.size} · {selected.task?.quality} · {selected.task?.outputFormat}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
