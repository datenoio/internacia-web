import hashlib
import json
import shutil
from dataclasses import replace

import pytest

import fetch
from fetch import FetchError, contract_major, fetch_assets, parse_sha256sums


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def test_parse_sha256sums_text_and_binary_mode():
    a, b = "a" * 64, "b" * 64
    sums = parse_sha256sums(f"{a}  contract.json\n{b} *internacia.duckdb\n\n")
    assert sums == {"contract.json": a, "internacia.duckdb": b}


@pytest.mark.parametrize("text", ["abc  file\n", f"{'a' * 64}\n"])
def test_parse_sha256sums_malformed(text):
    with pytest.raises(FetchError, match="malformed"):
        parse_sha256sums(text)


def test_parse_sha256sums_duplicate():
    line = f"{'a' * 64}  x.json\n"
    with pytest.raises(FetchError, match="twice"):
        parse_sha256sums(line * 2)


@pytest.mark.parametrize(("version", "major"), [("3.1", 3), ("10.0", 10)])
def test_contract_major(version, major):
    assert contract_major({"contract_version": version}) == major


@pytest.mark.parametrize("contract", [{}, {"contract_version": 3}, {"contract_version": "x.1"}])
def test_contract_major_invalid(contract):
    with pytest.raises(FetchError, match="contract_version"):
        contract_major(contract)


@pytest.fixture
def release(tmp_path, monkeypatch, lock):
    """A fake release folder served through a patched fetch.download."""
    served = tmp_path / "release"
    served.mkdir()
    files = {name: f"content of {name}".encode() for name in fetch.ASSETS}
    files["contract.json"] = json.dumps({"contract_version": "4.0"}).encode()
    for name, data in files.items():
        (served / name).write_bytes(data)
    sums = "".join(f"{_sha(data)}  {name}\n" for name, data in files.items()).encode()
    (served / "SHA256SUMS").write_bytes(sums)

    calls = []

    def fake_download(url, dest):
        name = url.rsplit("/", 1)[1]
        calls.append(name)
        shutil.copyfile(served / name, dest)

    monkeypatch.setattr(fetch, "download", fake_download)
    return {
        "served": served,
        "lock": replace(lock, sha256sums_sha256=_sha(sums)),
        "calls": calls,
        "dest": tmp_path / "cache",
    }


def test_fetch_assets_verifies_and_caches(release):
    verified = fetch_assets(release["lock"], release["dest"], log=lambda *_: None)
    assert set(verified) == {"SHA256SUMS", *fetch.ASSETS}
    assert len(release["calls"]) == len(fetch.ASSETS) + 1

    release["calls"].clear()
    fetch_assets(release["lock"], release["dest"], log=lambda *_: None)
    assert release["calls"] == []


def test_fetch_assets_rejects_wrong_sha256sums(release):
    lock = replace(release["lock"], sha256sums_sha256="f" * 64)
    with pytest.raises(FetchError, match="lock file expects"):
        fetch_assets(lock, release["dest"], log=lambda *_: None)


def test_fetch_assets_rejects_tampered_asset(release):
    (release["served"] / "internacia.duckdb").write_bytes(b"tampered")
    with pytest.raises(FetchError, match="does not match SHA256SUMS"):
        fetch_assets(release["lock"], release["dest"], log=lambda *_: None)
    assert not (release["dest"] / "internacia.duckdb").exists()


def test_fetch_assets_redownloads_corrupted_cache(release):
    fetch_assets(release["lock"], release["dest"], log=lambda *_: None)
    (release["dest"] / "contract.json").write_text("corrupted")
    release["calls"].clear()
    fetch_assets(release["lock"], release["dest"], log=lambda *_: None)
    assert release["calls"] == ["contract.json"]


def test_fetch_assets_rejects_other_contract_major(release):
    lock = replace(release["lock"], contract_major=5)
    with pytest.raises(FetchError, match="supports MAJOR 5"):
        fetch_assets(lock, release["dest"], log=lambda *_: None)
