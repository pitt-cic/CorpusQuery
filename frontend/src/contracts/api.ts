import type { Job, Session, UserSettings, SecretsStatus, Document, ModelConfig, RetrievalConfig, FetchedOrcidResult } from './models';

export interface AskRequest {
  question: string;
  sessionId?: string;
  orcid?: string;
}

export interface AskResponse {
  jobId: string;
  sessionId: string;
}

export interface UpdateSessionRequest {
  title: string;
}

export interface UpdateSettingsRequest {
  modelConfig?: Partial<ModelConfig>;
  retrievalConfig?: Partial<RetrievalConfig>;
}

export interface UpdateSecretsRequest {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openalexApiKey?: string;
  ncbiApiKey?: string;
}

export interface SessionsResponse {
  sessions: Session[];
  nextToken: string | null;
}
export type MessagesResponse = Job[];
export type JobResponse = Job;
export type SettingsResponse = UserSettings;
export type SecretsStatusResponse = SecretsStatus;
export interface UploadUrlsRequest {
  filenames: string[];
  orcid?: string;
}

export interface IndexDocumentsRequest {
  orcid: string;
  filenames: string[];
}

export interface IndexDocumentsResponse {
  jobId: string;
}

export interface FetchedDocumentsResponse {
  fetched: FetchedOrcidResult[];
}

export interface UploadUrlsResponse {
  uploads: { filename: string; uploadUrl: string; expiresIn: number }[];
  skipped: { filename: string; reason: string }[];
}

export interface SyncResponse {
  ingestionJobId: string;
  status: string;
}

export interface DocumentsResponse {
  documents: Document[];
  nextToken: string | null;
  lastSyncedAt: string | null;
  syncStatus: 'STARTING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED' | null;
}

export interface SyncJobStatistics {
  numberOfDocumentsScanned: number;
  numberOfDocumentsFailed: number;
  numberOfNewDocumentsIndexed: number;
  numberOfModifiedDocumentsIndexed: number;
  numberOfDocumentsDeleted: number;
}

export interface SyncJob {
  ingestionJobId: string;
  status: 'STARTING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED';
  startedAt: string;
  updatedAt: string;
  statistics: SyncJobStatistics;
  failureReasons: string[];
}

export interface SyncJobsResponse {
  jobs: SyncJob[];
  nextToken: string | null;
}

export interface SyncErrorResponse {
  error: 'SYNC_IN_PROGRESS';
  message: string;
}

export interface DocumentDownloadResponse {
  downloadUrl: string;
  filename: string;
}

export interface FetcherStartRequest {
  orcid: string;
}

export interface FetcherStartResponse {
  jobId: string;
}

export interface FetcherJobsResponse {
  jobs: Job[];
}