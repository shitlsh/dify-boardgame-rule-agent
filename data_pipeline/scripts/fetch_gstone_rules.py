#!/usr/bin/env python3
"""
Download rule images from gstonegames.com document pages.

Usage:
  python data_pipeline/scripts/fetch_gstone_rules.py \
    --url "https://www.gstonegames.com/game/doc-519.html" \
    --game "glory_to_rome" \
    --category "general"
"""

from __future__ import annotations

import argparse
import mimetypes
from pathlib import Path
from typing import List
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


SCRIPT_DIR = Path(__file__).resolve().parent
RAW_ROOT = SCRIPT_DIR.parent / "raw"

REQUEST_TIMEOUT = 20
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}
IMAGE_HEADERS = {
    "User-Agent": DEFAULT_HEADERS["User-Agent"],
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch gstone rule images.")
    parser.add_argument("--url", required=True, help="Gstone rule document URL")
    parser.add_argument("--game", required=True, help="Game folder name, e.g. catan")
    parser.add_argument(
        "--category",
        default="general",
        help="Category folder under raw/, defaults to general",
    )
    return parser.parse_args()


def ensure_output_dir(category: str, game: str) -> Path:
    target_dir = RAW_ROOT / category / game
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir


def normalize_image_url(page_url: str, src: str) -> str:
    src = src.strip()
    if src.startswith("//"):
        return f"https:{src}"
    return urljoin(page_url, src)


def extract_rule_image_urls(html: str, page_url: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    container = soup.select_one("#preview_imgs")
    if container is None:
        # Fallback for potential template variations.
        container = soup.select_one(".article-all .describe")
    if container is None:
        raise RuntimeError("未找到规则图片容器：#preview_imgs 或 .article-all .describe")

    image_urls: List[str] = []
    seen = set()
    for img in container.select("img"):
        raw_url = img.get("data-original") or img.get("src")
        if not raw_url:
            continue
        full_url = normalize_image_url(page_url, raw_url)
        if full_url in seen:
            continue
        seen.add(full_url)
        image_urls.append(full_url)

    if not image_urls:
        raise RuntimeError("规则图片容器存在，但未提取到任何图片 URL")
    return image_urls


def extension_from_response(image_url: str, response: requests.Response) -> str:
    content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip()
    if content_type:
        ext = mimetypes.guess_extension(content_type) or ""
        if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"}:
            return ".jpg" if ext == ".jpe" else ext

    path_ext = Path(urlparse(image_url).path).suffix.lower()
    if path_ext in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"}:
        return path_ext
    return ".jpg"


def download_images(image_urls: List[str], page_url: str, out_dir: Path) -> None:
    width = max(2, len(str(len(image_urls))))
    with requests.Session() as session:
        for idx, image_url in enumerate(image_urls, start=1):
            print(f"[{idx}/{len(image_urls)}] 正在下载: {image_url}")
            try:
                headers = dict(IMAGE_HEADERS)
                headers["Referer"] = page_url
                resp = session.get(image_url, headers=headers, timeout=REQUEST_TIMEOUT, stream=True)
                resp.raise_for_status()

                ext = extension_from_response(image_url, resp)
                filename = f"{idx:0{width}d}_page{ext}"
                output_path = out_dir / filename

                with output_path.open("wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                print(f"  -> 成功: {output_path}")
            except Exception as exc:  # noqa: BLE001
                print(f"  -> 失败: {image_url} | 错误: {exc}")


def main() -> None:
    args = parse_args()
    out_dir = ensure_output_dir(args.category, args.game)
    print(f"输出目录: {out_dir}")

    with requests.Session() as session:
        resp = session.get(args.url, headers=DEFAULT_HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        html = resp.text

    image_urls = extract_rule_image_urls(html, args.url)
    print(f"识别到规则图片数量: {len(image_urls)}")
    download_images(image_urls, args.url, out_dir)
    print("全部任务完成。")


if __name__ == "__main__":
    main()
