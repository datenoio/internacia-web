import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lock import Lock  # noqa: E402

VALID_LOCK = {
    "repository": "datenoio/internacia-db",
    "tag": "v5.0.0",
    "git_commit": "e3500d4333d53c3fe9ac458c018517d47a230806",
    "contract_major": 5,
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
