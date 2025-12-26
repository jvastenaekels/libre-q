
from typing import Callable, Optional
from fastapi import Depends, HTTPException, status, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User, StudyCollaborator, StudyRole, Study

# --- Security Stubs (Replace with actual auth later) ---
async def get_current_user(db: AsyncSession = Depends(get_db)) -> User:
    """
    STUB: Returns a fake user for now.
    In real impl, this would validate JWT and fetch user.
    """
    # For dev purposes, we might want to return a user based on a header or just the first user
    # Returning None or raising 401 if no user found is standard
    # Here we'll just try to find a user or raise 401
    
    # Check for a specific mock user for testing if needed, strictly for verified scripts
    # But usually we want to simulate a logged in user.
    # Let's assume there is at least one user in DB or valid token logic.
    # For the stub, we will raise NOT IMPLEMENTED unless used in a test context where we can override it using app.dependency_overrides
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication not implemented"
    )

# --- RBAC Logic ---

ROLE_HIERARCHY = {
    StudyRole.owner: 30,
    StudyRole.editor: 20,
    StudyRole.viewer: 10
}

def check_study_permission(required_role: StudyRole) -> Callable:
    """
    Factory creating a dependency to check if current_user has 'required_role' (or higher) on 'study_id'.
    """
    async def permission_dependency(
        study_slug: str = Path(..., description="The slug of the study"), # Using slug usually, or ID? 
        # CAUTION: The user request mentioned 'study_id', but URLs usually use 'slug'.
        # Let's support both or check what usage implies. 
        # The prompt said "Prendre study_id...". But mostly we use slugs in routes.
        # Let's assume we might need to look up study by ID or slug.
        # If the route uses `study_id`, we expect `study_id`. 
        # If the route uses `slug`, we need to resolve it or expect `slug`.
        # Standard Rest permissions usually act on resources identified by ID.
        # Let's try to be flexible or check route param.
        # For now, let's implement for standard `study_slug` since that's what we used in `submissions.py` /study/{slug}
        # But wait, `submissions.py` is public. Administrative routes usually use ID or slug.
        # Let's implement for `slug` as it acts as ID in this app mostly.
        
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> StudyCollaborator:
        
        # 1. Resolve Study (need ID to check collaborator)
        # We can join or just look up.
        # Optimized query: select role from study_collaborator join study
        
        # Determine required level
        required_level = ROLE_HIERARCHY[required_role]
        
        query = (
            select(StudyCollaborator)
            .join(Study)
            .where(Study.slug == study_slug)
            .where(StudyCollaborator.user_id == current_user.id)
        )
        
        result = await db.execute(query)
        collaborator = result.scalar_one_or_none()
        
        if not collaborator:
            # Maybe the user IS the owner stored in study.owner_id?
            # We decided owner_id is creator, but maybe we should ensure creators are added as owners in collaborators table?
            # Ideally yes. Checks should be uniform on collaborators table.
            # If migration didn't add creators to collaborators, we might fail here.
            # Let's stick to strict collaborator check as per prompt ("Interroger la table StudyCollaborator").
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this study."
            )
            
        # 2. Check Role Hierarchy
        user_level = ROLE_HIERARCHY[collaborator.role]
        
        if user_level < required_level:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {required_role}"
            )
            
        return collaborator

    return permission_dependency
