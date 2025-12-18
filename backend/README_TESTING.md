# Backend Testing

The backend uses `pytest` for testing.

## Prerequisites

Ensure you have the virtual environment activated and dependencies installed:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install pytest httpx pytest-asyncio
```

## Running Tests

Run all tests from the `backend/` directory:

```bash
# Using the module invocation (recommended for path resolution)
./venv/bin/python3 -m pytest tests
```

## Test Structure

- `tests/conftest.py`: Sets up the test environment, including:
  - In-memory SQLite database (`StaticPool` for async support)
  - `seed_study` fixture for populating a test study
  - `client` fixture for async API requests
- `tests/test_api.py`: Contains test cases for all API endpoints.
