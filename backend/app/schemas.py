from typing import List, Optional, Any, Dict
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import StudyState, ParticipantStatus

# Translation Schemas
class StudyTranslationBase(BaseModel):
    language_code: str = Field(..., max_length=5)
    title: str
    description: str
    instructions: str
    ui_labels: Dict[str, str] = {}

class StudyTranslationCreate(StudyTranslationBase):
    pass

class StudyTranslationRead(StudyTranslationBase):
    id: int
    study_id: int
    model_config = ConfigDict(from_attributes=True)

class StatementTranslationBase(BaseModel):
    language_code: str = Field(..., max_length=5)
    text: str

class StatementTranslationCreate(StatementTranslationBase):
    pass

class StatementTranslationRead(StatementTranslationBase):
    id: int
    statement_id: int
    model_config = ConfigDict(from_attributes=True)

# Statement Schemas
class StatementBase(BaseModel):
    code: str

class StatementCreate(StatementBase):
    translations: List[StatementTranslationCreate]

class StatementRead(StatementBase):
    id: int
    study_id: int
    translations: List[StatementTranslationRead] = []
    model_config = ConfigDict(from_attributes=True)

# Study Schemas
class StudyBase(BaseModel):
    slug: str
    state: StudyState = StudyState.draft
    grid_config: Dict[str, Any]
    presort_config: Dict[str, Any]
    postsort_config: Dict[str, Any]

class StudyCreate(StudyBase):
    owner_id: int # Explicitly passed for now or inferred
    translations: List[StudyTranslationCreate]
    statements: List[StatementCreate] = []

class StudyRead(StudyBase):
    id: int
    owner_id: int
    created_at: Any
    translations: List[StudyTranslationRead] = []
    statements: List[StatementRead] = []
    
    # This field could be populated dynamically if needed, 
    # but for now we expose the full translations list.
    model_config = ConfigDict(from_attributes=True)

# Q-Sort Submission Schemas
class QSortEntryInput(BaseModel):
    statement_id: int
    grid_score: int
    card_comment: Optional[str] = None

class SubmissionInput(BaseModel):
    session_token: UUID
    study_slug: str
    language_used: str
    status: Optional[ParticipantStatus] = ParticipantStatus.completed # Default to completed
    presort_answers: Dict[str, Any] = {}
    qsort: List[QSortEntryInput]
    postsort_answers: Dict[str, Any] = {}

    @field_validator('qsort')
    @classmethod
    def validate_qsort_structure(cls, v: List[QSortEntryInput]) -> List[QSortEntryInput]:
        # Basic validation: check for duplicates
        statement_ids = [entry.statement_id for entry in v]
        if len(statement_ids) != len(set(statement_ids)):
            raise ValueError("Duplicate statement_id found in Q-Sort submission")
        return v
