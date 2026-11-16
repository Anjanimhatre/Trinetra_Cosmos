// services/api.js
// One place for the backend URL, the saved login token and error handling.
const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const KEY = "pa_token";

export const tokenStore = {
  get: () => localStorage.getItem(KEY) || sessionStorage.getItem(KEY),
  set(token, remember) {
    this.clear();
    (remember ? localStorage : sessionStorage).setItem(KEY, token);
  },
  clear() {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  },
};

function messageFrom(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(" ");
  return "Something went wrong. Try again.";
}

/**
 * api("/api/nasa-rag/chat", { method: "POST", body: { question } })
 * Sends the saved token automatically. Pass auth:false for sign-in calls.
 * timeoutMs: give up after this long (default 60 s). signal: optional AbortSignal to cancel.
 */
export async function api(path, { method = "GET", body, auth = true, timeoutMs = 60000, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(signal?.aborted ? "Request cancelled." : "The server took too long to respond. Try again.");
    }
    throw new Error("Can’t reach the server. Check that the backend is running.");
  } finally {
    clearTimeout(timer);
  }

  // Only treat 401 as "logged out" if we actually sent a token.
  if (res.status === 401 && auth && token) {
    tokenStore.clear();
    window.dispatchEvent(new Event("pa:unauthorized")); // App listens and returns to the login page
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(
      res.status === 429
        ? `Too many requests. Please wait ${res.headers.get("Retry-After") || "a few"} seconds and try again.`
        : messageFrom(data?.detail),
    );
    err.status = res.status;
    err.retryAfter = Number(res.headers.get("Retry-After")) || null;
    throw err;
  }
  return data;
}

// Multi-agent research takes roughly 15-40 s, so it needs a longer timeout.
export const askResearch = (question, agencies) =>
  api("/api/nasa-rag/research", { method: "POST", body: { question, agencies }, timeoutMs: 120000 });