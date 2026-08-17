import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function getAuthToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
    ...options,
  });

  if (response.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  getSessions: (pageSize?: number, nextToken?: string) => {
    const params = new URLSearchParams();
    if (pageSize) params.set('pageSize', String(pageSize));
    if (nextToken) params.set('nextToken', nextToken);
    const query = params.toString();
    return request<import('@/contracts').SessionsResponse>(
      `/sessions${query ? `?${query}` : ''}`
    );
  },

  getMessages: (sessionId: string) =>
    request<import('@/contracts').Job[]>(`/sessions/${sessionId}/messages`),

  updateSession: (sessionId: string, body: import('@/contracts').UpdateSessionRequest) =>
    request<import('@/contracts').Session>(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteSession: (sessionId: string) =>
    request<void>(`/sessions/${sessionId}`, { method: 'DELETE' }),

  ask: (body: import('@/contracts').AskRequest) =>
    request<import('@/contracts').AskResponse>('/ask', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getJob: (jobId: string) => request<import('@/contracts').Job>(`/jobs/${jobId}`),

  getSettings: () => request<import('@/contracts').UserSettings>('/settings'),

  updateSettings: (body: import('@/contracts').UpdateSettingsRequest) =>
    request<import('@/contracts').UserSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  getSecretsStatus: () =>
    request<import('@/contracts').SecretsStatus>('/settings/secrets/status'),

  updateSecrets: (body: import('@/contracts').UpdateSecretsRequest) =>
    request<void>('/settings/secrets', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  getUploadUrls: (filenames: string[], orcid?: string) =>
    request<import('@/contracts').UploadUrlsResponse>('/documents/upload-urls', {
      method: 'POST',
      body: JSON.stringify({ filenames, ...(orcid && { orcid }) }),
    }),

  indexDocuments: (orcid: string, filenames: string[]) =>
    request<import('@/contracts').IndexDocumentsResponse>('/documents/index', {
      method: 'POST',
      body: JSON.stringify({ orcid, filenames }),
    }),

  getFetchedDocuments: () =>
    request<import('@/contracts').FetchedDocumentsResponse>('/documents/fetched'),

  getResearchers: () =>
    request<{ researchers: { orcid: string }[] }>('/documents/researchers'),

  syncDocuments: () =>
    request<import('@/contracts').SyncResponse>('/documents/sync', {
      method: 'POST',
    }),

  getDocuments: (pageSize?: number, nextToken?: string) => {
    const params = new URLSearchParams();
    if (pageSize) params.set('pageSize', String(pageSize));
    if (nextToken) params.set('nextToken', nextToken);
    const query = params.toString();
    return request<import('@/contracts').DocumentsResponse>(
      `/documents${query ? `?${query}` : ''}`
    );
  },

  getDocumentDownload: (docname: string) =>
    request<{ downloadUrl: string; filename: string }>(`/documents/download?name=${encodeURIComponent(docname)}`),

  getSyncJobs: (pageSize?: number, nextToken?: string) => {
    const params = new URLSearchParams();
    if (pageSize) params.set('pageSize', String(pageSize));
    if (nextToken) params.set('nextToken', nextToken);
    const query = params.toString();
    return request<import('@/contracts').SyncJobsResponse>(
      `/documents/sync-jobs${query ? `?${query}` : ''}`
    );
  },

  getSyncJob: (jobId: string) =>
    request<import('@/contracts').SyncJob>(`/documents/sync-jobs/${jobId}`),

  startFetcher: (orcid: string) =>
    request<import('@/contracts').FetcherStartResponse>('/fetcher', {
      method: 'POST',
      body: JSON.stringify({ orcid }),
    }),

  getFetcherJobs: () =>
    request<import('@/contracts').FetcherJobsResponse>('/fetcher-jobs'),

  getFetcherJob: (jobId: string) =>
    request<import('@/contracts').Job>(`/fetcher-jobs/${jobId}`),
};
