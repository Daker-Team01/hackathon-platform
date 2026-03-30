from __future__ import annotations

import json
import os
import urllib.request
import uuid
from pathlib import Path
from typing import Any

from supabase import Client, create_client


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_PATH = PROJECT_ROOT / "tmp" / "profile_documents.json"
DEFAULT_MODEL_NAME = "text-embedding-3-small"
DEFAULT_EMBEDDING_DIMENSIONS = 384
DEFAULT_BATCH_SIZE = 64
DEFAULT_UPSERT_CHUNK_SIZE = 100
UUID_NAMESPACE = uuid.UUID("5c7b0e7d-99c4-4c9d-9b0e-1a6bc4d7c5f0")
DEFAULT_PRUNE_MISSING = True


def get_env(name: str, fallback: str | None = None) -> str | None:
    value = os.getenv(name)
    if value:
        return value
    return os.getenv(fallback) if fallback else None


def create_supabase_client() -> Client:
    supabase_url = get_env("SUPABASE_URL", "VITE_SUPABASE_URL")
    supabase_key = get_env("SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_* fallbacks) are required")

    return create_client(supabase_url, supabase_key)


def get_openai_api_key() -> str:
    api_key = get_env("OPENAI_API_KEY", "VITE_OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY (or VITE_OPENAI_API_KEY fallback) is required")
    return api_key


def load_documents(input_path: Path) -> list[dict[str, Any]]:
    with input_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise RuntimeError("profile_documents.json must be a JSON array")

    return data


def to_pgvector(embedding: list[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in embedding) + "]"


def embed_texts(texts: list[str], model_name: str, dimensions: int, api_key: str) -> list[list[float]]:
    request = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=json.dumps({
            "input": texts,
            "model": model_name,
            "dimensions": dimensions,
        }).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(request) as response:
        payload = json.loads(response.read().decode("utf-8"))

    data = payload.get("data")
    if not isinstance(data, list):
        raise RuntimeError("Invalid embeddings response from OpenAI API")

    ordered_items = sorted(
        [item for item in data if isinstance(item, dict)],
        key=lambda item: int(item.get("index", 0)),
    )
    return [item["embedding"] for item in ordered_items]


def chunked(items: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [items[index:index + size] for index in range(0, len(items), size)]


def deterministic_id(doc_type: str, source_id: str) -> str:
    return str(uuid.uuid5(UUID_NAMESPACE, f"{doc_type}:{source_id}"))


def should_prune_missing() -> bool:
    raw = os.getenv("PROFILE_DOCUMENTS_PRUNE_MISSING")
    if raw is None:
        return DEFAULT_PRUNE_MISSING
    return raw.strip().lower() not in {"0", "false", "no"}


def table_has_column(client: Client, column_name: str) -> bool:
    try:
        client.table("profile_documents").select(column_name).limit(1).execute()
        return True
    except Exception:
        return False


def main() -> None:
    input_path = Path(os.getenv("PROFILE_DOCUMENTS_PATH", str(DEFAULT_INPUT_PATH)))
    model_name = os.getenv("EMBEDDING_MODEL_NAME", DEFAULT_MODEL_NAME)
    dimensions = int(os.getenv("EMBEDDING_DIMENSIONS", str(DEFAULT_EMBEDDING_DIMENSIONS)))

    if not input_path.exists():
        raise RuntimeError(f"Input file not found: {input_path}")

    documents = load_documents(input_path)
    if not documents:
        print("No profile documents found. Nothing to upsert.")
        return

    passage_texts = [f"passage: {document['content']}" for document in documents]
    api_key = get_openai_api_key()
    embeddings: list[list[float]] = []
    for index in range(0, len(passage_texts), DEFAULT_BATCH_SIZE):
        batch = passage_texts[index:index + DEFAULT_BATCH_SIZE]
        embeddings.extend(embed_texts(batch, model_name, dimensions, api_key))

    client = create_supabase_client()
    has_source_id = table_has_column(client, "source_id")
    has_content = table_has_column(client, "content")
    has_profile = table_has_column(client, "profile")
    has_hackathon_slug = table_has_column(client, "hackathon_slug")
    has_is_hackathon_linked = table_has_column(client, "is_hackathon_linked")
    has_is_open = table_has_column(client, "is_open")
    has_current_team_id = table_has_column(client, "current_team_id")
    has_metadata = table_has_column(client, "metadata")

    rows: list[dict[str, Any]] = []
    expected_ids: set[str] = set()
    for document, embedding in zip(documents, embeddings):
        document_id = deterministic_id(document["type"], document["source_id"])
        expected_ids.add(document_id)
        row: dict[str, Any] = {
            "id": document_id,
            "type": document["type"],
            "embedding": to_pgvector(embedding),
        }

        metadata = {
            "source_id": document["source_id"],
            "hackathon_slug": document["hackathon_slug"],
            "is_hackathon_linked": document["is_hackathon_linked"],
            "is_open": document["is_open"],
            "current_team_id": document["current_team_id"],
            "profile": document["profile"],
            "content": document["content"],
        }

        if has_source_id:
            row["source_id"] = document["source_id"]
        if has_content:
            row["content"] = document["content"]
        if has_profile:
            row["profile"] = document["profile"]
        if has_hackathon_slug:
            row["hackathon_slug"] = document["hackathon_slug"]
        if has_is_hackathon_linked:
            row["is_hackathon_linked"] = document["is_hackathon_linked"]
        if has_is_open:
            row["is_open"] = document["is_open"]
        if has_current_team_id:
            row["current_team_id"] = document["current_team_id"]
        if has_metadata:
            row["metadata"] = metadata

        rows.append(row)

    for batch in chunked(rows, DEFAULT_UPSERT_CHUNK_SIZE):
        client.table("profile_documents").upsert(
            batch,
            on_conflict="id",
        ).execute()

    if should_prune_missing():
        existing_rows = client.table("profile_documents").select("id").execute()
        stale_ids = [
            row["id"]
            for row in (existing_rows.data or [])
            if isinstance(row, dict) and isinstance(row.get("id"), str) and row["id"] not in expected_ids
        ]

        for stale_batch in chunked([{"id": stale_id} for stale_id in stale_ids], DEFAULT_UPSERT_CHUNK_SIZE):
            id_batch = [item["id"] for item in stale_batch]
            client.table("profile_documents").delete().in_("id", id_batch).execute()

    print(f"Upserted {len(rows)} profile documents into profile_documents")


if __name__ == "__main__":
    main()
