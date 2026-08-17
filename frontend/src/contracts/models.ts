import { JobStatus, Provider } from './enums';

export interface Session {
  sessionId: string;
  title: string;
  createdAt: string;
  lastActive: string;
}

export interface Job {
  jobId: string;
  sessionId: string;
  status: JobStatus;
  question: string;
  answer?: string;
  citations?: Citation[];
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface Citation {
  docname: string;
  textName: string;
  quote: string;
  relevanceScore: number;
}

export interface Document {
  filename: string;
  status: 'INDEXED' | 'PENDING' | 'FAILED' | 'IN_PROGRESS' | 'STARTING' | 'IGNORED' | 'DELETING';
  updatedAt: string;
  orcid: string | null;
}

export interface UserSettings {
  modelConfig: ModelConfig;
  retrievalConfig: RetrievalConfig;
}

export interface ModelConfig {
  llm: ModelSelection;
  summaryLlm: ModelSelection;
  agentLlm: ModelSelection;
  embedding: ModelSelection;
  createdAt: string;
  updatedAt: string;
}

export interface ModelSelection {
  provider: Provider;
  modelId: string;
}

export interface RetrievalConfig {
  evidenceK: number;
  maxSources: number;
  mmrLambda: number;
  evidenceSummaryLength: number;
  answerLength: number;
  createdAt: string;
  updatedAt: string;
}

export interface SecretsStatus {
  anthropicApiKey: boolean;
  openaiApiKey: boolean;
  openalexApiKey: boolean;
  ncbiApiKey: boolean;
}

export interface FetchedPaper {
  orcid: string;
  title: string;
  doi: string | null;
  status: 'success' | 'failure';
  failure_reason: 'not_open_access' | 'not_found' | 'download_error' | null;
  attempted_url: string | null;
}

export interface FetchedOrcidResult {
  orcid: string;
  papers: FetchedPaper[];
}
