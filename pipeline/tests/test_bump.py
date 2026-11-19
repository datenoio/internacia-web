import pytest

from bump import new_lock, parse_ls_remote, summary, version_key
from lock import LockError


def test_parse_ls_remote_prefers_peeled_commit():
    out = (
        "322ffadcda4fec49864b03e0ec5940e897f50654\trefs/tags/v3.1.0\n"
        "930121d1b83655ef2fdb4379d8aa506111918dca\trefs/tags/v3.1.0^{}\n"
    )
    assert parse_ls_remote(out, "v3.1.0") == "930121d1b83655ef2fdb4379d8aa506111918dca"


def test_parse_ls_remote_lightweight_tag():
    out = "930121d1b83655ef2fdb4379d8aa506111918dca\trefs/tags/v3.2.0\n"
    assert parse_ls_remote(out, "v3.2.0") == "930121d1b83655ef2fdb4379d8aa506111918dca"


def test_parse_ls_remote_missing_tag():
    with pytest.raises(LockError, match="not found"):
        parse_ls_remote("", "v9.9.9")


def test_version_key_orders_numerically():
    assert version_key("v3.10.0") > version_key("v3.9.1")


def test_new_lock_keeps_contract_major(lock):
    data = new_lock(lock, "v4.0.0", "a" * 40, "b" * 64)
    assert data["contract_major"] == lock.contract_major
    assert data["tag"] == "v4.0.0"


def test_summary_lists_changes():
    old = {"data": {"tag": "v3.1.0", "contract_version": "3.1"}, "counts": {"countries": 256, "intblocks": 1275}}
    new = {
        "data": {"tag": "v3.2.0", "contract_version": "3.2", "release_url": "https://example.org/r", "build_date": "2026-12-01", "git_commit": "c" * 40},
        "counts": {"countries": 256, "intblocks": 1290},
    }
    text = summary(old, new)
    assert "**v3.1.0** to **v3.2.0**" in text
    assert "| intblocks | 1,275 | 1,290 | +15 |" in text
    assert "| countries | 256 | 256 | +0 |" in text
