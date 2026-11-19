#!/usr/bin/env python3
"""Download and verify the pinned internacia-db release (SPEC §4.1–4.3).

Writes to .cache/internacia/<tag>/:

- assets/    release assets listed in ASSETS, each checked against SHA256SUMS
- source/    sparse checkout of the tag: data/schemas and data/vocabs (labels, descriptions)
- fetch.json record of what was fetched and verified

Uses only the Python standard library and git. Files already in the cache are kept when their
checksum still matches, so repeated runs download nothing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from lock import DEFAULT_CACHE, DEFAULT_LOCK, Lock, LockError, load_lock

# Release assets the site reads (SPEC §4.1). SHA256SUMS is fetched first and checked on its own.
ASSETS = [
    "internacia.duckdb",
    "countries.jsonl.zst",
    "intblocks.jsonl.zst",
    "contract.json",
    "datapackage.json",
    "countries.manifest.json",
    "intblocks.manifest.json",
    "blocktypes.manifest.json",
    "memberships.manifest.json",
    "intblocks_aliases.json",
    "countries_aliases.json",
]

# Folders of the internacia-db repository read at the pinned tag.
SOURCE_PATHS = ["data/schemas", "data/vocabs"]

USER_AGENT = "internacia-web-fetch"
RETRIES = 3
TIMEOUT_S = 60


class FetchError(RuntimeError):
    """A download or a verification step failed."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_sha256sums(text: str) -> dict[str, str]:
    """Parse `sha256sum` output: '<hex>  <name>' (or '<hex> *<name>' in binary mode)."""
    sums: dict[str, str] = {}
    for lineno, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        parts = line.split(maxsplit=1)
        if len(parts) != 2 or len(parts[0]) != 64:
            raise FetchError(f"SHA256SUMS line {lineno} is malformed: {line!r}")
        digest, name = parts[0].lower(), parts[1].strip().lstrip("*")
        if name in sums:
            raise FetchError(f"SHA256SUMS lists {name!r} twice")
        sums[name] = digest
    return sums


def contract_major(contract: dict) -> int:
    version = contract.get("contract_version")
    if not isinstance(version, str) or not version.split(".")[0].isdigit():
        raise FetchError(f"contract.json has no valid contract_version: {version!r}")
    return int(version.split(".")[0])


def download(url: str, dest: Path) -> None:
    """Download url to dest through a temporary file, retrying transient failures."""
    tmp = dest.with_name(dest.name + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(1, RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_S) as resp, tmp.open("wb") as out:
                while chunk := resp.read(1 << 20):
                    out.write(chunk)
            tmp.replace(dest)
            return
        except urllib.error.HTTPError as exc:
            tmp.unlink(missing_ok=True)
            if exc.code < 500 or attempt == RETRIES:
                raise FetchError(f"GET {url}: HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            tmp.unlink(missing_ok=True)
            if attempt == RETRIES:
                raise FetchError(f"GET {url}: {exc}") from exc
        time.sleep(2 * attempt)


def fetch_assets(lock: Lock, assets_dir: Path, log=print) -> dict[str, str]:
    """Fetch SHA256SUMS and ASSETS into assets_dir; return {name: sha256} of verified files."""
    assets_dir.mkdir(parents=True, exist_ok=True)

    sums_path = assets_dir / "SHA256SUMS"
    if not sums_path.exists() or sha256_file(sums_path) != lock.sha256sums_sha256:
        download(lock.asset_url("SHA256SUMS"), sums_path)
    actual = sha256_file(sums_path)
    if actual != lock.sha256sums_sha256:
        raise FetchError(
            f"SHA256SUMS of {lock.tag} has sha256 {actual}, lock file expects {lock.sha256sums_sha256}"
        )
    sums = parse_sha256sums(sums_path.read_text(encoding="utf-8"))

    verified = {"SHA256SUMS": actual}
    for name in ASSETS:
        if name not in sums:
            raise FetchError(f"{name} is not listed in SHA256SUMS of {lock.tag}")
        path = assets_dir / name
        if path.exists() and sha256_file(path) == sums[name]:
            log(f"  cached   {name}")
        else:
            download(lock.asset_url(name), path)
            log(f"  fetched  {name}")
        digest = sha256_file(path)
        if digest != sums[name]:
            path.unlink()
            raise FetchError(f"{name}: sha256 {digest} does not match SHA256SUMS ({sums[name]})")
        verified[name] = digest

    contract = json.loads((assets_dir / "contract.json").read_text(encoding="utf-8"))
    major = contract_major(contract)
    if major != lock.contract_major:
        raise FetchError(
            f"contract_version {contract['contract_version']} of {lock.tag} has MAJOR {major}; "
            f"the site supports MAJOR {lock.contract_major}. Update the pipeline before bumping the lock."
        )
    return verified


def _git(*args: str, cwd: Path | None = None) -> str:
    result = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        raise FetchError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def fetch_source(lock: Lock, source_dir: Path, log=print) -> str:
    """Sparse-checkout SOURCE_PATHS at the pinned tag; return the checked-out commit."""
    if (source_dir / ".git").exists():
        head = _git("rev-parse", "HEAD", cwd=source_dir)
        if head == lock.git_commit and all((source_dir / p).is_dir() for p in SOURCE_PATHS):
            log(f"  cached   source at {head[:12]}")
            return head
        shutil.rmtree(source_dir)

    source_dir.parent.mkdir(parents=True, exist_ok=True)
    _git(
        "clone", "--quiet", "--depth", "1", "--branch", lock.tag,
        "--filter=blob:none", "--sparse", lock.git_url, str(source_dir),
    )
    _git("sparse-checkout", "set", *SOURCE_PATHS, cwd=source_dir)
    head = _git("rev-parse", "HEAD", cwd=source_dir)
    if head != lock.git_commit:
        raise FetchError(f"tag {lock.tag} points to {head}, lock file expects {lock.git_commit}")
    for path in SOURCE_PATHS:
        if not (source_dir / path).is_dir():
            raise FetchError(f"{path} is missing at {lock.tag}")
    log(f"  fetched  source at {head[:12]}")
    return head


def run(lock_path: Path, cache_root: Path, log=print) -> Path:
    lock = load_lock(lock_path)
    target = cache_root / lock.tag
    log(f"internacia-db {lock.tag} → {target}")
    verified = fetch_assets(lock, target / "assets", log=log)
    commit = fetch_source(lock, target / "source", log=log)
    record = {
        "repository": lock.repository,
        "tag": lock.tag,
        "git_commit": commit,
        "assets": verified,
        "source_paths": SOURCE_PATHS,
    }
    (target / "fetch.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    log(f"verified {len(verified)} assets and {len(SOURCE_PATHS)} source folders")
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK, help="lock file (default: %(default)s)")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE, help="cache root (default: %(default)s)")
    args = parser.parse_args(argv)
    try:
        run(args.lock, args.cache)
    except (LockError, FetchError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
