"""
Authentication utilities - JWT and password handling
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status

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

def authenticate_user(username: str, password: str) -> bool:
    """
    Authenticate user against environment credentials
    Returns True if credentials are valid
    """
    # Simple comparison against environment variables
    # In production, you might want to hash the stored password too
    return (
        username == settings.auth_username and 
        password == settings.auth_password
    )

def create_auth_token(username: str) -> str:
    """
    Create authentication token for valid user
    """
    token_data = {
        "sub": username,
        "username": username,
        "iat": datetime.utcnow()
    }
    return create_access_token(token_data)