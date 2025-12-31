"""Seed the database with study content from a JSON file."""

import asyncio
import os
import sys

# Add the parent directory to sys.path to allow imports from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.script_utils import sync_study_from_file

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python seed.py <path_to_study_json>")
        sys.exit(1)

    json_file = sys.argv[1]
    asyncio.run(sync_study_from_file(json_file))
