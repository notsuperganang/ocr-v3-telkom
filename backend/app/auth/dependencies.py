"""
Authentication dependencies for FastAPI routes

These dependencies provide authentication and authorization for protected routes.
They return User objects (not username strings) and include role-based guards.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from sqlalchemy.orm import Session

from app.auth.utils import verify_token
from app.database import get_db
from app.models.database import User, UserRole

# HTTP Bearer token scheme
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Authentication dependency for protected routes.
    Returns authenticated User object (not just username string).

    Usage:
        @app.get("/protected")
        def protected_route(current_user: User = Depends(get_current_user)):
            # Route is protected, current_user is User object
            print(f"User {current_user.username} with role {current_user.role}")

    Raises:
        401 Unauthorized if token is invalid or user not found
        403 Forbidden if user account is disabled
    """
    token = credentials.credentials

    # Verify token
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user ID from token (stored in 'sub' claim)
    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Convert user_id to integer
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if account is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    return user


def require_manager(current_user: User = Depends(get_current_user)) -> User:
    """
    Authorization dependency requiring MANAGER role.
    Use this for admin-only endpoints.

    Usage:
        @app.post("/api/admin/users")
        def create_user(current_user: User = Depends(require_manager)):
            # Only MANAGER users can access this route
            # STAFF users will get 403 Forbidden

    Raises:
        403 Forbidden if user does not have MANAGER role
    """
    if current_user.role != UserRole.MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This operation requires MANAGER role"
        )
    return current_user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Optional authentication dependency.
    Returns User object if authenticated, None if not.

    Usage:
        @app.get("/optional-auth")
        def optional_route(current_user: Optional[User] = Depends(get_current_user_optional)):
            if current_user:
                # User is authenticated
                pass
            else:
                # User is not authenticated (anonymous)
                pass
    """
    if credentials is None:
        return None

    token = credentials.credentials
    payload = verify_token(token)

    if payload is None:
        return None

    user_id_str = payload.get("sub")
    if user_id_str is None:
        return None

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        return None

    # Fetch user from database
    user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True
    ).first()

    return user
