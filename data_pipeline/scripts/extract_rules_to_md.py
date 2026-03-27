#!/usr/bin/env python3
"""
Offline pipeline: scan data_pipeline/raw/<category>/ for PDFs and images,
call Gemini (google-genai) to transcribe into Markdown, write to output/ mirroring paths.
"""

from __future__ import annotations

import argparse
import httpx
import logging
import os
import re
import socket
import sys
import time
from pathlib import Path
from typing import Iterable, Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types

# -----------------------------------------------------------------------------
# Paths (script lives in data_pipeline/scripts/)
# -----------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_PIPELINE_DIR = SCRIPT_DIR.parent

RAW_ROOT = DATA_PIPELINE_DIR / "raw"
OUTPUT_ROOT = DATA_PIPELINE_DIR / "output"
PROMPT_ROOT = DATA_PIPELINE_DIR / "prompt_templates"

DEFAULT_MODEL = "gemini-3.1-pro-preview"
DEFAULT_CATEGORY = "general"
DEFAULT_HTTP_TIMEOUT_S = 60.0
DEFAULT_FORCE_IPV4 = True
DEFAULT_SKIP_MODEL_DISCOVERY = True

# Flyway-style version suffix: any descriptive prefix, then _V<n>.md (case-insensitive V).
# Examples: base_V1.md, extract_rules_V2.md
VERSIONED_PROMPT_PATTERN = re.compile(r"^.+_V(\d+)\.md$", re.IGNORECASE)

# User turn: instructs the model to emit Markdown (system role comes from template file).
USER_INSTRUCTION = (
    "Convert the attached board game rulebook into clean, standard Markdown. "
    "Preserve headings, lists, tables where appropriate, and rule numbering. "
    "Output only the Markdown body, without preamble or code fences around the whole document."
)

SUPPORTED_SUFFIXES = {".png", ".jpg", ".jpeg", ".pdf"}

MIME_BY_SUFFIX = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".pdf": "application/pdf",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("extract_rules_to_md")


def load_env() -> None:
    # .env lives in data_pipeline/ (same level as this scripts/ directory)
    load_dotenv(DATA_PIPELINE_DIR / ".env")


def find_latest_versioned_prompt_filename(category_dir: Path) -> Optional[str]:
    """Pick `*_V{n}.md` with the largest n in the category directory."""
    if not category_dir.is_dir():
        return None
    best: Optional[tuple[int, str]] = None
    for path in category_dir.iterdir():
        if not path.is_file() or path.name.startswith("."):
            continue
        m = VERSIONED_PROMPT_PATTERN.match(path.name)
        if not m:
            continue
        ver = int(m.group(1))
        name = path.name
        if best is None or ver > best[0] or (ver == best[0] and name > best[1]):
            best = (ver, name)
    return best[1] if best else None


def resolve_prompt_path(category: str, explicit: Optional[str]) -> Path:
    """
    Explicit: must exist under prompt_templates/<category>/.
    Omitted: use the file with the highest version number matching *_V<n>.md.
    """
    cat_dir = PROMPT_ROOT / category
    if explicit:
        p = cat_dir / explicit
        if not p.is_file():
            raise FileNotFoundError(f"Prompt file not found: {p}")
        logger.info("Using prompt: %s", p)
        return p
    latest = find_latest_versioned_prompt_filename(cat_dir)
    if latest is None:
        raise ValueError(
            f"No versioned prompt (*_V<n>.md) found under {cat_dir}"
        )
    logger.info(
        "Auto-selected prompt (highest V number): %s under %s",
        latest,
        cat_dir,
    )
    return cat_dir / latest


def _supports_generate_content(model: types.Model) -> bool:
    actions = model.supported_actions or []
    if not actions:
        return True
    lowered = [str(a).lower() for a in actions]
    return any("generatecontent" in a for a in lowered)


