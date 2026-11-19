import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lock import Lock  # noqa: E402

VALID_LOCK = {
    "repository": "datenoio/internacia-db",
    "tag": "v3.1.0",
    "git_commit": "930121d1b83655ef2fdb4379d8aa506111918dca",
    "contract_major": 3,
    "sha256sums_sha256": "0" * 64,
}


@pytest.fixture
def lock_dict() -> dict:
    return dict(VALID_LOCK)


@pytest.fixture
def write_lock(tmp_path):
    def _write(data: dict) -> Path:
        path = tmp_path / "internacia.lock.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        return path

    return _write


@pytest.fixture
def lock() -> Lock:
    return Lock(**VALID_LOCK)
