#!/usr/bin/env python3
"""
Probe LiteLLM Bedrock support for embeddings and completions.
Run: uv run python backend/scripts/probe_litellm.py

If embedding fails, we'll need a direct boto3 fallback.
If completion fails, paper-qa's LLM calls won't work via LiteLLM.
"""
import asyncio
import sys

import litellm


async def probe_embedding() -> tuple[bool, str]:
    """Test LiteLLM Bedrock embedding."""
    print("=" * 60)
    print("Probe 1: LiteLLM Bedrock Embedding")
    print("  Model: bedrock/amazon.titan-embed-text-v2:0")
    print("=" * 60)

    try:
        response = await litellm.aembedding(
            model="bedrock/amazon.titan-embed-text-v2:0",
            input=["The AURORA study identified metastatic breast cancer patterns."],
        )
        embedding = response.data[0]["embedding"]
        dims = len(embedding)

        if dims == 1024:
            print(f"  PASS: {dims}-dimensional vector returned")
            return True, ""
        else:
            msg = f"Unexpected dimensions: expected 1024, got {dims}"
            print(f"  FAIL: {msg}")
            return False, msg

    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        print(f"  FAIL: {msg}")
        return False, msg


async def probe_completion() -> tuple[bool, str]:
    """Test LiteLLM Bedrock completion."""
    print("\n" + "=" * 60)
    print("Probe 2: LiteLLM Bedrock Completion")
    print("  Model: bedrock/us.anthropic.claude-sonnet-4-6")
    print("=" * 60)

    try:
        response = await litellm.acompletion(
            model="bedrock/us.anthropic.claude-sonnet-4-6",
            messages=[{"role": "user", "content": "Reply with exactly one word: hello"}],
            max_tokens=10,
        )
        text = response.choices[0].message.content

        if text:
            print(f"  PASS: Response received: '{text.strip()}'")
            return True, ""
        else:
            msg = "Empty response"
            print(f"  FAIL: {msg}")
            return False, msg

    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        print(f"  FAIL: {msg}")
        return False, msg


async def main():
    embed_ok, embed_err = await probe_embedding()
    completion_ok, completion_err = await probe_completion()

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"  Embedding:  {'PASS' if embed_ok else 'FAIL'}")
    print(f"  Completion: {'PASS' if completion_ok else 'FAIL'}")

    if not embed_ok:
        print("\n** HALT: Embedding probe failed **")
        print(f"   Error: {embed_err}")
        print("   Alternative: Use direct boto3 bedrock-runtime.invoke_model()")
        print("   Awaiting user approval to proceed with alternative.")
        sys.exit(1)

    if not completion_ok:
        print("\n** HALT: Completion probe failed **")
        print(f"   Error: {completion_err}")
        print("   This may indicate Bedrock model access is not enabled.")
        print("   Check AWS console: Bedrock > Model access")
        sys.exit(1)

    print("\nAll probes passed. LiteLLM Bedrock integration is working.")
    sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
