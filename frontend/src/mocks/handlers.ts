import { http, HttpResponse, delay } from 'msw';
import {
  mockSessions,
  mockJobs,
  mockDocuments,
  mockSettings,
  mockSecretsStatus,
  mockSyncStatus,
  mockSyncJobs,
} from './fixtures';
import { JobStatus } from '@/contracts';
import type { AskRequest, AskResponse } from '@/contracts';

const API_BASE = '/api';

let sessions = [...mockSessions];
let jobs = [...mockJobs];
let jobCounter = 3;
let settings = { ...mockSettings };

export const handlers = [
  // Sessions
  http.get(`${API_BASE}/sessions`, () => {
    return HttpResponse.json({ sessions, nextToken: null });
  }),

  http.get(`${API_BASE}/sessions/:sessionId/messages`, ({ params }) => {
    const sessionJobs = jobs.filter((j) => j.sessionId === params.sessionId);
    return HttpResponse.json(sessionJobs);
  }),

  http.put(`${API_BASE}/sessions/:sessionId`, async ({ params, request }) => {
    const body = (await request.json()) as { title: string };
    const session = sessions.find((s) => s.sessionId === params.sessionId);
    if (session) session.title = body.title;
    return HttpResponse.json(session);
  }),

  http.delete(`${API_BASE}/sessions/:sessionId`, ({ params }) => {
    sessions = sessions.filter((s) => s.sessionId !== params.sessionId);
    return new HttpResponse(null, { status: 204 });
  }),

  // Ask
  http.post(`${API_BASE}/ask`, async ({ request }) => {
    const body = (await request.json()) as AskRequest;
    const sessionId = body.sessionId || `sess-new-${Date.now()}`;
    const jobId = `job-${String(jobCounter++).padStart(3, '0')}`;

    if (!body.sessionId) {
      sessions.unshift({
        sessionId,
        title: body.question.slice(0, 30) + '...',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      });
    }

    jobs.push({
      jobId,
      sessionId,
      status: JobStatus.PENDING,
      question: body.question,
      createdAt: new Date().toISOString(),
    });

    // Simulate async processing
    setTimeout(() => {
      const job = jobs.find((j) => j.jobId === jobId);
      if (job) job.status = JobStatus.PROCESSING;
    }, 500);

    setTimeout(() => {
      const job = jobs.find((j) => j.jobId === jobId);
      if (job) {
        job.status = JobStatus.COMPLETED;
        job.answer = `Based on the indexed literature, here is the answer to: "${body.question}". The analysis indicates several key findings from the corpus.`;
        job.citations = [
          { docname: 'zhang_2024_models', textName: 'Zhang 2024 Models', quote: 'Relevant finding from the paper...', relevanceScore: 0.89 },
        ];
        job.completedAt = new Date().toISOString();
      }
    }, 2000);

    const response: AskResponse = { jobId, sessionId };
    return HttpResponse.json(response);
  }),

  // Jobs
  http.get(`${API_BASE}/jobs/:jobId`, async ({ params }) => {
    await delay(100);
    const job = jobs.find((j) => j.jobId === params.jobId);
    if (!job) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(job);
  }),

  // Settings
  http.get(`${API_BASE}/settings`, () => {
    return HttpResponse.json(settings);
  }),

  http.put(`${API_BASE}/settings`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    settings = {
      ...settings,
      modelConfig: { ...settings.modelConfig, ...(body.modelConfig as object ?? {}) },
      retrievalConfig: { ...settings.retrievalConfig, ...(body.retrievalConfig as object ?? {}) },
    };
    return HttpResponse.json(settings);
  }),

  // Secrets
  http.get(`${API_BASE}/settings/secrets/status`, () => {
    return HttpResponse.json(mockSecretsStatus);
  }),

  http.put(`${API_BASE}/settings/secrets`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Documents
  http.get(`${API_BASE}/documents`, ({ request }) => {
    const url = new URL(request.url);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '100', 10);
    const nextToken = url.searchParams.get('nextToken');

    // Simple pagination mock
    const startIndex = nextToken ? parseInt(nextToken, 10) : 0;
    const endIndex = startIndex + pageSize;
    const docs = mockDocuments.slice(startIndex, endIndex);
    const hasMore = endIndex < mockDocuments.length;

    return HttpResponse.json({
      documents: docs,
      nextToken: hasMore ? String(endIndex) : null,
      ...mockSyncStatus,
    });
  }),

  http.post(`${API_BASE}/documents/upload-urls`, async ({ request }) => {
    const body = (await request.json()) as { filenames: string[] };
    const existingNames = mockDocuments.map(d => d.filename);

    const uploads: { filename: string; uploadUrl: string; expiresIn: number }[] = [];
    const skipped: { filename: string; reason: string }[] = [];

    for (const filename of body.filenames) {
      if (existingNames.includes(filename)) {
        skipped.push({ filename, reason: 'already exists' });
      } else {
        uploads.push({
          filename,
          uploadUrl: `https://mock-s3.local/presigned/${filename}`,
          expiresIn: 3600,
        });
      }
    }

    return HttpResponse.json({ uploads, skipped });
  }),

  http.post(`${API_BASE}/documents/sync`, () => {
    return HttpResponse.json({
      ingestionJobId: 'mock-job-123',
      status: 'STARTING',
    });
  }),

  // Sync Jobs
  http.get(`${API_BASE}/documents/sync-jobs`, ({ request }) => {
    const url = new URL(request.url);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '5', 10);
    const nextToken = url.searchParams.get('nextToken');

    const startIndex = nextToken ? parseInt(nextToken, 10) : 0;
    const endIndex = startIndex + pageSize;
    const jobs = mockSyncJobs.slice(startIndex, endIndex);
    const hasMore = endIndex < mockSyncJobs.length;

    return HttpResponse.json({
      jobs,
      nextToken: hasMore ? String(endIndex) : null,
    });
  }),
];

export function resetHandlerState() {
  sessions = [...mockSessions];
  jobs = [...mockJobs];
  jobCounter = 3;
  settings = { ...mockSettings };
}
