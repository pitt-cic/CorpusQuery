const STORAGE_PREFIX = 'researcher_';
const JOB_ORCID_PREFIX = 'fetcher_job_';
const FETCHED_ORCIDS_KEY = 'fetched_orcids';
const UPLOADED_PAPERS_KEY = 'manually_uploaded_papers';

export function saveResearcherName(orcid: string, name: string): void {
  localStorage.setItem(`${STORAGE_PREFIX}${orcid}`, name);
}

export function getResearcherName(orcid: string): string | null {
  return localStorage.getItem(`${STORAGE_PREFIX}${orcid}`);
}

export function saveJobOrcid(jobId: string, orcid: string): void {
  localStorage.setItem(`${JOB_ORCID_PREFIX}${jobId}`, orcid);
}

export function getJobOrcid(jobId: string): string | null {
  return localStorage.getItem(`${JOB_ORCID_PREFIX}${jobId}`);
}

export function addFetchedOrcid(orcid: string): void {
  const orcids = getFetchedOrcids();
  if (!orcids.includes(orcid)) {
    orcids.push(orcid);
    localStorage.setItem(FETCHED_ORCIDS_KEY, JSON.stringify(orcids));
  }
}

export function getFetchedOrcids(): string[] {
  const stored = localStorage.getItem(FETCHED_ORCIDS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function removeFetchedOrcid(orcid: string): void {
  const orcids = getFetchedOrcids().filter(o => o !== orcid);
  localStorage.setItem(FETCHED_ORCIDS_KEY, JSON.stringify(orcids));
  localStorage.removeItem(`${STORAGE_PREFIX}${orcid}`);
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
