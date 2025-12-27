# Open-Q - Open-source platform for conducting Q-methodology research
# Copyright (C) 2025 Julien Vastenekels
# Licensed under the GNU Affero General Public License v3.0 or later.

"""Middleware for global error handling."""

import logging
import traceback

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


async def global_exception_handler(request: Request, exc: Exception):
    """Global handler for all unhandled exceptions.

    Logs the error with trace and returns a clean JSON response.
    """
    # Log the full traceback for debugging
    logger.error(f"Unhandled Exception: {str(exc)}\n{traceback.format_exc()}")

    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred.",
            "type": "internal_error",
        },
    )
