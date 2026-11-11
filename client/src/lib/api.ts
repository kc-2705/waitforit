// Small fetch wrapper for the Express API.

const TOKEN_KEY = 'waitforit.token';

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      // Storage blocked: the session lasts until the tab closes.
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing to clear.
    }
  },
};

/**
 * Where the API lives. Locally it's http://localhost:8080. On Render the website is a static site and
 * Render passes the API's bare service name (e.g. "waitforit-api"), so https:// and .onrender.com are added.
 */
export const API_ORIGIN = (() => {
  const v = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').trim().replace(/\/+$/, '');
  if (/^https?:\/\//.test(v)) return v;
  return `https://${v.includes('.') ? v : `${v}.onrender.com`}`;
})();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T>(path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/api/v1${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const isLogin = path.startsWith('/auth/') && method === 'POST';
    if (res.status === 401 && !isLogin) onUnauthorized();
    throw new ApiError(res.status, data.message || 'Something went wrong. Please try again.');
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

/**
 * Resolves once the API answers its health check. A sleeping free server can take up to a minute,
 * so each try gets a generous timeout and failures are retried.
 */
export async function waitForServer({ onSlow, onRetry }: { onSlow?: () => void; onRetry?: () => void } = {}) {
  const slow = setTimeout(() => onSlow?.(), 1800);
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(`${API_ORIGIN}/api/v1/health`, { signal: AbortSignal.timeout(70000), cache: 'no-store' });
        if (res.ok) return;
      } catch {
        // Not up yet.
      }
      if (attempt >= 3) onRetry?.();
      await new Promise((r) => setTimeout(r, Math.min(2000 * attempt, 6000)));
    }
  } finally {
    clearTimeout(slow);
  }
}
