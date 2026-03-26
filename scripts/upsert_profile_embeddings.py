from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any

from sentence_transformers import SentenceTransformer
from supabase import Client, create_client


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_PATH = PROJECT_ROOT / "tmp" / "profile_documents.json"
DEFAULT_MODEL_NAME = "intfloat/multilingual-e5-small"
DEFAULT_BATCH_SIZE = 64
DEFAULT_UPSERT_CHUNK_SIZE = 100
UUID_NAMESPACE = uuid.UUID("5c7b0e7d-99c4-4c9d-9b0e-1a6bc4d7c5f0")


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


def load_documents(input_path: Path) -> list[dict[str, Any]]:
    with input_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise RuntimeError("profile_documents.json must be a JSON array")

    return data


def to_pgvector(embedding: list[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in embedding) + "]"


def chunked(items: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [items[index:index + size] for index in range(0, len(items), size)]


def deterministic_id(doc_type: str, source_id: str) -> str:
    return str(uuid.uuid5(UUID_NAMESPACE, f"{doc_type}:{source_id}"))


def table_has_column(client: Client, column_name: str) -> bool:
    try:
        client.table("profile_documents").select(column_name).limit(1).execute()
        return True
    except Exception:
        return False


def main() -> None:
    input_path = Path(os.getenv("PROFILE_DOCUMENTS_PATH", str(DEFAULT_INPUT_PATH)))
    model_name = os.getenv("EMBEDDING_MODEL_NAME", DEFAULT_MODEL_NAME)

    if not input_path.exists():
        raise RuntimeError(f"Input file not found: {input_path}")

    documents = load_documents(input_path)
    if not documents:
        print("No profile documents found. Nothing to upsert.")
        return

    model = SentenceTransformer(model_name)
    passage_texts = [f"passage: {document['content']}" for document in documents]
    embeddings = model.encode(
        passage_texts,
        batch_size=DEFAULT_BATCH_SIZE,
        normalize_embeddings=True,
    )

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
    for document, embedding in zip(documents, embeddings):
        row: dict[str, Any] = {
            "id": deterministic_id(document["type"], document["source_id"]),
            "type": document["type"],
            "embedding": to_pgvector(embedding.tolist()),
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

    print(f"Upserted {len(rows)} profile documents into profile_documents")


if __name__ == "__main__":
    main()