def list_generate_models(client: genai.Client) -> list[types.Model]:
    models: list[types.Model] = []
    for model in client.models.list():
        if _supports_generate_content(model):
            models.append(model)
    models.sort(key=lambda m: (m.name or ""))
    return models


def build_client(api_key: str, timeout_s: float) -> genai.Client:
    # In some environments the SDK default transport quickly hits connect timeout.
    # Use explicit httpx timeout settings and HTTP/1.1 for better stability.
    connect_timeout_s = min(timeout_s, 20.0)
    http_options = types.HttpOptions(
        client_args={
            "timeout": httpx.Timeout(timeout_s, connect=connect_timeout_s),
            "http2": False,
        }
    )
    return genai.Client(api_key=api_key, http_options=http_options)


def enable_ipv4_only_dns_resolution() -> None:
    """Force DNS resolution to IPv4 addresses only for current process."""
    original_getaddrinfo = socket.getaddrinfo

    def ipv4_getaddrinfo(
        host: str,
        port: int,
        family: int = 0,
        type: int = 0,
        proto: int = 0,
        flags: int = 0,
    ):
        return original_getaddrinfo(
            host, port, socket.AF_INET, type, proto, flags
        )

    socket.getaddrinfo = ipv4_getaddrinfo  # type: ignore[assignment]


def normalize_model_name(name: str) -> str:
    return name[7:] if name.startswith("models/") else name


def print_models(models: list[types.Model]) -> None:
    if not models:
        logger.warning("No generate-content models returned by API.")
        return
    logger.info("Available models that support generateContent:")
    for idx, model in enumerate(models, start=1):
        model_name = normalize_model_name(model.name or "")
        display_name = model.display_name or "-"
        in_limit = model.input_token_limit if model.input_token_limit is not None else "-"
        out_limit = (
            model.output_token_limit if model.output_token_limit is not None else "-"
        )
        logger.info(
            "[%d] %s | display=%s | input_token_limit=%s | output_token_limit=%s",
            idx,
            model_name,
            display_name,
            in_limit,
            out_limit,
        )


def choose_model_interactively(
    models: list[types.Model], default_model: str
) -> Optional[str]:
    if not models:
        return None
    print_models(models)
    default_norm = normalize_model_name(default_model)
    print(
        f"\nChoose model index (Enter to keep `{default_norm}`, q to quit): ",
        end="",
        flush=True,
    )
    raw = input().strip()
    if not raw:
        return default_norm
    if raw.lower() in {"q", "quit", "exit"}:
        return None
    if not raw.isdigit():
        logger.error("Invalid selection: %s", raw)
        return None
    idx = int(raw)
    if idx < 1 or idx > len(models):
        logger.error("Model index out of range: %s", raw)
        return None
    return normalize_model_name(models[idx - 1].name or "")


def validate_or_pick_model(
    client: genai.Client,
    requested_model: str,
    *,
    choose_model: bool = False,
    list_only: bool = False,
    show_list: bool = False,
    allow_discovery_failure_fallback: bool = False,
) -> Optional[str]:
    try:
        models = list_generate_models(client)
    except Exception as exc:  # noqa: BLE001
        if list_only or choose_model:
            logger.error("Failed to fetch model list from API: %s", exc)
            return None
        if allow_discovery_failure_fallback:
            requested_norm = normalize_model_name(requested_model)
            logger.warning(
                "Model discovery failed (%s). Fallback to requested model without pre-validation: %s",
                exc,
                requested_norm,
            )
            return requested_norm
        logger.error("Failed to fetch model list from API: %s", exc)
        return None

    if show_list or list_only or choose_model:
        print_models(models)

    if list_only:
        return "__LISTED__"

    available = {normalize_model_name(m.name or "") for m in models}
    requested_norm = normalize_model_name(requested_model)

    if choose_model:
        picked = choose_model_interactively(models, requested_norm)
        if not picked:
            return None
        return picked

    if requested_norm in available:
        return requested_norm

    logger.error(
        "Requested model `%s` is not available for generateContent in current API context.",
        requested_norm,
    )
    print_models(models)
    logger.error("Please choose another model via --model.")
    return None


