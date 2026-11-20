#!/usr/bin/env python3
"""Move internacia.lock.json to a newer internacia-db release (SPEC §11.3).

    python pipeline/bump.py check              print the latest release and whether it is newer
    python pipeline/bump.py update [--tag T]   rewrite the lock file for T (default: latest)
    python pipeline/bump.py summary OLD NEW    Markdown summary from two meta.json files

`update` writes the contract MAJOR this pipeline reads (lock.CONTRACT_MAJOR) and first checks the
release's contract.json: a release with another contract MAJOR leaves the lock as it is and fails
on purpose, because the pipeline must be updated before the site can move to it. The data-bump
workflow runs these steps, builds and checks the site, and opens a pull request.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

from fetch import FetchError, contract_major, parse_sha256sums
from lock import CONTRACT_MAJOR, DEFAULT_LOCK, Lock, LockError, load_lock

USER_AGENT = "internacia-web-bump"


def _get(url: str, accept: str = "application/octet-stream") -> bytes:
    headers = {"User-Agent": USER_AGENT, "Accept": accept}
    token = os.environ.get("GITHUB_TOKEN")
    if token and url.startswith("https://api.github.com/"):
        headers["Authorization"] = f"Bearer {token}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as resp:
        return resp.read()


def latest_tag(repository: str) -> str:
    data = json.loads(_get(f"https://api.github.com/repos/{repository}/releases/latest", "application/vnd.github+json"))
    return data["tag_name"]


def version_key(tag: str) -> tuple[int, ...]:
    return tuple(int(p) for p in tag.lstrip("v").split("."))


def parse_ls_remote(output: str, tag: str) -> str:
    """Commit a tag points to, from `git ls-remote --tags`: the peeled `^{}` line wins for
    annotated tags."""
    plain = peeled = None
    for line in output.splitlines():
        if not line.strip():
            continue
        sha, ref = line.split()
        if ref == f"refs/tags/{tag}^{{}}":
            peeled = sha
        elif ref == f"refs/tags/{tag}":
            plain = sha
    commit = peeled or plain
    if not commit:
        raise LockError(f"tag {tag} not found")
    return commit


def tag_commit(repository: str, tag: str) -> str:
    out = subprocess.run(
        ["git", "ls-remote", "--tags", f"https://github.com/{repository}.git", f"refs/tags/{tag}", f"refs/tags/{tag}^{{}}"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return parse_ls_remote(out, tag)


def new_lock(lock: Lock, tag: str, commit: str, sums_sha256: str) -> dict:
    return {
        "repository": lock.repository,
        "tag": tag,
        "git_commit": commit,
        "contract_major": CONTRACT_MAJOR,
        "sha256sums_sha256": sums_sha256,
    }


def check_contract(tag: str, sums: bytes, contract: bytes) -> str:
    """Contract version of a release, after checking contract.json against its SHA256SUMS and its
    MAJOR against the one this pipeline reads (SPEC §4.3)."""
    listed = parse_sha256sums(sums.decode("utf-8")).get("contract.json")
    if listed != hashlib.sha256(contract).hexdigest():
        raise LockError(f"contract.json of {tag} does not match its SHA256SUMS")
    data = json.loads(contract)
    major = contract_major(data)
    if major != CONTRACT_MAJOR:
        raise LockError(
            f"contract_version {data['contract_version']} of {tag} has MAJOR {major}; "
            f"the site supports MAJOR {CONTRACT_MAJOR}. Update the pipeline before bumping the lock."
        )
    return data["contract_version"]


def summary(old: dict, new: dict) -> str:
    od, nd = old["data"], new["data"]
    lines = [
        f"Bumps internacia-db from **{od['tag']}** to **{nd['tag']}** ({nd['release_url']}).",
        "",
        f"- Contract version: {od['contract_version']} → {nd['contract_version']}",
        f"- Release built: {nd['build_date']}, commit `{nd['git_commit'][:12]}`",
        "",
        "| Records | Before | After | Change |",
        "|---|---:|---:|---:|",
    ]
    for key, value in new["counts"].items():
        before = old["counts"].get(key, 0)
        lines.append(f"| {key} | {before:,} | {value:,} | {value - before:+,} |")
    lines += [
        "",
        "The workflow fetched and verified the release, built the site and ran `check_site.py` before opening this pull request.",
    ]
    return "\n".join(lines) + "\n"


def _output(name: str, value: str) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(f"{name}={value}\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check")
    upd = sub.add_parser("update")
    upd.add_argument("--tag")
    summ = sub.add_parser("summary")
    summ.add_argument("old", type=Path)
    summ.add_argument("new", type=Path)
    args = parser.parse_args(argv)

    if args.command == "summary":
        old = json.loads(args.old.read_text(encoding="utf-8"))
        new = json.loads(args.new.read_text(encoding="utf-8"))
        sys.stdout.write(summary(old, new))
        return 0

    # The lock is about to be replaced, so it may still pin an older contract MAJOR.
    lock = load_lock(args.lock, pipeline_major=None)
    if args.command == "check":
        tag = latest_tag(lock.repository)
        newer = version_key(tag) > version_key(lock.tag)
        print(f"pinned {lock.tag}, latest {tag}: {'newer release available' if newer else 'up to date'}")
        _output("latest", tag)
        _output("newer", "true" if newer else "false")
        return 0

    tag = args.tag or latest_tag(lock.repository)
    if tag == lock.tag:
        print(f"already pinned to {tag}")
        return 0
    base = f"https://github.com/{lock.repository}/releases/download/{tag}/"
    sums = _get(base + "SHA256SUMS")
    try:
        contract_version = check_contract(tag, sums, _get(base + "contract.json"))
    except (LockError, FetchError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    data = new_lock(lock, tag, tag_commit(lock.repository, tag), hashlib.sha256(sums).hexdigest())
    args.lock.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    load_lock(args.lock)  # validate what was written
    print(f"lock file now pins {tag} ({data['git_commit'][:12]}, contract {contract_version})")
    _output("tag", tag)
    return 0


if __name__ == "__main__":
    sys.exit(main())
