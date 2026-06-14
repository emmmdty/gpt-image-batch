export interface BrowserLocationLike {
  protocol: string;
  hostname: string;
}

export function resolveApiBaseUrl(
  configuredValue: string | undefined,
  locationLike: BrowserLocationLike | undefined = getBrowserLocation(),
): string {
  const trimmed = configuredValue?.trim().replace(/\/+$/, "");
  if (trimmed && !["auto", "same-host"].includes(trimmed.toLowerCase())) {
    return trimmed;
  }
  if (!locationLike?.hostname) {
    return "http://localhost:8787";
  }
  const protocol = locationLike.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${locationLike.hostname}:8787`;
}

function getBrowserLocation(): BrowserLocationLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.location;
}
