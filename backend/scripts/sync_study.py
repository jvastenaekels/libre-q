"""Script to synchronize study configuration from JSON."""

import asyncio
import os
import sys

# Add backend directory to path so 'from app' works regardless of CWD
# We assume this script is in backend/scripts/
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.utils.script_utils import sync_study_from_file

if __name__ == "__main__":
    # Default to example-study.json if no argument provided
    if len(sys.argv) > 1:
        json_path = sys.argv[1]
    else:
        json_path = os.path.join(backend_dir, "data", "example-study.json")

    asyncio.run(sync_study_from_file(json_path))
