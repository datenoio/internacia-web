"""Read and check internacia.lock.json, the pinned internacia-db release (SPEC §4.2)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LOCK = ROOT / "internacia.lock.json"
DEFAULT_CACHE = ROOT / ".cache" / "internacia"

# Contract MAJOR this pipeline reads (SPEC §4.3). Raise it only together with the code changes a
# new MAJOR needs; bump.py writes it into the lock file and refuses releases with another MAJOR.
CONTRACT_MAJOR = 4

_TAG = re.compile(r"^v\d+\.\d+\.\d+$")
_SHA1 = re.compile(r"^[0-9a-f]{40}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_REPO = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


class LockError(ValueError):
    """The lock file is missing a field or holds an invalid value."""


@dataclass(frozen=True)
class Lock:
    repository: str
    tag: str
    git_commit: str
    contract_major: int
    sha256sums_sha256: str

    @property
    def version(self) -> str:
        """Dataset version as written in _meta and manifests: the tag without its leading v."""
        return self.tag[1:]

    def asset_url(self, name: str) -> str:
        return f"https://github.com/{self.repository}/releases/download/{self.tag}/{name}"

    @property
    def git_url(self) -> str:
        return f"https://github.com/{self.repository}.git"

    @property
    def release_url(self) -> str:
        return f"https://github.com/{self.repository}/releases/tag/{self.tag}"


def load_lock(path: Path = DEFAULT_LOCK, pipeline_major: int | None = CONTRACT_MAJOR) -> Lock:
    """Read and check the lock file. Unless pipeline_major is None, its contract_major must equal
    the MAJOR this pipeline reads; only bump.py, which replaces the lock, reads it without."""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise LockError(f"{path}: file not found") from exc
    except json.JSONDecodeError as exc:
        raise LockError(f"{path}: not valid JSON: {exc}") from exc

    checks = {
        "repository": lambda v: isinstance(v, str) and _REPO.match(v),
        "tag": lambda v: isinstance(v, str) and _TAG.match(v),
        "git_commit": lambda v: isinstance(v, str) and _SHA1.match(v),
        "contract_major": lambda v: isinstance(v, int) and not isinstance(v, bool) and v >= 1,
        "sha256sums_sha256": lambda v: isinstance(v, str) and _SHA256.match(v),
    }
    for key, valid in checks.items():
        if key not in raw:
            raise LockError(f"{path}: missing field {key!r}")
        if not valid(raw[key]):
            raise LockError(f"{path}: invalid value for {key!r}: {raw[key]!r}")
    unknown = sorted(set(raw) - set(checks))
    if unknown:
        raise LockError(f"{path}: unknown fields {unknown}")
    if pipeline_major is not None and raw["contract_major"] != pipeline_major:
        raise LockError(
            f"{path}: contract_major is {raw['contract_major']}, but this pipeline reads contract MAJOR "
            f"{pipeline_major}. Move the lock with pipeline/bump.py update, which writes the pipeline's MAJOR."
        )
    return Lock(**raw)
