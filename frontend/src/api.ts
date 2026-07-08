const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_STORAGE_KEY = 'prototype-crm:token';

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const responseBody = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      throw new Error('Unauthorized');
    }
    const errorMessage = typeof responseBody === 'string'
      ? responseBody
      : responseBody?.error || responseBody?.message || `Request failed: ${res.status}`;
    throw new Error(errorMessage);
  }

  return (responseBody ?? {}) as T;
}

export const api = {
  auth: {
    login: (payload: { email: string; password: string }) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    me: (token: string) => request('/api/auth/me', undefined, token),
    getStoredToken: () => localStorage.getItem(TOKEN_STORAGE_KEY),
    setToken: (token: string) => localStorage.setItem(TOKEN_STORAGE_KEY, token),
    clearToken: () => localStorage.removeItem(TOKEN_STORAGE_KEY),
  },
  clients: {
    list: (token: string) => request('/api/clients?limit=100', undefined, token),
    create: (token: string, payload: unknown) => request('/api/clients', { method: 'POST', body: JSON.stringify(payload) }, token),
  },
  leads: {
    list: (token: string) => request('/api/leads?limit=100', undefined, token),
    create: (token: string, payload: unknown) => request('/api/leads', { method: 'POST', body: JSON.stringify(payload) }, token),
    update: (token: string, id: string, payload: unknown) => request(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token),
    updateStage: (token: string, id: string, payload: { status: string }) => request(`/api/leads/${id}/stage`, { method: 'PUT', body: JSON.stringify(payload) }, token),
    import: (token: string, rows: unknown[]) => request('/api/leads/import', { method: 'POST', body: JSON.stringify({ leads: rows }) }, token),
  },
  transactions: {
    list: (token: string) => request('/api/transactions?limit=100', undefined, token),
  },
  dashboard: {
    metrics: (token: string) => request('/api/dashboard/metrics', undefined, token),
  },
  audit: {
    list: (token: string, page = 1) => request(`/api/audit-logs?page=${page}&limit=20`, undefined, token),
  },
  backups: {
    list: (token: string) => request('/api/system/backups', undefined, token),
    create: (token: string) => request('/api/system/backups', { method: 'POST' }, token),
  },
  import: {
    validate: (token: string, formData: FormData) => fetch(`${API_BASE}/api/import/validate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }).then((res) => res.json()),
    execute: (token: string, payload: unknown) => request('/api/import/execute', { method: 'POST', body: JSON.stringify(payload) }, token),
  },
};
