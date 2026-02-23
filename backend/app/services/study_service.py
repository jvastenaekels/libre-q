# Libre-Q - Open-source platform for conducting Q-methodology research
# Copyright (C) 2025 Julien Vastenekels
# Licensed under the GNU Affero General Public License v3.0 or later.

"""Service layer for core Study operations (config, translations, validation).

Submission and data-export logic live in dedicated services:
- ``submission_service.SubmissionService``
- ``study_data_service.StudyDataService``

For backward compatibility, ``StudyService`` delegates to those services so
that existing ``StudyService.process_submission(...)`` calls keep working.
"""

import hashlib
import json
import logging
from typing import Any, cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import (
    Statement,
    Study,
    StudyState,
    StudyTranslation,
)
from .study_defaults import DEFAULT_PROCESS_STEPS, DEFAULT_TRANSLATION_CONTENT

logger = logging.getLogger(__name__)

# Re-export constants so ``from app.services.study_service import DEFAULT_PROCESS_STEPS`` keeps working.
__all__ = [
    "StudyService",
    "DEFAULT_PROCESS_STEPS",
    "DEFAULT_TRANSLATION_CONTENT",
]


class StudyService:
    """Core study operations: lookup, translation resolution, config, validation."""

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------

    @staticmethod
    async def get_study_by_slug(db: AsyncSession, slug: str) -> Study | None:
        """Retrieve a study by its slug with relations loaded."""
        stmt = (
            select(Study)
            .where(Study.slug == slug)
            .options(
                selectinload(Study.translations),
                selectinload(Study.statements).selectinload(Statement.translations),
                selectinload(Study.participants),
            )
        )
        result = await db.execute(stmt)
        return cast(Study | None, result.scalar_one_or_none())

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_session_seed(token: str) -> int:
        """Generate deterministic seed from submission token for reproducible randomization"""
        return int(hashlib.sha256(token.encode()).hexdigest()[:8], 16)

    # ------------------------------------------------------------------
    # Translation resolution
    # ------------------------------------------------------------------

    @staticmethod
    def resolve_translation(
        study: Study, requested_lang: str | None
    ) -> tuple[str, StudyTranslation | None]:
        """Logic: Requested Lang -> Default (Study) -> English -> First Available."""
        # 1. Requested
        translation = next(
            (t for t in study.translations if t.language_code == requested_lang), None
        )

        # 2. Default (Study)
        if not translation and study.default_language:
            translation = next(
                (
                    t
                    for t in study.translations
                    if t.language_code == study.default_language
                ),
                None,
            )

        # 3. English
        if not translation:
            translation = next(
                (t for t in study.translations if t.language_code == "en"), None
            )

        # 4. First Available
        if not translation and study.translations:
            translation = study.translations[0]

        # Use study.default_language if no translation found at all, fallback to 'en'
        resolved_lang = (
            translation.language_code
            if translation
            else (study.default_language or "en")
        )
        return resolved_lang, translation

    @staticmethod
    def get_basic_metadata(study: Study, lang: str | None = None) -> dict[str, Any]:
        """Returns minimal robust metadata (title, description) for locked screens."""
        resolved_lang, translation = StudyService.resolve_translation(study, lang)

        # Robust title fallback
        title = getattr(translation, "title", "")
        if not title:
            # Fallback to English title, then first available, then slug
            _, eng_trans = StudyService.resolve_translation(study, "en")
            title = getattr(eng_trans, "title", "")
            if not title and study.translations:
                title = getattr(study.translations[0], "title", "")
            if not title:
                title = study.slug

        # Robust description fallback
        description = getattr(translation, "description", "")
        if not description:
            _, eng_trans = StudyService.resolve_translation(study, "en")
            description = getattr(eng_trans, "description", "")

        return {
            "slug": study.slug,
            "title": title,
            "description": description,
            "language": resolved_lang,
        }

    # ------------------------------------------------------------------
    # Full config resolution (participant-facing)
    # ------------------------------------------------------------------

    @staticmethod
    async def get_resolved_study_config(
        study: Study,
        lang: str | None = None,
        session_token: UUID | None = None,
    ) -> dict[str, Any]:
        """Resolves study configuration including translations, randomization, and state."""
        resolved_lang, translation = StudyService.resolve_translation(study, lang)

        # Transform to Frontend Format
        # Get defaults for the resolved language (try full code, then base lang, then English)
        base_lang = resolved_lang.split("-")[0]
        lang_defaults = (
            DEFAULT_TRANSLATION_CONTENT.get(resolved_lang)
            or DEFAULT_TRANSLATION_CONTENT.get(base_lang)
            or DEFAULT_TRANSLATION_CONTENT.get("en", {})
        )

        title = getattr(translation, "title", "") or study.slug
        description = getattr(translation, "description", "") or lang_defaults.get(
            "description", ""
        )
        instructions = getattr(translation, "instructions", "") or lang_defaults.get(
            "instructions", ""
        )
        condition_of_instruction = getattr(
            translation, "condition_of_instruction", None
        ) or lang_defaults.get(
            "condition_of_instruction", "What is your stance on this statement?"
        )

        subtitle = getattr(translation, "subtitle", None) or lang_defaults.get(
            "subtitle", None
        )
        objective = getattr(translation, "objective", None) or lang_defaults.get(
            "objective", None
        )

        statements_data = []
        for s in study.statements:
            # Resolve statement translation
            s_trans = next(
                (t for t in s.translations if t.language_code == resolved_lang), None
            )
            if not s_trans:
                s_trans = next(
                    (t for t in s.translations if t.language_code == "en"), None
                )
            if not s_trans and s.translations:
                s_trans = s.translations[0]

            text = s_trans.text if s_trans else s.code
            statements_data.append({"id": s.id, "text": text, "code": s.code})

        # Q Methodology: Randomize statement order if configured
        if study.randomize_statement_order and session_token:
            import random

            local_random = random.Random(
                StudyService._generate_session_seed(str(session_token))
            )
            local_random.shuffle(statements_data)

        # Helper for translation attributes
        def get_t_attr(attr: str, default: Any = None) -> Any:
            return getattr(translation, attr, default) if translation else default

        # Calculate effective state based on dates
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        effective_state = study.state.value

        if study.state == StudyState.active:

            def is_now_before(target_dt: datetime) -> bool:
                if target_dt.tzinfo is None:
                    return now.replace(tzinfo=None) < target_dt
                return now < target_dt

            def is_now_after(target_dt: datetime) -> bool:
                if target_dt.tzinfo is None:
                    return now.replace(tzinfo=None) > target_dt
                return now > target_dt

            if study.start_date and is_now_before(study.start_date):
                effective_state = StudyState.paused.value
            elif study.end_date and is_now_after(study.end_date):
                effective_state = StudyState.closed.value

        return {
            "slug": study.slug,
            "title": title,
            "subtitle": subtitle,
            "description": description,
            "objective": objective,
            "instructions": instructions,
            "presort_config": study.presort_config,
            "postsort_config": study.postsort_config,
            "grid_config": study.grid_config,
            "statements": statements_data,
            "process_steps": (getattr(translation, "process_steps", []) or [])
            or DEFAULT_PROCESS_STEPS.get(resolved_lang)
            or DEFAULT_PROCESS_STEPS.get(base_lang)
            or DEFAULT_PROCESS_STEPS.get("en", []),
            "consent": {
                "title": get_t_attr("consent_title")
                or lang_defaults.get("consent_title"),
                "description": get_t_attr("consent_description")
                or lang_defaults.get("consent_description"),
            },
            "condition_of_instruction": condition_of_instruction,
            "pre_instruction": getattr(translation, "pre_instruction", None)
            or lang_defaults.get("pre_instruction"),
            "available_languages": [t.language_code for t in study.translations],
            "language": resolved_lang,
            "default_language": study.default_language,
            "show_statement_codes": study.show_statement_codes,
            "randomize_statement_order": study.randomize_statement_order,
            "ui_labels": get_t_attr("ui_labels", {}) or {},
            "methodology_tips": (getattr(translation, "methodology_tips", []) or [])
            or lang_defaults.get("methodology_tips", []),
            "state": effective_state,
            "step_help": (getattr(translation, "step_help", {}) or {})
            or lang_defaults.get("step_help", {}),
            "requires_password": False,
            "start_date": study.start_date,
            "end_date": study.end_date,
            "branding": study.branding
            or {"logo_url": None, "accent_color": None, "partners": []},
        }

    # ------------------------------------------------------------------
    # Activation validation
    # ------------------------------------------------------------------

    @staticmethod
    def validate_for_activation(study: Study) -> list[str]:
        """
        Comprehensive check to see if a study is ready for research.
        Returns a list of human-readable error messages (JSON encoded for i18n).
        """
        errors = []

        def add_error(key: str, **kwargs):
            errors.append(
                json.dumps({"key": f"admin.design.validation.errors.{key}", **kwargs})
            )

        # 1. Statements Exist
        if not study.statements:
            add_error("no_statements")

        # 2. Grid Config exists and matches statements
        if not study.grid_config:
            add_error("no_grid")
        else:
            total_capacity = sum(
                int(col.get("capacity", 0)) for col in study.grid_config
            )
            if len(study.statements) != total_capacity:
                add_error(
                    "capacity_mismatch",
                    total=total_capacity,
                    count=len(study.statements),
                )

        # 3. Minimum Translations
        if not study.translations:
            add_error("no_translations")
        else:
            # Check if default language has a translation
            default_lang = study.default_language or "en"
            has_default = any(
                t.language_code == default_lang for t in study.translations
            )
            if not has_default:
                # If we have other translations, the resolver will fallback to the first available.
                # We only error if there are NO translations at all (handled above).
                # However, it's good practice to have the default language translation.
                # To be flexible, we'll allow activation as long as SOMETHING is there.
                pass

            # Check for missing titles in any translation
            for t in study.translations:
                if not t.title or t.title.strip() == "":
                    add_error("missing_title", lang=t.language_code)

                if not t.consent_title or t.consent_title.strip() == "":
                    add_error("missing_consent_title", lang=t.language_code)

                if not t.consent_description or t.consent_description.strip() == "":
                    add_error("missing_consent_description", lang=t.language_code)

                if (
                    not t.condition_of_instruction
                    or t.condition_of_instruction.strip() == ""
                ):
                    add_error("missing_grid_instructions", lang=t.language_code)

                # Check process steps
                for i, step in enumerate(t.process_steps):
                    title = step.get("title")
                    if not title or title.strip() == "":
                        add_error(
                            "missing_step_title", index=i + 1, lang=t.language_code
                        )

        # 4. Questions (Pre/Post) have labels for all study languages
        def check_questions(config: dict, section: str):
            fields = {}
            if section == "presort":
                if "fields" in config:
                    fields = config["fields"]
                elif "enabled" not in config:
                    fields = config
            else:  # postsort
                fields = config.get("questions", {})

            for q_id, q_config in fields.items():
                label = q_config.get("label")
                for lang in study_langs:
                    lang_label = None
                    if isinstance(label, dict):
                        lang_label = label.get(lang)
                    elif lang == "en":  # Legacy string fallback to en
                        lang_label = label

                    if not lang_label or (
                        isinstance(lang_label, str) and lang_label.strip() == ""
                    ):
                        add_error(
                            "missing_question_label",
                            id=q_id,
                            lang=lang,
                            section=section,
                        )

                    # Check options
                    options = q_config.get("options", [])
                    if options:
                        for i, opt in enumerate(options):
                            opt_label = None
                            if isinstance(opt, dict):
                                opt_label_obj = opt.get("label")
                                if isinstance(opt_label_obj, dict):
                                    opt_label = opt_label_obj.get(lang)
                                elif lang == "en":
                                    opt_label = opt_label_obj
                            elif lang == "en":  # Legacy string
                                opt_label = opt

                            if not opt_label or (
                                isinstance(opt_label, str) and opt_label.strip() == ""
                            ):
                                add_error(
                                    "missing_option_label",
                                    id=q_id,
                                    index=i + 1,
                                    lang=lang,
                                    section=section,
                                )

        study_langs = {t.language_code for t in study.translations}
        if study.presort_config:
            check_questions(study.presort_config, "presort")
        if study.postsort_config:
            check_questions(study.postsort_config, "postsort")

        # 5. Statements have translations for all study languages
        for s in study.statements:
            s_langs = {st.language_code for st in s.translations}
            missing = study_langs - s_langs
            if missing:
                add_error(
                    "missing_statement_translation",
                    code=s.code,
                    missing=", ".join(missing),
                )

            # Check for empty text in translations (only for active languages)
            for st in s.translations:
                if st.language_code in study_langs and (
                    not st.text or st.text.strip() == ""
                ):
                    add_error(
                        "empty_statement_text", code=s.code, lang=st.language_code
                    )

        return errors

    # ------------------------------------------------------------------
    # Backward-compatible delegates
    # ------------------------------------------------------------------
    # These static methods forward to the new dedicated services so that
    # existing callers (``StudyService.process_submission(…)``, etc.)
    # continue to work without changes.

    @staticmethod
    async def record_consent(*args, **kwargs):
        from .submission_service import SubmissionService

        return await SubmissionService.record_consent(*args, **kwargs)

    @staticmethod
    def validate_distribution(*args, **kwargs):
        from .submission_service import SubmissionService

        return SubmissionService.validate_distribution(*args, **kwargs)

    @staticmethod
    async def process_submission(*args, **kwargs):
        from .submission_service import SubmissionService

        return await SubmissionService.process_submission(*args, **kwargs)

    @staticmethod
    async def delete_audio_files_for_study(*args, **kwargs):
        from .study_data_service import StudyDataService

        return await StudyDataService.delete_audio_files_for_study(*args, **kwargs)

    @staticmethod
    async def reset_study_participants(*args, **kwargs):
        from .study_data_service import StudyDataService

        return await StudyDataService.reset_study_participants(*args, **kwargs)

    @staticmethod
    async def get_study_stats(*args, **kwargs):
        from .study_data_service import StudyDataService

        return await StudyDataService.get_study_stats(*args, **kwargs)

    @staticmethod
    async def get_study_full_dump(*args, **kwargs):
        from .study_data_service import StudyDataService

        return await StudyDataService.get_study_full_dump(*args, **kwargs)

    @staticmethod
    async def get_study_sort_data(*args, **kwargs):
        from .study_data_service import StudyDataService

        return await StudyDataService.get_study_sort_data(*args, **kwargs)
