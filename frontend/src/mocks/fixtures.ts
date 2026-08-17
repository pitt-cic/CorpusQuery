import type { Session, Job, Document, UserSettings, SecretsStatus, DocumentsResponse } from '@/contracts';
import { JobStatus, Provider } from '@/contracts';

export const mockSessions: Session[] = [
  {
    sessionId: 'sess-001',
    title: 'Climate modeling accuracy',
    createdAt: '2026-05-28T14:32:00Z',
    lastActive: '2026-05-28T15:10:00Z',
  },
  {
    sessionId: 'sess-002',
    title: 'Supply chain optimization',
    createdAt: '2026-05-27T09:15:00Z',
    lastActive: '2026-05-27T10:45:00Z',
  },
  {
    sessionId: 'sess-003',
    title: 'Renewable energy storage',
    createdAt: '2026-05-26T11:00:00Z',
    lastActive: '2026-05-26T12:30:00Z',
  },
];

export const mockJobs: Job[] = [
  {
    jobId: 'job-001',
    sessionId: 'sess-001',
    status: JobStatus.COMPLETED,
    question: 'What are the key limitations of current climate models?',
    answer:
      'Current climate models face several key limitations including spatial resolution constraints, parameterization of sub-grid processes, and incomplete representation of feedback mechanisms. Recent advances in computational power have improved resolution but fundamental uncertainties remain in cloud microphysics.',
    citations: [
      {
        docname: 'zhang_2024_models',
        textName: 'Zhang 2024 Models',
        quote: 'Resolution limitations fundamentally constrain the representation of mesoscale processes.',
        relevanceScore: 0.92,
      },
      {
        docname: 'nakamura_feedback',
        textName: 'Nakamura Feedback',
        quote: 'Cloud feedback parameterization remains the largest source of inter-model spread.',
        relevanceScore: 0.87,
      },
    ],
    createdAt: '2026-05-28T14:32:00Z',
    completedAt: '2026-05-28T14:33:15Z',
  },
  {
    jobId: 'job-002',
    sessionId: 'sess-001',
    status: JobStatus.COMPLETED,
    question: 'How do ensemble methods improve prediction reliability?',
    answer:
      'Ensemble methods improve climate prediction reliability by sampling initial condition uncertainty and structural model differences. Multi-model ensembles consistently outperform individual models in skill scores for seasonal-to-decadal predictions.',
    citations: [
      {
        docname: 'zhang_2024_models',
        textName: 'Zhang 2024 Models',
        quote: 'Ensemble spread provides a calibrated estimate of forecast uncertainty in 78% of cases.',
        relevanceScore: 0.95,
      },
    ],
    createdAt: '2026-05-28T14:35:00Z',
    completedAt: '2026-05-28T14:36:20Z',
  },
];

export const mockDocuments: Document[] = [
  { filename: 'zhang-climate-models-2024.pdf', status: 'INDEXED', updatedAt: '2026-06-03T14:22:00Z', orcid: null },
  { filename: 'smith-neural-networks-2023.pdf', status: 'INDEXED', updatedAt: '2026-06-02T10:15:00Z', orcid: null },
  { filename: 'johnson-quantum-2024.pdf', status: 'INDEXED', updatedAt: '2026-06-01T09:30:00Z', orcid: null },
  { filename: 'williams-biology-2023.pdf', status: 'PENDING', updatedAt: '2026-06-05T16:00:00Z', orcid: null },
  { filename: 'brown-chemistry-2024.pdf', status: 'INDEXED', updatedAt: '2026-05-28T11:45:00Z', orcid: null },
];

export const mockSyncStatus: Pick<DocumentsResponse, 'lastSyncedAt' | 'syncStatus'> = {
  lastSyncedAt: '2026-06-05T15:59:20Z',
  syncStatus: 'COMPLETE' as const,
};

export const mockSyncJobs: import('@/contracts').SyncJob[] = [
  {
    ingestionJobId: 'job-001',
    status: 'COMPLETE',
    startedAt: '2026-06-09T10:30:00Z',
    updatedAt: '2026-06-09T10:32:15Z',
    statistics: {
      numberOfDocumentsScanned: 25,
      numberOfDocumentsFailed: 0,
      numberOfNewDocumentsIndexed: 3,
      numberOfModifiedDocumentsIndexed: 0,
      numberOfDocumentsDeleted: 0,
    },
    failureReasons: [],
  },
  {
    ingestionJobId: 'job-002',
    status: 'COMPLETE',
    startedAt: '2026-06-09T09:00:00Z',
    updatedAt: '2026-06-09T09:01:30Z',
    statistics: {
      numberOfDocumentsScanned: 20,
      numberOfDocumentsFailed: 0,
      numberOfNewDocumentsIndexed: 0,
      numberOfModifiedDocumentsIndexed: 2,
      numberOfDocumentsDeleted: 0,
    },
    failureReasons: [],
  },
  {
    ingestionJobId: 'job-003',
    status: 'FAILED',
    startedAt: '2026-06-08T15:00:00Z',
    updatedAt: '2026-06-08T15:00:45Z',
    statistics: {
      numberOfDocumentsScanned: 0,
      numberOfDocumentsFailed: 1,
      numberOfNewDocumentsIndexed: 0,
      numberOfModifiedDocumentsIndexed: 0,
      numberOfDocumentsDeleted: 0,
    },
    failureReasons: ['S3 access denied for document: paper.pdf'],
  },
];

export const mockSettings: UserSettings = {
  modelConfig: {
    llm: { provider: Provider.BEDROCK, modelId: 'us.anthropic.claude-sonnet-4-6' },
    summaryLlm: { provider: Provider.BEDROCK, modelId: 'us.anthropic.claude-sonnet-4-6' },
    agentLlm: { provider: Provider.BEDROCK, modelId: 'us.anthropic.claude-haiku-4-5-20251001' },
    embedding: { provider: Provider.BEDROCK, modelId: 'amazon.titan-embed-text-v2:0' },
    createdAt: '2026-05-20T12:00:00Z',
    updatedAt: '2026-05-28T14:32:00Z',
  },
  retrievalConfig: {
    evidenceK: 10,
    maxSources: 5,
    mmrLambda: 1.0,
    evidenceSummaryLength: 100,
    answerLength: 400,
    createdAt: '2026-05-20T12:00:00Z',
    updatedAt: '2026-05-25T09:00:00Z',
  },
};

export const mockSecretsStatus: SecretsStatus = {
  anthropicApiKey: true,
  openaiApiKey: false,
  openalexApiKey: false,
  ncbiApiKey: false,
};
