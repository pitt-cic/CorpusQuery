#!/usr/bin/env python3
"""Index txt/pdf into S3 Vectors for testing.

Usage:
    python backend/scripts/index_papers.py paper1.pdf paper2.pdf
    python backend/scripts/index_papers.py --bucket my-bucket --index my-index *.pdf
    python backend/scripts/index_papers.py --max-chunks 50 paper.pdf
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import boto3

sys.path.insert(0, str(Path(__file__).parent.parent))
s3_client = boto3.client("s3")

def embed_via_bedrock(client, texts: list[str], batch_size: int = 5) -> list[list[float]]:
    """Embed texts using Bedrock Titan Embed V2."""
    embeddings = []
    for i, text in enumerate(texts):
        response = client.invoke_model(
            modelId="amazon.titan-embed-text-v2:0",
            body=json.dumps({
                "inputText": text[:8000],
                "dimensions": 1024,
                "normalize": True,
            }),
            contentType="application/json",
        )
        body = json.loads(response["body"].read())
        embeddings.append(body["embedding"])

        if (i + 1) % batch_size == 0:
            print(f"  Embedded {i + 1}/{len(texts)} chunks...")

    return embeddings


async def index_doc(
    doc_path: Path | None,
    orcid: str,
    s3vectors_client,
    bedrock_client,
    bucket_name: str,
    index_name: str,
    isPdf: bool,
    max_chunks: int | None = None,
    
) -> int:
    """Index a single txt/pdf into S3 Vectors."""
    from paperqa.readers import read_doc
    from paperqa.types import Doc
    from paperqa_pypdf import parse_pdf_to_pages

    filename = doc_path.name
    normalized = normalize_filename(filename)

    print(f"\nIndexing: {filename}")
    print(f"  Normalized name: {normalized}")

    existing = s3vectors_client.get_vectors(
        vectorBucketName=bucket_name,
        indexName=index_name,
        keys=[vector_key(normalized, 0)],
        returnMetadata=True,
        returnData=True,
    )
    if existing.get("vectors"):
        print(f"  SKIPPED: Already indexed")
        return 0

    doc = Doc(
        docname=normalized,
        dockey=normalized,
        citation=f"{normalized}. {datetime.now().year}.",
    )

    if isPdf == True:
        print(f"  Parsing PDF...")
        texts = await read_doc(path=doc_path, doc=doc, parse_pdf=parse_pdf_to_pages)
    else:
        print(f"  Parsing txt...")
        texts = await read_doc(path=doc_path, doc=doc)

    if not texts:
        print(f"  WARNING: No chunks extracted")
        return 0

    print(f"  Parsed {len(texts)} chunks")

    if max_chunks and len(texts) > max_chunks:
        texts = texts[:max_chunks]
        print(f"  Limited to {max_chunks} chunks")

    print(f"  Embedding {len(texts)} chunks...")
    chunk_texts = [t.text for t in texts]
    embeddings = embed_via_bedrock(bedrock_client, chunk_texts)

    indexed_at = datetime.now(timezone.utc).isoformat()
    vectors = [
        {
            "key": vector_key(normalized, i),
            "data": {"float32": emb},
            "metadata": {
                "text": texts[i].text[:1500],
                "docname": normalized,
                "original_filename": filename,
                "chunk_index": str(i),
                "doc_citation": doc.citation,
                "indexed_at": indexed_at,
                "orcid": orcid
            },
        }
        for i, emb in enumerate(embeddings)
    ]

    print(f"  Writing {len(vectors)} vectors to S3 Vectors...")
    for i in range(0, len(vectors), 500):
        batch = vectors[i : i + 500]
        s3vectors_client.put_vectors(
            vectorBucketName=bucket_name,
            indexName=index_name,
            vectors=batch,
        )

    print(f"  DONE: Indexed {len(vectors)} vectors")
    return len(vectors)



"""Key normalization utilities for vector storage."""
import re
from pathlib import Path


def normalize_filename(filename: str) -> str:
    """Normalize a filename to a valid vector key prefix.

    'AURORA (final).pdf' -> 'aurora_final'
    'Sayali Nat Cancer.pdf' -> 'sayali_nat_cancer'
    """
    stem = Path(filename).stem
    normalized = re.sub(r"[^a-z0-9]", "_", stem.lower())
    return re.sub(r"_+", "_", normalized).strip("_")


def vector_key(normalized_prefix: str, chunk_idx: int) -> str:
    """Generate a vector key from prefix and chunk index.

    'aurora_final', 3 -> 'aurora_final_0003'
    """
    return f"{normalized_prefix}_{chunk_idx:04d}"

async def main():
    parser = argparse.ArgumentParser(description="Index PDFs/txt into S3 Vectors")
    parser.add_argument("docs", nargs="+", type=Path, help="pdf/txt files to index")
    parser.add_argument(
        "--bucket",
        default=os.environ.get("VECTOR_BUCKET", "corpus-query-vectors-dev"),
        help="S3 Vectors bucket name",
    )
    parser.add_argument(
        "--index",
        default=os.environ.get("VECTOR_INDEX", "papers"),
        help="Vector index name",
    )
    parser.add_argument(
        "--region",
        default=os.environ.get("AWS_REGION", "us-east-1"),
        help="AWS region",
    )
    parser.add_argument(
        "--max-chunks",
        type=int,
        default=None,
        help="Maximum chunks per document",
    )
    parser.add_argument(
        "--orcid",
        type=str,
        default=None,
        help="Researcher's ORCID"
    )
    parser.add_argument(
        "--isPdf",
        type=bool,
        default=False,
        help="if the document you are parsing is a PDF"
    )

    args = parser.parse_args()

    doc_paths = []
    for p in args.docs:
        if not p.exists():
            print(f"ERROR: File not found: {p}", file=sys.stderr)
            sys.exit(1)
        if p.suffix.lower() != ".pdf" and p.suffix.lower() != ".txt":
            print(f"WARNING: Skipping non-PDF/txt : {p}", file=sys.stderr)
            continue
        doc_paths.append(p)

    if not doc_paths:
        print("ERROR: No valid PDF files provided", file=sys.stderr)
        sys.exit(1)

    print("=" * 60)
    print("S3 Vectors PDF Indexer")
    print("=" * 60)
    print(f"Bucket: {args.bucket}")
    print(f"Index:  {args.index}")
    print(f"Region: {args.region}")
    print(f"Documents:   {len(doc_paths)}")
    if args.max_chunks:
        print(f"Max chunks per doc: {args.max_chunks}")
    print("=" * 60)

    s3vectors_client = boto3.client("s3vectors", region_name=args.region)
    bedrock_client = boto3.client("bedrock-runtime", region_name=args.region)

    total_vectors = 0
    for doc_path in doc_paths:
        try:
            count = await index_doc(
                doc_path=doc_path,
                s3vectors_client=s3vectors_client,
                bedrock_client=bedrock_client,
                bucket_name=args.bucket,
                index_name=args.index,
                max_chunks=args.max_chunks,
                orcid=args.orcid,
                isPdf=args.isPdf
            )
            total_vectors += count
        except Exception as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            continue

    print("\n" + "=" * 60)
    print(f"COMPLETE: Indexed {total_vectors} total vectors")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
