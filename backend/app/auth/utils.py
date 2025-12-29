"""
Authentication utilities - JWT and password handling
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.jwt_access_token_expire_hours)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """
    Verify JWT token and return payload
    Returns None if token is invalid
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None

def authenticate_user(db: Session, username: str, password: str):
    """
    Authenticate user against database.
    Returns User object if credentials are valid, None otherwise.

    Also updates last_login_at timestamp on successful authentication.
    """
    from app.models.database import User

    # Query user by username
    user = db.query(User).filter(User.username == username).first()

    if not user:
        return None

    # Check if account is active
    if not user.is_active:
        return None

    # Verify password hash
    if not verify_password(password, user.password_hash):
        return None

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    return user

def create_auth_token(user) -> str:
    """
    Create authentication token for valid user.
    Token includes user_id, username, and role for authorization.

    Args:
        user: User object from database

    Returns:
        JWT access token string
    """
    from app.models.database import User

    token_data = {
        "sub": str(user.id),  # Subject = user ID (as string for JWT)
        "username": user.username,
        "role": user.role.value,  # "STAFF" or "MANAGER"
        "iat": datetime.utcnow()
    }
    return create_access_token(token_data)