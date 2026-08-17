import io
import os
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
headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

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

        researcher_last_name = get_researcher_last_name(orcid)
        dois, no_doi, doi_to_title = get_doi_and_title(orcid) # uses ORCID API to get DOIs and titles of a given researcher's /works section
        total = len(dois) + len(no_doi)
        summary = []
        successes = 0

        # Update job status to processing
        jobs_repo.update_job_status(user_id, sk, "processing")

        MAX_WORKERS = 5  # conservative to respect API rate limits

        # Build a flat list of all papers: (doi_or_None, title, initial_reason)
        all_papers = [(doi, doi_to_title[doi], "unpaywall") for doi in dois] + \
                     [(None, title, "not_found") for title in no_doi]

        def process_paper(doi, title, initial_reason):
            failure_reason = initial_reason
            downloaded = False
            attempted_url = None

            # Step 1: Unpaywall (only for papers with a DOI)
            if doi:
                response = requests.get(f'https://api.unpaywall.org/v2/{doi}?email={user_email}')
                if not response.ok or not response.text.strip():
                    logger.warning(f"Unpaywall returned {response.status_code} for DOI {doi}, skipping to OpenAlex")
                    failure_reason = "not_found"
                else:
                    doi_dict = response.json()
                    oa_locations = doi_dict.get('oa_locations') or []
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
                                if download_to_bucket(orcid, title, url):
                                    logger.info(f'Successfully downloaded {title}')
                                    downloaded = True
                                    break
                            if not downloaded:
                                logger.info(f'No working URL found via Unpaywall for {title}, will try OpenAlex')
                                failure_reason = "download_error"

            # Step 2: OpenAlex
            if not downloaded:
                url = search_by_title(title, orcid, openalex_api_key)
                time.sleep(0.2)
                if url:
                    attempted_url = url
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
                "attempted_url": None if downloaded else attempted_url,
            }

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(process_paper, doi, title, reason): title
                for doi, title, reason in all_papers
            }
            for future in as_completed(futures):
                result = future.result()
                summary.append(result)
                if result["status"] == "success":
                    successes += 1

        download_answer = f"Successfully downloaded {successes} PDFs out of {total} results"

        if job_id and user_id:
            jobs_repo.update_job_status(user_id, sk, "indexing")
            logger.info(f"Updated DynamoDB job status to indexing for job_id={job_id}, user_id={user_id}")

        lambda_client = boto3.client('lambda')
        lambda_client.invoke(
            FunctionName=os.environ.get("INDEXER_FUNCTION_NAME"),
            InvocationType="Event",  # Async
            Payload=json.dumps({
                "orcid": orcid,
                "user_id": user_id,
                "sk": sk,
                "answer": download_answer,
            }),
        )
        logger.info(f"Triggered indexer for ORCID {orcid}")

    
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

    # pulls ORCID works list
    response = requests.get(f"https://pub.orcid.org/v3.0/{orcid}/works", headers=headers)
    if not response.ok or not response.text.strip():
        raise ValueError(f"ORCID API returned {response.status_code} for {orcid}: {response.text[:200]}")
    data = response.json()

    doi_to_title = {}
    no_doi_titles = []

    for group in data.get("group", []):
        summary = group["work-summary"][0]
        work_type = summary.get("type", "").lower().replace("_", "-")
        if work_type not in PAPER_WORK_TYPES:
            logger.info(f"Skipping work of type '{work_type}': {summary['title']['title']['value']}")
            continue
        title = summary["title"]["title"]["value"]
        doi = None
        ext_ids = summary.get("external-ids") or {}

        for ext_id in (ext_ids.get("external-id") or []):
            if ext_id["external-id-type"] == "doi":
                doi = ext_id["external-id-value"]
                break

        if doi:
            dois.append(doi)
            doi_to_title[doi] = title
        else:
            no_doi_titles.append(title)

    print(f"Total works: {len(data.get('group', []))} | With DOI: {len(dois)} | Without DOI: {len(no_doi_titles)}")
    return (dois, no_doi_titles, doi_to_title)



def search_by_title(title, orcid, api_key):

    query_params = {
        "search": title,
        "filter": f"author.orcid:{orcid}",
        "api_key": api_key,
    }

    response = requests.get("https://api.openalex.org/works", params=query_params)
    if not response.ok or not response.text.strip():
        logger.warning(f"OpenAlex returned {response.status_code} for title '{title}'")
        return None
    results = response.json()

    try: 

        result_list = results.get('results') or []

        if not result_list:
            logger.info(f"No results found for {title} with ORCID {orcid}")
            return None

        results_dict = result_list[0]

        print(results_dict)
        
        prim_loc = results_dict.get('primary_location', '')

        if prim_loc.get('is_oa') == True:
            pdf_url = prim_loc.get('pdf_url')

            if pdf_url and pdf_url.lower().split('?')[0].endswith(SKIP_URL_EXTENSIONS):
                logger.info(f"Skipping non-PDF URL for '{title}': {pdf_url}")
                return None

            if pdf_url == None:
                landing_page = prim_loc.get('doi', '')
                if landing_page:
                    logger.info(f'doi for {title}: {landing_page}')
                    return landing_page

            logger.info(f'Successfully retrieved URL for {title}: {pdf_url}')
            return pdf_url

        else:
            logger.info(f'No open access pdf available for document {title}')
            return None

    except Exception as e:
        print(f'Error: {e}')
        pass




def get_researcher_last_name(orcid: str) -> str | None:
    """Fetch the researcher's family name from the ORCID public API."""
    try:
        resp = requests.get(f"https://pub.orcid.org/v3.0/{orcid}/person", headers=headers, timeout=10)
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
    try:
        term = f'"{title}"[Title] AND "{author_last_name}"[Author]'
        params = {"db": "pmc", "term": term, "retmode": "json", "retmax": 1}
        if api_key:
            params["api_key"] = api_key
        resp = requests.get(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", 
            params=params,
            timeout=10,
        )
        if not resp.ok:
            return None
        ids = resp.json().get("esearchresult", {}).get("idlist", [])
        if not ids:
            return None
        return f"PMC{ids[0]}"
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

    for ft in ("pdf", "txt"):
        src_key = f"{prefix}/{prefix}.{ft}"
        dest_key = f"fetched-papers/{orcid}/{title}.{ft}"
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


def download_to_bucket(orcid, title, url) -> bool:
    """
    Download files directly from the OA URL to your bucket.
    Returns False on any HTTP error (403, 404, etc.) without raising.
    """
    bucket = BUCKET_NAME
    key = f'fetched-papers/{orcid}/{title}.pdf'

    try:
        with requests.get(url, headers=headers, stream=True, timeout=30) as r:
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