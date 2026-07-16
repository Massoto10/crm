const SENSITIVE_QUERY_KEYS = new Set(["token", "access_token", "api_key", "apikey", "secret", "password"]);

/** Removes credentials from URLs before they are logged or returned in errors. */
export function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, "http://localhost");
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) url.searchParams.set(key, "[redacted]");
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return rawUrl;
  }
}
