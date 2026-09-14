import io
import os
import re
import threading
import unicodedata
import boto3
from botocore import UNSIGNED
from botocore.config import Config
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import logging
import requests
import time
import json
from shared import SecretsClient
from shared import JobsRepository

logger = logging.getLogger()
logger.setLevel(logging.INFO)
TABLE_NAME = os.getenv("SESSIONS_AND_CHAT_HISTORY_TABLE_NAME","")
api_headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
download_headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/pdf, */*"}

PMC_OA_BUCKET = 'pmc-oa-opendata'
pmc_s3 = boto3.client('s3', region_name='us-east-1', config=Config(signature_version=UNSIGNED))

# ORCID work types that represent actual papers/documents worth downloading
PAPER_WORK_TYPES = {
    "journal-article", "book", "book-chapter", "conference-paper",
    "conference-abstract", "dissertation", "preprint", "report",
    "working-paper", "edited-book", "other",
}

# File extensions in the URL path that indicate media/supplementary files (not PDFs)
SKIP_URL_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".tif", ".tiff", ".svg", ".mp4", ".zip", ".xlsx", ".csv")
BUCKET_NAME = os.getenv("BUCKET_NAME","")
s3_client = boto3.client('s3')

secrets_manager= boto3.client("secretsmanager")
secrets_client= SecretsClient(secrets_manager)

# Fully serializes OpenAlex requests — only 1 call at a time across all worker threads.
# Even Semaphore(2) still triggers 429s because two simultaneous requests from the same
# AWS Lambda NAT IP hit OpenAlex's IP-level rate limit. Semaphore(1) prevents this entirely.
_openalex_semaphore = threading.Semaphore(1)

def handler(event, context):
    """Uses ORCID APIs to retrieve works from given ORCID and uses Unpaywall or OpenAlex to get downloadable PDFs of papers"""

    user_id = event['user_id']
    job_id = event['job_id']
    orcid = event['orcid']
    user_email = event['user_email']

    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(TABLE_NAME)
    jobs_repo = JobsRepository(table)

    api_keys = secrets_client.get_secrets(user_id)
    openalex_api_key = api_keys.get("OPENALEX_API_KEY")
    ncbi_api_key = api_keys.get("NCBI_API_KEY")

    # Get the job to find the correct SK
    job = jobs_repo.get_job(user_id, job_id)
    if not job:
        raise ValueError(f"Job {job_id} not found for user {user_id}")
    sk = job["sk"]
    logger.info(f"Found job with SK: {sk}")

    try:

        jobs_repo.update_job_status(user_id, sk, "processing")

        researcher_last_name = get_researcher_last_name(orcid)
        dois, no_doi, doi_to_title = get_doi_and_title(orcid) # uses ORCID API to get DOIs and titles of a given researcher's /works section
        total = len(dois) + len(no_doi)
        summary = []
        successes = 0

        MAX_WORKERS = 5  # conservative to respect API rate limits

        # Load previous results to: (a) recover URLs for already-in-S3 papers, and
        # (b) skip papers we already know are not OA or bot-blocked.
        prev_urls: dict[str, str | None] = {}
        prev_skip: dict[str, str] = {}  # title → failure_reason to carry forward
        try:
            prev_obj = s3_client.get_object(
                Bucket=BUCKET_NAME,
                Key=f'download-results/{user_id}/{orcid}.json',
            )
            prev_summary = json.loads(prev_obj["Body"].read())
            for p in prev_summary:
                prev_urls[p["title"]] = p.get("attempted_url")
                if p.get("failure_reason") in ("not_open_access", "download_error"):
                    prev_skip[p["title"]] = p["failure_reason"]
            logger.info(f"Loaded previous results: {len(prev_skip)} papers to skip")
        except s3_client.exceptions.ClientError:
            pass  # No previous results — first fetch for this researcher

        # Build a flat list of all papers: (doi_or_None, title, initial_reason)
        all_papers = [(doi, doi_to_title[doi], "unpaywall") for doi in dois] + \
                     [(None, title, "not_found") for title in no_doi]

        def _extract_pmcid(url: str) -> str | None:
            """Extract PMCID from any PMC web URL (handles both old/new formats, with or without PMC prefix)."""
            match = re.search(r'(?:ncbi\.nlm\.nih\.gov/pmc|pmc\.ncbi\.nlm\.nih\.gov)/articles/(PMC)?(\d+)', url)
            if match:
                return f"PMC{match.group(2)}"
            return None

        def process_paper(doi, title, initial_reason):
            failure_reason = initial_reason
            downloaded = False
            attempted_url = None

            # Skip papers previously confirmed not OA or bot-blocked (no point retrying)
            if title in prev_skip:
                logger.info(f"Skipping '{title}' — previously {prev_skip[title]}")
                return {
                    "orcid": orcid,
                    "title": title,
                    "doi": doi,
                    "status": "failure",
                    "failure_reason": prev_skip[title],
                    "attempted_url": prev_urls.get(title),
                }

            # Skip if already downloaded (both .pdf and .txt variants)
            safe_title = re.sub(r'[^\w\s\-]', '_', title).strip()
            for ext in (".pdf", ".txt"):
                key = f"fetched-papers/{orcid}/{safe_title}{ext}"
                try:
                    s3_client.head_object(Bucket=BUCKET_NAME, Key=key)
                    logger.info(f"Already in S3, skipping download: {key}")
                    return {
                        "orcid": orcid,
                        "title": title,
                        "doi": doi,
                        "status": "success",
                        "failure_reason": None,
                        "attempted_url": prev_urls.get(title),
                    }
                except s3_client.exceptions.ClientError:
                    pass

            # Step 1: Unpaywall (only for papers with a DOI)
            if doi:
                try:
                    response = requests.get(f'https://api.unpaywall.org/v2/{doi}?email={user_email}', timeout=15)
                except requests.RequestException as e:
                    logger.warning(f"Unpaywall request failed for DOI {doi}: {e}")
                    response = None
                if response is None or not response.ok or not response.text.strip():
                    if response is not None:
                        logger.warning(f"Unpaywall returned {response.status_code} for DOI {doi}, skipping to OpenAlex")
                    failure_reason = "not_found"
                else:
                    doi_dict = response.json()
                    oa_locations = (doi_dict.get('oa_locations') or []) + \
                                   (doi_dict.get('oa_locations_embargoed') or [])
                    if not oa_locations:
                        failure_reason = "not_open_access"
                    else:
                        # Prefer repository URLs (arXiv, PMC, institutional) over publisher URLs
                        # since publishers often block bots, but still fall back to publisher URLs
                        repo_locs = [loc for loc in oa_locations if loc.get('host_type') == 'repository']
                        other_locs = [loc for loc in oa_locations if loc.get('host_type') != 'repository']
                        ranked = repo_locs + other_locs

                        candidate_urls = [loc.get('url_for_pdf') or loc.get('url') for loc in ranked]
                        candidate_urls = [
                            u for u in candidate_urls
                            if u and not u.lower().split('?')[0].endswith(SKIP_URL_EXTENSIONS)
                        ]

                        if not candidate_urls:
                            logger.info(f'No OA URLs for {title}, will try OpenAlex')
                            failure_reason = "not_open_access"
                        else:
                            for url in candidate_urls:
                                attempted_url = url
                                logger.info(f"Trying URL for {title}: {url}")
                                # PMC web URLs are blocked from Lambda IPs — route to S3 OA bucket instead
                                pmcid = _extract_pmcid(url)
                                if pmcid and download_from_pmc_bucket(pmcid, orcid, title):
                                    logger.info(f'Successfully downloaded {title} from PMC S3')
                                    downloaded = True
                                    break
                                if download_to_bucket(orcid, title, url):
                                    logger.info(f'Successfully downloaded {title}')
                                    downloaded = True
                                    break
                            if not downloaded:
                                logger.info(f'No working URL found via Unpaywall for {title}, will try OpenAlex')
                                failure_reason = "download_error"

            # Step 2: OpenAlex
            if not downloaded:
                url = search_by_title(title, orcid, openalex_api_key, doi=doi)
                time.sleep(0.2)
                if url:
                    attempted_url = url
                    pmcid = _extract_pmcid(url)
                    if pmcid:
                        downloaded = download_from_pmc_bucket(pmcid, orcid, title)
                    if not downloaded:
                        downloaded = download_to_bucket(orcid, title, url)
                    if not downloaded:
                        failure_reason = "download_error"
                else:
                    if failure_reason not in ("not_open_access",):
                        failure_reason = "not_found"

            # Step 3: PMC
            if not downloaded and researcher_last_name:
                logger.info(f"OpenAlex failed for '{title}', trying PMC...")
                pmcid = search_pmc_by_title(title, ncbi_api_key, researcher_last_name)
                if pmcid:
                    attempted_url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/"
                    downloaded = download_from_pmc_bucket(pmcid, orcid, title)
                    if downloaded:
                        logger.info(f"Successfully downloaded {pmcid} from PMC")
                    else:
                        failure_reason = "download_error"
                time.sleep(0.1 if ncbi_api_key else 0.34)

            return {
                "orcid": orcid,
                "title": title,
                "doi": doi,
                "status": "success" if downloaded else "failure",
                "failure_reason": None if downloaded else failure_reason,
                "attempted_url": attempted_url,
            }

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(process_paper, doi, title, reason): title
                for doi, title, reason in all_papers
            }
            for future in as_completed(futures):
                try:
                    result = future.result()
                except Exception as e:
                    title = futures[future]
                    logger.warning(f"Unexpected error processing '{title}': {e}")
                    summary.append({
                        "orcid": orcid,
                        "title": title,
                        "doi": None,
                        "status": "failure",
                        "failure_reason": "download_error",
                        "attempted_url": None,
                    })
                    continue
                summary.append(result)
                if result["status"] == "success":
                    successes += 1

        download_answer = f"Successfully downloaded {successes} PDFs out of {total} results"

        if job_id and user_id:
            jobs_repo.update_job_status(user_id, sk, "indexing")
            logger.info(f"Updated DynamoDB job status to indexing for job_id={job_id}, user_id={user_id}")

        sqs_client = boto3.client('sqs')
        sqs_client.send_message(
            QueueUrl=os.environ["INDEXING_JOBS_QUEUE_URL"],
            MessageBody=json.dumps({
                "orcid": orcid,
                "user_id": user_id,
                "sk": sk,
                "answer": download_answer,
            }),
        )
        logger.info(f"Queued indexing job for ORCID {orcid}")

    
        results_json = json.dumps(summary, indent=2)


        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=f'download-results/{user_id}/{orcid}.json',
            Body=results_json,
            ContentType='application/json'

        )

        output = {
            'statusCode': 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                'job_id': job_id,
                'user_id': user_id,
                'message' : 'Research papers successfully downloaded',
                'answer': summary,

            })


        }

        return output
    
    except Exception as e:
        logger.info(f"Error downloading papers: {str(e)}")
        
        # Update job status to failed if we have the IDs and SK
        if 'job_id' in locals() and 'user_id' in locals() and 'sk' in locals() and job_id and user_id and sk:
            try:
                jobs_repo.update_job_status(
                    user_id,
                    sk,
                    "failed",
                    error=str(e)
                )
                logger.info(f"Updated job {job_id} status to failed")
            except Exception as db_error:
                logger.error(f"Failed to update job status: {db_error}")

        return {
            'statusCode':500,
            'body':json.dumps({'error':str(e)})
        }

def get_doi_and_title(orcid):
    dois = []
    doi_to_title = {}
    no_doi_titles = []
    seen_titles = set()
    seen_group_keys = set()  # all groups seen (any type) — drives early termination

    page_size = 200
    start = 0
    total_summaries = None

    while True:
        response = requests.get(
            f"https://pub.orcid.org/v3.0/{orcid}/works",
            headers=api_headers,
            params={"page-size": page_size, "start": start},
            timeout=30,
        )
        if not response.ok or not response.text.strip():
            raise ValueError(f"ORCID API returned {response.status_code} for {orcid}: {response.text[:200]}")
        data = response.json()
        if total_summaries is None:
            total_summaries = data.get("total", 0)

        page_groups = data.get("group", [])
        new_this_page = 0

        for group in page_groups:
            summaries = group.get("work-summary", [])
            if not summaries:
                continue
            first = summaries[0]
            work_type = first.get("type", "").lower().replace("_", "-")
            title = first["title"]["title"]["value"]

            # Search all summaries in this group for a DOI
            doi = None
            for summary in summaries:
                ext_ids = summary.get("external-ids") or {}
                for ext_id in (ext_ids.get("external-id") or []):
                    if ext_id["external-id-type"] == "doi":
                        doi = ext_id["external-id-value"]
                        break
                if doi:
                    break

            # Normalize DOI URL prefixes
            if doi:
                for prefix in ("https://doi.org/", "http://doi.org/", "https://dx.doi.org/", "http://dx.doi.org/"):
                    if doi.startswith(prefix):
                        doi = doi[len(prefix):]
                        break

            group_key = doi if doi else title
            if group_key in seen_group_keys:
                continue  # duplicate group from a previous page, skip
            seen_group_keys.add(group_key)
            new_this_page += 1

            if work_type not in PAPER_WORK_TYPES:
                logger.info(f"Skipping work of type '{work_type}': {title}")
                continue

            if doi:
                dois.append(doi)
                doi_to_title[doi] = title
            elif title not in seen_titles:
                seen_titles.add(title)
                no_doi_titles.append(title)

        start += page_size
        if new_this_page == 0 or start >= total_summaries:
            break

    logger.info(f"ORCID pagination done | With DOI: {len(dois)} | Without DOI: {len(no_doi_titles)}")
    return (dois, no_doi_titles, doi_to_title)



def normalize_title(title: str) -> str:
    """Lowercase, strip accents, collapse whitespace, remove punctuation for fuzzy title comparison."""
    # Normalize unicode (e.g. accented chars → base + combining mark, then drop combining marks)
    title = unicodedata.normalize("NFD", title)
    title = "".join(c for c in title if unicodedata.category(c) != "Mn")
    title = title.lower()
    # Replace any punctuation/special chars with a space
    title = re.sub(r"[^\w\s]", " ", title)
    # Collapse whitespace
    title = re.sub(r"\s+", " ", title).strip()
    return title


def _get_oa_url_from_work(work: dict, title: str) -> str | None:
    """
    Extract the best OA URL from an OpenAlex work object.
    Prefers a direct pdf_url from any OA location before falling back to landing pages.
    """
    candidates = [
        work.get('primary_location') or {},
        work.get('best_oa_location') or {},
        *(work.get('locations') or []),
    ]
    oa_locations = [loc for loc in candidates if loc.get('is_oa')]

    # Pass 1: prefer direct PDF links across all OA locations
    for loc in oa_locations:
        pdf_url = loc.get('pdf_url')
        if pdf_url and not pdf_url.lower().split('?')[0].endswith(SKIP_URL_EXTENSIONS):
            logger.info(f"Found OA PDF URL for '{title}': {pdf_url}")
            return pdf_url

    # Pass 2: fall back to landing pages
    for loc in oa_locations:
        landing = loc.get('landing_page_url')
        if landing:
            logger.info(f"Found OA landing page for '{title}': {landing}")
            return landing

    return None


def _titles_match(a: str, b: str, threshold: float = 0.8) -> bool:
    """True if ≥80% of words overlap between the two normalized titles."""
    words_a = set(normalize_title(a).split())
    words_b = set(normalize_title(b).split())
    if not words_a or not words_b:
        return False
    overlap = len(words_a & words_b) / max(len(words_a), len(words_b))
    return overlap >= threshold


def _openalex_get(url, params, title, context=""):
    """
    GET an OpenAlex endpoint with serialization + pre-request throttle.
    Sleeps 0.5s before each call (~2 req/s) to stay under rate limit.
    On 429, returns None immediately — caller falls through to PMC rather
    than burning Lambda time on retries.
    """
    with _openalex_semaphore:
        time.sleep(0.5)  # ~2 req/s max, well under OpenAlex free-tier limit
        try:
            resp = requests.get(url, params=params, timeout=10)
        except Exception as e:
            logger.warning(f"OpenAlex request failed for '{title}'{context}: {e}")
            return None
        if resp.status_code == 429:
            logger.warning(f"OpenAlex rate limited (429), skipping to PMC{context}")
            return None
        return resp


def search_by_title(title, orcid, api_key, doi=None):
    openalex_params = {"api_key": api_key} if api_key else {}

    # Strategy 1: DOI direct lookup — most reliable when we have a DOI
    if doi:
        resp = _openalex_get(
            f"https://api.openalex.org/works/doi:{doi}",
            openalex_params,
            title,
            context=f" (DOI {doi})",
        )
        if resp is not None and resp.ok and resp.text.strip():
            work = resp.json()
            url = _get_oa_url_from_work(work, title)
            if url:
                return url
            logger.info(f"OpenAlex DOI lookup found '{title}' but it is not OA")
            return None

    # Strategy 2: title + ORCID filter
    if not orcid.startswith("https://orcid.org/"):
        orcid_filter = f"https://orcid.org/{orcid}"
    else:
        orcid_filter = orcid
    # Strip special chars that can break title.search phrase syntax (e.g. "--", "&")
    query_title = re.sub(r'[^\w\s]', ' ', title)
    query_title = re.sub(r'\s+', ' ', query_title).strip()

    for filter_str in [
        f'title.search:"{query_title}",author.orcid:{orcid_filter}',
        f'title.search:"{query_title}"',  # Strategy 3: title-only fallback (ORCID may not be linked)
    ]:
        resp = _openalex_get(
            "https://api.openalex.org/works",
            {"filter": filter_str, **openalex_params},
            title,
        )
        if resp is None or not resp.ok or not resp.text.strip():
            if resp is not None:
                logger.warning(f"OpenAlex returned {resp.status_code} for filter '{filter_str}'")
            continue
        result_list = resp.json().get('results') or []
        if not result_list:
            continue

        # Verify a result matches our title before trusting it
        match = None
        for candidate in result_list:
            if _titles_match(candidate.get('title') or '', title):
                match = candidate
                break
        if match is None:
            continue

        url = _get_oa_url_from_work(match, title)
        if url:
            return url
        # Found the paper but it's not OA — stop searching, don't try title-only
        logger.info(f"OpenAlex found '{title}' but it is not OA")
        return None

    logger.info(f"OpenAlex could not find '{title}'")
    return None




def get_researcher_last_name(orcid: str) -> str | None:
    """Fetch the researcher's family name from the ORCID public API."""
    try:
        resp = requests.get(f"https://pub.orcid.org/v3.0/{orcid}/person", headers=api_headers, timeout=10)
        if not resp.ok:
            return None
        data = resp.json()
        return data.get("name", {}).get("family-name", {}).get("value")
    except Exception:
        return None


def search_pmc_by_title(title: str, api_key: str | None, author_last_name: str) -> str | None:
    """
    Use NCBI API to search PubMed for a paper by title and author last name.
    Returns the PMCID (e.g. 'PMC1234567') if found, or None.
    """
    base_params = {"db": "pmc", "retmode": "json", "retmax": 1}
    if api_key:
        base_params["api_key"] = api_key

    # Sanitize title — special chars (e.g. "--") break NCBI query syntax
    query_title = re.sub(r'[^\w\s]', ' ', title)
    query_title = re.sub(r'\s+', ' ', query_title).strip()
    # Try exact quoted title first, then unquoted (broader) as fallback
    terms = [
        f'"{query_title}"[Title] AND "{author_last_name}"[Author]',
        f'{query_title}[Title] AND "{author_last_name}"[Author]',
    ]
    try:
        for term in terms:
            resp = requests.get(
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
                params={"term": term, **base_params},
                timeout=10,
            )
            if not resp.ok:
                continue
            ids = resp.json().get("esearchresult", {}).get("idlist", [])
            if ids:
                return f"PMC{ids[0]}"
        return None
    except Exception:
        return None


def get_latest_pmc_prefix(pmcid: str) -> str | None:
    """
    Look up the latest versioned S3 prefix for a PMCID in the PMC OA bucket metadata.
    Returns a prefix like 'PMC1234567.3' or None if not in the OA dataset.
    """
    try:
        response = pmc_s3.list_objects_v2(
            Bucket=PMC_OA_BUCKET,
            Prefix=f"metadata/{pmcid}.",
        )
        objects = response.get("Contents", [])
        if not objects:
            return None

        def version_number(obj):
            stem = obj["Key"].split("/")[-1].rsplit(".", 1)[0]  # metadata/PMC123.2.json → PMC123.2
            try:
                return int(stem.rsplit(".", 1)[-1])
            except ValueError:
                return 0

        latest = max(objects, key=version_number)
        return latest["Key"].split("/")[-1].rsplit(".", 1)[0]
    except Exception as e:
        logger.warning(f"Error looking up PMC prefix for {pmcid}: {e}")
        return None


def download_from_pmc_bucket(pmcid: str, orcid: str, title: str) -> bool:
    """
    Copy a paper directly from the PMC OA open-data S3 bucket to our bucket.
    Tries PDF first, then TXT. Returns True if either succeeds.
    """
    prefix = get_latest_pmc_prefix(pmcid)
    if prefix is None:
        logger.info(f"{pmcid} not found in PMC OA dataset")
        return False

    safe_title = re.sub(r'[^\w\s\-]', '_', title).strip()
    for ft in ("pdf", "txt"):
        src_key = f"{prefix}/{prefix}.{ft}"
        dest_key = f"fetched-papers/{orcid}/{safe_title}.{ft}"
        content_type = "application/pdf" if ft == "pdf" else "text/plain"
        try:
            obj = pmc_s3.get_object(Bucket=PMC_OA_BUCKET, Key=src_key)
            body = obj["Body"].read()
            s3_client.put_object(
                Bucket=BUCKET_NAME,
                Key=dest_key,
                Body=body,
                ContentType=content_type,
            )
            logger.info(f"Copied {src_key} from PMC OA bucket → {dest_key}")
            return True
        except s3_client.exceptions.ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("404", "NoSuchKey"):
                logger.info(f"{src_key} not available in PMC OA bucket")
            else:
                logger.warning(f"S3 error for {src_key}: {exc}")
        except Exception as exc:
            logger.warning(f"Unexpected error copying {src_key}: {exc}")

    return False


def resolve_pdf_url(url: str) -> str:
    """
    Convert known landing page URLs to direct PDF URLs.
    Returns the original URL unchanged if no pattern matches.
    """
    # PMC: /pmc/articles/PMC{id}/ or /pmc/articles/{id} (no PMC prefix)
    pmc_match = re.match(r'(https?://www\.ncbi\.nlm\.nih\.gov/pmc/articles/)(PMC)?(\d+)/?$', url)
    if pmc_match:
        pmcid = f"PMC{pmc_match.group(3)}"
        return f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/pdf/"

    # bioRxiv / medRxiv: append .full.pdf to the versioned content URL
    if re.search(r'(biorxiv|medrxiv)\.org/content/', url) and not url.endswith('.pdf'):
        base = url.split('?')[0].rstrip('/')
        return base + '.full.pdf'

    # arXiv: arxiv.org/abs/{id} → arxiv.org/pdf/{id}
    if re.search(r'arxiv\.org/abs/', url):
        return url.replace('/abs/', '/pdf/', 1)

    # PeerJ: peerj.com/articles/{id} → peerj.com/articles/{id}.pdf
    if re.search(r'peerj\.com/articles/', url) and not url.endswith('.pdf'):
        return url.split('?')[0].rstrip('/') + '.pdf'

    # PLOS: doi.org/10.1371/journal.{code}.{id} → direct PDF
    plos_match = re.match(r'https?://(?:dx\.)?doi\.org/(10\.1371/journal\.(\w+)\.\d+)', url)
    if plos_match:
        full_doi = plos_match.group(1)
        journal_code = plos_match.group(2)
        journal_path_map = {
            'pone': 'plosone', 'pbio': 'plosbiology', 'pmed': 'plosmedicine',
            'pgen': 'plosgenetics', 'pcbi': 'ploscompbiol', 'ppat': 'plospathogens',
            'pntd': 'plosntds', 'pwat': 'ploswater',
        }
        journal_path = journal_path_map.get(journal_code, f'plos{journal_code}')
        return f"https://journals.plos.org/{journal_path}/article/file?id={full_doi}&type=printable"

    return url


def download_to_bucket(orcid, title, url) -> bool:
    """
    Download files directly from the OA URL to your bucket.
    Returns False on any HTTP error (403, 404, etc.) without raising.
    """
    url = resolve_pdf_url(url)
    bucket = BUCKET_NAME
    safe_title = re.sub(r'[^\w\s\-]', '_', title).strip()
    key = f'fetched-papers/{orcid}/{safe_title}.pdf'

    try:
        with requests.get(url, headers=download_headers, stream=True, timeout=30) as r:
            r.raise_for_status()

            content_type = r.headers.get('Content-Type', '')
            # Peek at first bytes to check for PDF magic bytes as fallback
            first_chunk = next(r.iter_content(chunk_size=5), b'')
            is_pdf = 'pdf' in content_type.lower() or first_chunk.startswith(b'%PDF-')
            if not is_pdf:
                logger.warning(f"URL did not return a PDF (Content-Type: {content_type}): {url}")
                return False

            remaining = b''.join(r.iter_content(chunk_size=8192))
            full_content = first_chunk + remaining
            s3_client.upload_fileobj(io.BytesIO(full_content), bucket, key,
                                     ExtraArgs={"ContentType": "application/pdf"})
            return True
    except requests.HTTPError as e:
        logger.warning(f"HTTP {e.response.status_code} downloading {url}: {e}")
        return False
    except requests.RequestException as e:
        logger.warning(f"Request error downloading {url}: {e}")
        return False