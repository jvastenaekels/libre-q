"""Analysis schemas for Q-method factor analysis."""

from pydantic import BaseModel, Field, field_validator


class AnalysisRequest(BaseModel):
    """Schema for requesting a Q-method factor analysis."""

    extraction: str = Field(
        "pca", description="Factor extraction method: 'pca' or 'centroid'"
    )
    n_factors: int = Field(3, ge=1, le=20, description="Number of factors to extract")
    rotation: str = Field("varimax", description="Rotation method: 'varimax' or 'none'")
    flagging: str = Field("auto", description="Flagging method: 'auto' or 'manual'")
    manual_flags: dict[int, int] | None = Field(
        None,
        description="Manual participant-to-factor assignments (participant_db_id → factor_number, 1-indexed)",
    )

    @field_validator("extraction")
    @classmethod
    def validate_extraction(cls, v: str) -> str:
        if v not in ("pca", "centroid"):
            raise ValueError("extraction must be 'pca' or 'centroid'")
        return v

    @field_validator("rotation")
    @classmethod
    def validate_rotation(cls, v: str) -> str:
        if v not in ("varimax", "none"):
            raise ValueError("rotation must be 'varimax' or 'none'")
        return v

    @field_validator("flagging")
    @classmethod
    def validate_flagging(cls, v: str) -> str:
        if v not in ("auto", "manual"):
            raise ValueError("flagging must be 'auto' or 'manual'")
        return v


class ParticipantLoading(BaseModel):
    """Factor loading for a single participant."""

    db_id: int
    label: str
    loadings: list[float]
    flagged_factors: list[int] = Field(
        default_factory=list,
        description="1-indexed factors this participant is flagged to (may be multiple or empty)",
    )


class StatementScore(BaseModel):
    """Z-scores and factor array values for a single statement."""

    statement_id: int
    code: str
    text: str
    z_scores: list[float]
    factor_arrays: list[int]


class StatementClassification(BaseModel):
    """Classification of a statement as distinguishing or consensus."""

    statement_id: int
    code: str
    text: str
    z_scores: list[float]
    factor_arrays: list[int]
    significance: dict[str, str] = Field(
        default_factory=dict,
        description="Pairwise significance levels, e.g. {'1-2': 'p<0.05', '1-3': 'p<0.01'}",
    )


class FactorCharacteristic(BaseModel):
    """Statistical characteristics for a single factor."""

    factor: int = Field(description="1-indexed factor number")
    eigenvalue: float
    variance_explained: float
    cumulative_variance: float
    n_flagged: int
    avg_rel_coef: float = Field(description="Average reliability coefficient")
    composite_reliability: float
    se_factor_scores: float = Field(description="Standard error of factor scores")


class AnalysisResult(BaseModel):
    """Complete result of a Q-method factor analysis."""

    n_participants: int
    n_statements: int
    n_factors: int
    extraction: str
    rotation: str
    eigenvalues: list[float]
    total_variance_explained: float
    loadings: list[list[float]] = Field(
        description="Unrotated loadings: n_participants x n_factors"
    )
    rotated_loadings: list[list[float]] = Field(
        description="Rotated loadings: n_participants x n_factors"
    )
    flags: list[list[bool]] = Field(
        description="Flagging matrix: n_participants x n_factors"
    )
    participants: list[ParticipantLoading]
    statement_scores: list[StatementScore]
    distinguishing: list[StatementClassification]
    consensus: list[StatementClassification]
    factor_characteristics: list[FactorCharacteristic]
    correlation_matrix: list[list[float]] = Field(
        description="Between-factor correlation matrix: n_factors x n_factors"
    )


class EigenvalueResult(BaseModel):
    """Eigenvalues for scree plot (pre-analysis)."""

    eigenvalues: list[float]
    suggested_n_factors: int = Field(
        description="Suggested number of factors (Kaiser criterion: eigenvalue > 1)"
    )
