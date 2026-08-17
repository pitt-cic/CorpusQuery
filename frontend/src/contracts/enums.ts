export const JobStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  INDEXING: 'indexing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const Provider = {
  BEDROCK: 'bedrock',
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];
