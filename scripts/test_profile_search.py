from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from sentence_transformers import SentenceTransformer
from supabase import create_client

MODEL_NAME = "intfloat/multilingual-e5-small"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
USER_DATA_PATH = PROJECT_ROOT / "src" / "data" / "user_dummy_data.json"
TEAM_DATA_PATH = PROJECT_ROOT / "src" / "data" / "team_dummy_data.json"


def load_env_file(path: str = ".env") -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key, value)


def create_supabase():
    load_env_file()
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("Supabase env vars are missing")
    return create_client(url, key)


def load_json(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise RuntimeError(f"Expected JSON array in {path}")
    return data


def load_source_maps() -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    users = load_json(USER_DATA_PATH)
    teams = load_json(TEAM_DATA_PATH)
    user_map = {
        item["userId"]: item
        for item in users
        if isinstance(item, dict) and isinstance(item.get("userId"), str)
    }
    team_map = {
        item["teamCode"]: item
        for item in teams
        if isinstance(item, dict) and isinstance(item.get("teamCode"), str)
    }
    return user_map, team_map


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Test profile vector search")
    parser.add_argument("query", help="natural language query or source id")
    parser.add_argument("--mode", choices=["text", "similar"], default="text")
    parser.add_argument("--source-type", choices=["user", "team"], help="required when mode=similar")
    parser.add_argument("--target-type", choices=["user", "team"], help="optional result filter")
    parser.add_argument("--hackathon-slug")
    parser.add_argument("--is-open", choices=["true", "false"])
    parser.add_argument("--exclude-source-id")
    parser.add_argument("--limit", type=int, default=5)
    return parser


def get_query_embedding(model: SentenceTransformer, text: str) -> list[float]:
    vector = model.encode([f"query: {text}"], normalize_embeddings=True)[0]
    return vector.tolist()


def find_source_document(client: Any, source_id: str, source_type: str) -> dict[str, Any]:
    response = (
        client.table("profile_documents")
        .select("source_id,type,content")
        .eq("source_id", source_id)
        .eq("type", source_type)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise RuntimeError(f"No profile document found for {source_type}:{source_id}")
    return response.data[0]


def print_source_payload(row: dict[str, Any], user_map: dict[str, dict[str, Any]], team_map: dict[str, dict[str, Any]]) -> None:
    source_id = row.get("source_id")
    source_type = row.get("type")
    if source_type == "team":
        team = team_map.get(source_id)
        if not team:
            print("    raw_team=missing")
            return
        print(f"    raw_team.name={team.get('name')}")
        print(f"    raw_team.intro={team.get('intro')}")
        print(f"    raw_team.lookingFor={team.get('lookingFor')}")
        print(f"    raw_team.requiredSkills={team.get('requiredSkills')}")
        print(f"    raw_team.preferredPersonality={team.get('preferredPersonality')}")
        print(f"    raw_team.tags={team.get('tags')}")
        print(f"    raw_team.isOpen={team.get('isOpen')} memberCount={team.get('memberCount')} maxMembers={team.get('maxMembers')}")
        return

    if source_type == "user":
        user = user_map.get(source_id)
        if not user:
            print("    raw_user=missing")
            return
        print(f"    raw_user.nickname={user.get('nickname')}")
        print(f"    raw_user.skills={user.get('skills')}")
        print(f"    raw_user.preferredRoles={user.get('preferredRoles')}")
        print(f"    raw_user.personalityTags={user.get('personalityTags')}")
        print(f"    raw_user.participations={user.get('participations')}")


def run_search(args: argparse.Namespace) -> None:
    client = create_supabase()
    model = SentenceTransformer(MODEL_NAME)
    user_map, team_map = load_source_maps()

    query_text = args.query
    if args.mode == "similar":
        if not args.source_type:
            raise RuntimeError("--source-type is required when mode=similar")
        source_doc = find_source_document(client, args.query, args.source_type)
        query_text = source_doc["content"]
        if args.target_type is None:
            args.target_type = "team" if args.source_type == "user" else "user"
        if args.exclude_source_id is None:
            args.exclude_source_id = args.query

    query_embedding = get_query_embedding(model, query_text)
    filter_is_open = None
    if args.is_open is not None:
        filter_is_open = args.is_open == "true"

    response = client.rpc(
        "match_profile_documents",
        {
            "query_embedding": query_embedding,
            "match_count": args.limit,
            "filter_type": args.target_type,
            "filter_hackathon_slug": args.hackathon_slug,
            "filter_is_open": filter_is_open,
            "exclude_source_id": args.exclude_source_id,
        },
    ).execute()

    print(f"query_text: {query_text}")
    print(f"results: {len(response.data)}")
    for index, row in enumerate(response.data, start=1):
        profile = row.get("profile") or {}
        print(f"[{index}] source_id={row.get('source_id')} type={row.get('type')} similarity={row.get('similarity'):.4f}")
        print(f"    hackathon_slug={row.get('hackathon_slug')} is_open={row.get('is_open')} current_team_id={row.get('current_team_id')}")
        print(f"    role={profile.get('role')}")
        print(f"    skills={profile.get('skills')}")
        print(f"    personality={profile.get('personality')}")
        print(f"    content={row.get('content')}")
        print_source_payload(row, user_map, team_map)


if __name__ == "__main__":
    run_search(build_parser().parse_args())
