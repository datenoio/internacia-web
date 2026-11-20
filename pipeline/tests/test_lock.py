import pytest

from lock import CONTRACT_MAJOR, DEFAULT_LOCK, LockError, load_lock


def test_repository_lock_file_is_valid():
    lock = load_lock(DEFAULT_LOCK)
    assert lock.tag.startswith("v")
    assert lock.version == lock.tag[1:]
    assert lock.contract_major == CONTRACT_MAJOR


def test_valid_lock(write_lock, lock_dict):
    lock = load_lock(write_lock(lock_dict))
    assert lock.version == "4.0.0"
    assert lock.asset_url("SHA256SUMS") == (
        "https://github.com/datenoio/internacia-db/releases/download/v4.0.0/SHA256SUMS"
    )


@pytest.mark.parametrize("field", ["repository", "tag", "git_commit", "contract_major", "sha256sums_sha256"])
def test_missing_field(write_lock, lock_dict, field):
    del lock_dict[field]
    with pytest.raises(LockError, match=f"missing field '{field}'"):
        load_lock(write_lock(lock_dict))


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("tag", "latest"),
        ("tag", "3.1.0"),
        ("git_commit", "930121d"),
        ("contract_major", "3"),
        ("contract_major", True),
        ("sha256sums_sha256", "abc"),
        ("repository", "internacia-db"),
    ],
)
def test_invalid_value(write_lock, lock_dict, field, value):
    lock_dict[field] = value
    with pytest.raises(LockError, match="invalid value"):
        load_lock(write_lock(lock_dict))


def test_unknown_field(write_lock, lock_dict):
    lock_dict["latest"] = True
    with pytest.raises(LockError, match="unknown fields"):
        load_lock(write_lock(lock_dict))


@pytest.mark.parametrize("major", [CONTRACT_MAJOR - 1, CONTRACT_MAJOR + 1])
def test_lock_must_pin_pipeline_major(write_lock, lock_dict, major):
    lock_dict["contract_major"] = major
    with pytest.raises(LockError, match=f"this pipeline reads contract MAJOR {CONTRACT_MAJOR}"):
        load_lock(write_lock(lock_dict))


def test_old_lock_readable_for_bump(write_lock, lock_dict):
    lock_dict["contract_major"] = CONTRACT_MAJOR - 1
    assert load_lock(write_lock(lock_dict), pipeline_major=None).contract_major == CONTRACT_MAJOR - 1