def iter_game_dirs(raw_category_root: Path) -> Iterable[Path]:
    if not raw_category_root.is_dir():
        return
    for path in sorted(raw_category_root.iterdir(), key=lambda p: p.name.lower()):
        if path.is_dir() and not path.name.startswith("."):
            yield path


def collect_game_assets_sorted(game_dir: Path) -> list[Path]:
    assets = [
        p
        for p in game_dir.iterdir()
        if p.is_file() and not p.name.startswith(".") and p.suffix.lower() in SUPPORTED_SUFFIXES
    ]
    return sorted(assets, key=lambda p: p.name.lower())


def output_md_path_for_game(output_category_root: Path, game_name: str) -> Path:
    return output_category_root / f"{game_name}.md"


def wait_for_active_file(
    client: genai.Client,
    name: str,
    *,
    poll_interval_s: float = 2.0,
    timeout_s: float = 600.0,
) -> types.File:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        f = client.files.get(name=name)
        state = f.state
        if state == types.FileState.ACTIVE:
            return f
        if state == types.FileState.FAILED:
            err = f.error or "unknown error"
            raise RuntimeError(f"File processing failed: {name} ({err})")
        time.sleep(poll_interval_s)
    raise TimeoutError(f"Timed out waiting for file to become ACTIVE: {name}")


def delete_uploaded_file(client: genai.Client, name: Optional[str]) -> None:
    if not name:
        return
    try:
        client.files.delete(name=name)
    except Exception as exc:  # noqa: BLE001 — best-effort cleanup
        logger.warning("Could not delete uploaded file %s: %s", name, exc)


def build_game_contents(
    client: genai.Client, assets: list[Path], system_prompt: str
) -> tuple[list[object], list[str]]:
    """
    Build one request payload for a game folder:
    [SYSTEM_PROMPT + instruction, asset1, asset2, ...]
    """
    contents: list[object] = [f"{system_prompt}\n\n{USER_INSTRUCTION}".strip()]
    uploaded_file_names: list[str] = []

    for asset in assets:
        suffix = asset.suffix.lower()
        if suffix == ".pdf":
            uploaded = client.files.upload(
                file=asset,
                config=types.UploadFileConfig(mime_type="application/pdf"),
            )
            if not uploaded.name:
                raise RuntimeError(f"Upload returned no file name for {asset}")
            ready = wait_for_active_file(client, uploaded.name)
            if not ready.name:
                raise RuntimeError(f"Uploaded file has no name after processing: {asset}")
            uploaded_file_names.append(ready.name)
            contents.append(ready)
        elif suffix in (".png", ".jpg", ".jpeg"):
            mime = MIME_BY_SUFFIX[suffix]
            image_part = types.Part.from_bytes(data=asset.read_bytes(), mime_type=mime)
            contents.append(image_part)
        else:
            raise ValueError(f"Unsupported extension in game folder: {suffix}")
    return contents, uploaded_file_names


