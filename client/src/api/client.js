import axios from 'axios';

const TOKEN_KEY = 'waitforit.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/**
 * Where the API lives. Locally it's the same address (Vite proxies /api). On Render the website is a
 * separate static site, and Render passes the API's bare service name (e.g. "waitforit-api").
 */
export const API_ORIGIN = (() => {
  const v = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!v) return '';
  if (/^https?:\/\//.test(v)) return v;
  return `https://${v.includes('.') ? v : `${v}.onrender.com`}`;
})();

export const api = axios.create({ baseURL: `${API_ORIGIN}/api/v1` });

/**
 * Resolves once the API answers its health check. A sleeping free server can take up to a minute,
 * so each try gets a generous timeout and failures are retried.
 */
export async function waitForServer({ onSlow, onRetry } = {}) {
  const slow = setTimeout(() => onSlow?.(), 1800);
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(`${API_ORIGIN}/api/v1/health`, { signal: AbortSignal.timeout(70000), cache: 'no-store' });
        if (res.ok) return;
      } catch {
        // Not up yet.
      }
      if (attempt >= 3) onRetry?.(attempt);
      await new Promise((r) => setTimeout(r, Math.min(2000 * attempt, 6000)));
    }
  } finally {
    clearTimeout(slow);
  }
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isAuthCall = error.config?.url?.startsWith('/auth/') && error.config.method === 'post';
    if (error.response?.status === 401 && !isAuthCall) onUnauthorized();
    return Promise.reject(error);
  },
);

/** The server's message for a failed request, or a plain fallback. */
export function errorMessage(error) {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ERR_NETWORK') return 'Can’t reach the server. Check that it’s running and try again.';
  return 'Something went wrong. Please try again.';
}
