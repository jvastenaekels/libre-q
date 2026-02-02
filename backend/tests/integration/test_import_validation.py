import pytest
from httpx import AsyncClient
from app.models import User


@pytest.mark.asyncio
class TestImport500:
    async def test_validate_import_large_payload(
        self,
        client: AsyncClient,
        test_user: User,
        test_workspace,
        auth_token_factory,
    ):
        """
        Reproduce 500 error reported by user during import validation.
        Hypothesis: Large base64 string or specific field structure might be causing issues.
        """
        auth_headers = auth_token_factory(test_user)
        auth_headers["X-Workspace-ID"] = str(test_workspace.id)

        # Huge base64 string
        huge_logo = "data:image/png;base64," + "a" * 500000

        payload = {
            "version": "1.0",
            "exported_at": "2026-02-02T16:34:19+00:00",
            "exported_by": "test@example.com",
            "study": {
                "slug": "ennallistaminen-en",
                "default_language": "en",
                "translations": [
                    {
                        "language_code": "fi",
                        "title": "Test Study",
                        "description": "Desc",
                        "consent_title": "Consent",
                        "consent_description": "Desc",
                    }
                ],
                "statements": [],
                "grid_config": [],
                "branding": {
                    "logo_url": None,
                    "partners": [
                        {
                            "id": "3c0799d0-e914-42a1-9e8c-51a43f233165",
                            "name": "URCA",
                            "logo_url": huge_logo,
                        }
                    ],
                },
            },
        }

        response = await client.post(
            "/api/admin/studies/validate-import", json=payload, headers=auth_headers
        )

        # We expect 200 OK with validation results, not 500
        assert (
            response.status_code == 200
        ), f"Failed with {response.status_code}: {response.text}"
