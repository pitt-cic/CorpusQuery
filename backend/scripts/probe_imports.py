#!/usr/bin/env python3
"""
Probe paper-qa import paths to discover where classes actually live.
Run: uv run python scripts/probe_imports.py
"""

from typing import Any


def probe_import(module_path: str, class_name: str) -> tuple[bool, Any]:
    """Try to import a class from a module path.

    Returns:
        Tuple of (success, class_or_none)
    """
    try:
        module = __import__(module_path, fromlist=[class_name])
        cls = getattr(module, class_name, None)
        if cls is not None:
            print(f"  FOUND: from {module_path} import {class_name}")
            print(f"         -> {cls}")
            return True, cls
    except ImportError as e:
        print(f"  FAIL:  from {module_path} import {class_name} -> {e}")
    except Exception as e:
        print(f"  ERROR: from {module_path} import {class_name} -> {type(e).__name__}: {e}")
    return False, None


def main():
    print("=" * 60)
    print("Probing paper-qa import paths")
    print("=" * 60)

    results = {}

    # 1. VectorStore
    print("\n1. VectorStore")
    paths = ["paperqa.llms", "paperqa", "lmi"]
    found = False
    for path in paths:
        success, cls = probe_import(path, "VectorStore")
        if success:
            results["VectorStore"] = f"from {path} import VectorStore"
            found = True
            break
    if not found:
        results["VectorStore"] = "NOT FOUND"
        print("  ERROR: VectorStore not found in any expected location")

    # 2. EmbeddingModel
    print("\n2. EmbeddingModel")
    paths = ["lmi", "paperqa.llms", "paperqa"]
    found = False
    for path in paths:
        success, cls = probe_import(path, "EmbeddingModel")
        if success:
            results["EmbeddingModel"] = f"from {path} import EmbeddingModel"
            found = True
            break
    if not found:
        results["EmbeddingModel"] = "NOT FOUND"
        print("  ERROR: EmbeddingModel not found in any expected location")

    # 3. EmbeddingModes
    print("\n3. EmbeddingModes")
    paths = ["lmi", "paperqa.types", "paperqa.llms", "paperqa"]
    found = False
    for path in paths:
        success, cls = probe_import(path, "EmbeddingModes")
        if success:
            results["EmbeddingModes"] = f"from {path} import EmbeddingModes"
            found = True
            break
    if not found:
        results["EmbeddingModes"] = "NOT FOUND"
        print("  ERROR: EmbeddingModes not found in any expected location")

    # 4. Text
    print("\n4. Text")
    paths = ["paperqa.types", "paperqa"]
    text_cls = None
    found = False
    for path in paths:
        success, cls = probe_import(path, "Text")
        if success:
            results["Text"] = f"from {path} import Text"
            text_cls = cls
            found = True
            break
    if not found:
        results["Text"] = "NOT FOUND"
        print("  ERROR: Text not found in any expected location")

    # 5. Doc
    print("\n5. Doc")
    paths = ["paperqa.types", "paperqa"]
    found = False
    for path in paths:
        success, cls = probe_import(path, "Doc")
        if success:
            results["Doc"] = f"from {path} import Doc"
            found = True
            break
    if not found:
        results["Doc"] = "NOT FOUND"
        print("  ERROR: Doc not found in any expected location")

    # 6. Embeddable
    print("\n6. Embeddable")
    paths = ["lmi", "paperqa.types", "paperqa"]
    found = False
    for path in paths:
        success, cls = probe_import(path, "Embeddable")
        if success:
            results["Embeddable"] = f"from {path} import Embeddable"
            found = True
            break
    if not found:
        results["Embeddable"] = "NOT FOUND"
        print("  ERROR: Embeddable not found in any expected location")

    # 7. Text attributes (if Text was found)
    print("\n7. Text class attributes")
    if text_cls is not None:
        try:
            print(f"  Text fields: {list(text_cls.model_fields.keys())}")
            print(f"  Has 'embedding' field: {'embedding' in text_cls.model_fields}")
            print(f"  Has 'chunk_index' field: {'chunk_index' in text_cls.model_fields}")

            # Check for extra config
            extra_config = getattr(text_cls, 'model_config', {})
            if hasattr(extra_config, 'get'):
                print(f"  extra config: {extra_config.get('extra', 'not set')}")
            else:
                print(f"  model_config: {extra_config}")

            # Check embedding field details if present
            if 'embedding' in text_cls.model_fields:
                field_info = text_cls.model_fields['embedding']
                print(f"  embedding field info: {field_info}")
                print(f"  embedding annotation: {field_info.annotation}")
        except Exception as e:
            print(f"  ERROR inspecting Text: {type(e).__name__}: {e}")
    else:
        print("  SKIPPED: Text class not found")

    # 8. Additional probing for other potentially useful classes
    print("\n8. Additional classes (bonus probing)")

    # Try NumpyVectorStore as it might be the base implementation
    print("\n  8a. NumpyVectorStore")
    paths = ["paperqa.llms", "paperqa"]
    for path in paths:
        success, cls = probe_import(path, "NumpyVectorStore")
        if success:
            results["NumpyVectorStore"] = f"from {path} import NumpyVectorStore"
            break

    # Try to find Embedding or SparseEmbedding
    print("\n  8b. SparseEmbedding")
    paths = ["paperqa.types", "paperqa"]
    for path in paths:
        success, cls = probe_import(path, "SparseEmbedding")
        if success:
            results["SparseEmbedding"] = f"from {path} import SparseEmbedding"
            break

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY: Import paths to use")
    print("=" * 60)

    all_found = True
    for class_name, import_path in results.items():
        status = "OK" if "NOT FOUND" not in import_path else "MISSING"
        if status == "MISSING":
            all_found = False
        print(f"  [{status}] {class_name}: {import_path}")

    print("\n" + "=" * 60)
    if all_found:
        print("Probe complete. All required classes found.")
    else:
        print("PROBE FAILED: Some required classes were not found!")
        print("Check paper-qa version and documentation.")
    print("=" * 60)

    return all_found


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
