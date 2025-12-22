import pytest
from app.models import Study, StudyState, User
from sqlalchemy.orm import Session

@pytest.mark.asyncio
async def test_study_default_state(db):
    """Test that a new study defaults to 'draft' state when persisted"""
    study = Study(
        slug="test-default",
        owner_id=1,
        grid_config={},
        presort_config={},
        postsort_config={}
    )
    db.add(study)
    await db.flush()
    # Now default should be applied by SQLAlchemy
    assert study.state == StudyState.draft

def test_user_hashing_placeholder():
    """Ensure User model handles passwords appropriately (integration point usually)"""
    u = User(email="a@b.com", hashed_password="hashed_secret")
    assert u.hashed_password == "hashed_secret"
