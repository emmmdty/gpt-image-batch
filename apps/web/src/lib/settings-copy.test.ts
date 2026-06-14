import { describe, expect, it } from "vitest";
import { getApiKeyFieldCopy } from "./settings-copy.js";

describe("getApiKeyFieldCopy", () => {
  it("makes the configured API key field clearly editable without exposing the saved key", () => {
    expect(getApiKeyFieldCopy(true)).toEqual({
      statusLabel: "已配置",
      statusTone: "success",
      inputLabel: "输入新的 API Key",
      placeholder: "留空保存时不修改当前 API Key",
      helperText: "如需替换，直接粘贴新的 API Key 后保存；当前密钥不会明文显示。",
    });
  });

  it("asks for an API key when no key is configured", () => {
    expect(getApiKeyFieldCopy(false)).toEqual({
      statusLabel: "未配置",
      statusTone: "danger",
      inputLabel: "输入 API Key",
      placeholder: "粘贴你的 API Key",
      helperText: "API Key 只保存在本地设置中，前端和日志不会显示完整内容。",
    });
  });
});
