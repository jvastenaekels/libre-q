"""Unit tests for SQLAlchemy models."""

import pytest

from app.models import Study, StudyState, User


@pytest.mark.asyncio
async def test_study_default_state(db):
    """Test that a new study defaults to 'draft' state when persisted."""
    study = Study(
        slug="test-default",
        owner_id=1,
        grid_config={},
        presort_config={},
        postsort_config={},
    )
    db.add(study)
    await db.flush()
    # Now default should be applied by SQLAlchemy
    assert study.state == StudyState.draft


@pytest.mark.asyncio
async def test_study_new_fields(db):
    """Test show_statement_codes and default_language in Study model."""
    study = Study(
        slug="test-fields",
        owner_id=1,
        grid_config={},
        presort_config={},
        postsort_config={},
        default_language="fi",
        show_statement_codes=True,
    )
    db.add(study)
    await db.commit()

    # Reload
    from sqlalchemy import select

    result = await db.execute(select(Study).where(Study.slug == "test-fields"))
    reloaded = result.scalar_one()
    assert reloaded.default_language == "fi"
    assert reloaded.show_statement_codes is True


def test_user_hashing_placeholder():
    """Ensure User model handles passwords appropriately (integration point usually)."""
    u = User(email="a@b.com", hashed_password="hashed_secret")
    assert u.hashed_password == "hashed_secret"
