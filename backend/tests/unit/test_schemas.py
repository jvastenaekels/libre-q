"""Unit tests for Pydantic schemas."""

import uuid

import pytest
from pydantic import ValidationError

from app.schemas import SubmissionInput


def test_submission_create_valid():
    payload = {
        "session_token": str(uuid.uuid4()),
        "study_slug": "test-study",
        "language_used": "en",
        "status": "completed",
        "presort_answers": {"age": 25},
        "qsort": [{"statement_id": 1, "grid_score": 1, "col": 1, "row": 1}],
        "postsort_answers": {"feedback": "ok"},
    }
    submission = SubmissionInput(**payload)
    assert submission.study_slug == "test-study"
    assert submission.status == "completed"


def test_submission_create_missing_token():
    payload = {
        "study_slug": "test-study",
        "language_used": "en",
        "status": "started",
        "qsort": [],
    }
    with pytest.raises(ValidationError) as excinfo:
        SubmissionInput(**payload)
    assert "session_token" in str(excinfo.value)


def test_submission_create_invalid_status():
    payload = {
        "session_token": str(uuid.uuid4()),
        "study_slug": "test-study",
        "language_used": "en",
        "status": "invalid_status",
        "qsort": [],
    }
    with pytest.raises(ValidationError):
        SubmissionInput(**payload)