def process_game_folder(
    client: genai.Client,
    model: str,
    game_dir: Path,
    output_category_root: Path,
    system_prompt: str,
    *,
    overwrite: bool = False,
) -> bool:
    """
    Process a whole game directory in one generate_content call.
    Returns True if processed, False if skipped (empty folder).
    """
    t0 = time.perf_counter()
    assets = collect_game_assets_sorted(game_dir)
    if not assets:
        logger.info("Skipping empty/unsupported folder: %s", game_dir)
        return False

    logger.info(
        "Processing game: %s (%d asset files)",
        game_dir.name,
        len(assets),
    )
    out_path = output_md_path_for_game(output_category_root, game_dir.name)
    if out_path.exists() and not overwrite:
        logger.info("Skipping existing output: %s", out_path)
        return False
    out_path.parent.mkdir(parents=True, exist_ok=True)

    uploaded_names: list[str] = []
    try:
        contents, uploaded_names = build_game_contents(client, assets, system_prompt)
        response = client.models.generate_content(model=model, contents=contents)
        text = response.text
        if not text or not text.strip():
            raise RuntimeError("Model returned empty text for game folder")
        out_path.write_text(text.strip(), encoding="utf-8")
        elapsed = time.perf_counter() - t0
        logger.info("Success: %s -> %s (%.2fs)", game_dir, out_path, elapsed)
        return True
    except Exception as exc:  # noqa: BLE001
        elapsed = time.perf_counter() - t0
        logger.exception("Failed: %s after %.2fs — %s", game_dir, elapsed, exc)
        raise
    finally:
        for name in uploaded_names:
            delete_uploaded_file(client, name)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Convert board game rule PDFs/images under raw/<category>/ to Markdown via Gemini."
    )
    p.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Gemini model id (default: {DEFAULT_MODEL})",
    )
    p.add_argument(
        "--category",
        default=DEFAULT_CATEGORY,
        help=f"Subfolder under raw/ and output/ (default: {DEFAULT_CATEGORY})",
    )
    p.add_argument(
        "--prompt-template",
        default=None,
        metavar="FILE",
        help=(
            "Explicit filename under prompt_templates/<category>/ "
            "(if omitted: pick *_V<n>.md with the largest n, Flyway-style)"
        ),
    )
    p.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing output/<category>/<game_name>.md files.",
    )
    return p.parse_args()


def main() -> int:
    load_env()
    args = parse_args()

    if DEFAULT_FORCE_IPV4:
        enable_ipv4_only_dns_resolution()
        logger.info("IPv4-only DNS resolution is enabled for this run.")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY is not set in the environment or .env")
        return 1

    client = build_client(api_key=api_key, timeout_s=DEFAULT_HTTP_TIMEOUT_S)

    raw_category = RAW_ROOT / args.category
    output_category = OUTPUT_ROOT / args.category

    if not raw_category.is_dir():
        logger.error("Raw category directory does not exist: %s", raw_category)
        return 1

    game_dirs = list(iter_game_dirs(raw_category))
    if not game_dirs:
        logger.warning("No game folders under %s", raw_category)
        return 0

    try:
        prompt_path = resolve_prompt_path(args.category, args.prompt_template)
    except FileNotFoundError as exc:
        logger.error("%s", exc)
        return 1
    except ValueError as exc:
        logger.error("%s", exc)
        return 1

    if DEFAULT_SKIP_MODEL_DISCOVERY:
        picked_model = normalize_model_name(args.model)
        logger.info("Using requested model without discovery: %s", picked_model)
    else:
        picked_model = validate_or_pick_model(
            client,
            args.model,
            choose_model=False,
            list_only=False,
            allow_discovery_failure_fallback=True,
        )
    if not picked_model:
        return 1
    logger.info("Using model: %s", picked_model)

    SYSTEM_PROMPT = prompt_path.read_text(encoding="utf-8")

    failed = 0
    processed = 0
    skipped = 0
    for game_dir in game_dirs:
        try:
            did_process = process_game_folder(
                client,
                picked_model,
                game_dir,
                output_category,
                SYSTEM_PROMPT,
                overwrite=args.overwrite,
            )
            if did_process:
                processed += 1
            else:
                skipped += 1
        except Exception:  # noqa: BLE001 — log per file; continue
            failed += 1

    if failed:
        logger.error(
            "Finished with %d failure(s), %d processed, %d skipped out of %d game folders",
            failed,
            processed,
            skipped,
            len(game_dirs),
        )
        return 1

    logger.info(
        "Done: %d processed, %d skipped, %d failed (total folders: %d).",
        processed,
        skipped,
        failed,
        len(game_dirs),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
