let _userId = '';

export function initResearcherStorage(userId: string): void {
  _userId = userId;
}

function scopedKey(base: string): string {
  return _userId ? `${_userId}_${base}` : base;
}

const STORAGE_PREFIX = 'researcher_';
const JOB_ORCID_PREFIX = 'fetcher_job_';
const FETCHED_ORCIDS_KEY = 'fetched_orcids';
const UPLOADED_PAPERS_KEY = 'manually_uploaded_papers';

export function saveResearcherName(orcid: string, name: string): void {
  localStorage.setItem(scopedKey(`${STORAGE_PREFIX}${orcid}`), name);
}

export function getResearcherName(orcid: string): string | null {
  return localStorage.getItem(scopedKey(`${STORAGE_PREFIX}${orcid}`));
}

export function saveJobOrcid(jobId: string, orcid: string): void {
  localStorage.setItem(scopedKey(`${JOB_ORCID_PREFIX}${jobId}`), orcid);
}

export function getJobOrcid(jobId: string): string | null {
  return localStorage.getItem(scopedKey(`${JOB_ORCID_PREFIX}${jobId}`));
}

export function addFetchedOrcid(orcid: string): void {
  const orcids = getFetchedOrcids();
  if (!orcids.includes(orcid)) {
    orcids.push(orcid);
    localStorage.setItem(scopedKey(FETCHED_ORCIDS_KEY), JSON.stringify(orcids));
  }
}

export function getFetchedOrcids(): string[] {
  const stored = localStorage.getItem(scopedKey(FETCHED_ORCIDS_KEY));
  return stored ? JSON.parse(stored) : [];
}

export function removeFetchedOrcid(orcid: string): void {
  const orcids = getFetchedOrcids().filter(o => o !== orcid);
  localStorage.setItem(scopedKey(FETCHED_ORCIDS_KEY), JSON.stringify(orcids));
  localStorage.removeItem(scopedKey(`${STORAGE_PREFIX}${orcid}`));
}

export function isValidOrcid(orcid: string): boolean {
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid);
}

/** Stable key for a paper, used for the manually-uploaded checkbox state. */
export function paperKey(orcid: string, doi: string | null, title: string): string {
  return `${orcid}|${doi ?? title}`;
}

export function getManuallyUploaded(): Set<string> {
  const stored = localStorage.getItem(UPLOADED_PAPERS_KEY);
  return new Set(stored ? JSON.parse(stored) : []);
}

export function toggleManuallyUploaded(key: string): Set<string> {
  const set = getManuallyUploaded();
  if (set.has(key)) {
    set.delete(key);
  } else {
    set.add(key);
  }
  localStorage.setItem(UPLOADED_PAPERS_KEY, JSON.stringify([...set]));
  return set;
}
