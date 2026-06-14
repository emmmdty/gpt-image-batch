import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Save, Wifi } from "lucide-react";
import { getSettings, testSettingsConnection, updateSettings } from "../lib/api.js";
import type { Settings } from "../lib/types.js";
import { getApiKeyFieldCopy } from "../lib/settings-copy.js";
import { cn } from "../lib/utils.js";
import { useToast } from "../components/Toast.js";
import { Button, Card, CardHeader, Field, Input, Select } from "../components/ui.js";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    void getSettings()
      .then(setSettings)
      .catch((error) => toast(error.message, "error"));
  }, []);

  const save = async () => {
    if (!settings) return;
    try {
      const next = await updateSettings({
        baseUrl: settings.baseUrl,
        apiKey,
        model: settings.model,
        defaultSize: settings.defaultSize,
        defaultQuality: settings.defaultQuality,
        defaultOutputFormat: settings.defaultOutputFormat,
        defaultN: settings.defaultN,
        maxConcurrency: settings.maxConcurrency,
        maxRetries: settings.maxRetries,
        retryBaseDelayMs: settings.retryBaseDelayMs,
      });
      setSettings(next);
      setApiKey("");
      toast("配置已保存", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "保存失败", "error");
    }
  };

  const test = async () => {
    try {
      const result = await testSettingsConnection();
      toast(result.message, result.reachable ? "success" : "error");
    } catch (error) {
      toast(error instanceof Error ? error.message : "测试失败", "error");
    }
  };

  if (!settings) {
    return (
      <Card>
        <div className="p-8 text-muted-foreground">加载配置...</div>
      </Card>
    );
  }

  const apiKeyCopy = getApiKeyFieldCopy(settings.apiKeyConfigured);
  const apiKeyStatusClass =
    apiKeyCopy.statusTone === "success"
      ? "border-emerald-500/30 bg-emerald-500/14 text-emerald-200"
      : "border-red-500/30 bg-red-500/14 text-red-200";

  return (
    <Card className="max-w-4xl">
      <CardHeader
        title="Settings"
        subtitle="本地保存 API 和任务默认参数。API key 不会出现在日志或前端响应中。"
      />
      <div className="grid gap-5">
        <section className="rounded-lg border border-border bg-black/10 p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-white/5">
                <KeyRound className="h-4 w-4 text-cyan-200" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">API Key</h3>
                <p className="mt-1 text-sm text-muted-foreground">{apiKeyCopy.helperText}</p>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium",
                apiKeyStatusClass,
              )}
            >
              {apiKeyCopy.statusLabel}
            </span>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <label htmlFor="image-api-key">{apiKeyCopy.inputLabel}</label>
            <div className="flex gap-2">
              <Input
                id="image-api-key"
                name="image-api-key"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                autoComplete="new-password"
                spellCheck={false}
                placeholder={apiKeyCopy.placeholder}
                className="min-w-0 flex-1"
                onChange={(event) => setApiKey(event.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                className="w-28 shrink-0 px-3"
                onClick={() => setShowApiKey((value) => !value)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showApiKey ? "隐藏" : "显示"}
              </Button>
            </div>
          </div>
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="API Base URL">
            <Input
              value={settings.baseUrl}
              onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })}
            />
          </Field>
          <Field label="Model">
            <Input
              value={settings.model}
              onChange={(event) => setSettings({ ...settings, model: event.target.value })}
            />
          </Field>
          <Field label="Default Size">
            <Select
              value={settings.defaultSize}
              onChange={(event) => setSettings({ ...settings, defaultSize: event.target.value })}
            >
              <option>1024x1024</option>
              <option>1536x1024</option>
              <option>1024x1536</option>
              <option>auto</option>
            </Select>
          </Field>
          <Field label="Default Quality">
            <Select
              value={settings.defaultQuality}
              onChange={(event) => setSettings({ ...settings, defaultQuality: event.target.value })}
            >
              <option>low</option>
              <option>medium</option>
              <option>high</option>
              <option>auto</option>
            </Select>
          </Field>
          <Field label="Default Output Format">
            <Select
              value={settings.defaultOutputFormat}
              onChange={(event) =>
                setSettings({ ...settings, defaultOutputFormat: event.target.value })
              }
            >
              <option>png</option>
              <option>jpeg</option>
              <option>webp</option>
            </Select>
          </Field>
          <Field label="Default N">
            <Input
              type="number"
              min={1}
              max={10}
              value={settings.defaultN}
              onChange={(event) =>
                setSettings({ ...settings, defaultN: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Max Concurrency">
            <Input
              type="number"
              min={1}
              max={16}
              value={settings.maxConcurrency}
              onChange={(event) =>
                setSettings({ ...settings, maxConcurrency: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Max Retries">
            <Input
              type="number"
              min={0}
              max={10}
              value={settings.maxRetries}
              onChange={(event) =>
                setSettings({ ...settings, maxRetries: Number(event.target.value) })
              }
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={save}>
            <Save className="h-4 w-4" />
            保存配置
          </Button>
          <Button variant="secondary" onClick={test}>
            <Wifi className="h-4 w-4" />
            测试连接
          </Button>
        </div>
      </div>
    </Card>
  );
}
