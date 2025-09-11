#!/usr/bin/env python3
"""
Test script to verify database and authentication setup
Run this after starting PostgreSQL to test the complete setup
"""

import sys
import requests
import json
from pathlib import Path

# Add backend directory to Python path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

def test_database_connection():
    """Test database connection and models"""
    try:
        from app.database import init_database
        print("🔗 Testing database connection...")
        init_database()
        print("✅ Database connection successful!")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        return False

def test_authentication():
    """Test authentication utilities"""
    try:
        from app.auth.utils import authenticate_user, create_auth_token
        print("🔐 Testing authentication...")
        
        # Get credentials from settings
        from app.config import settings
        
        # Test correct credentials
        if authenticate_user(settings.auth_username, settings.auth_password):
            print("✅ Authentication with correct credentials: SUCCESS")
        else:
            print("❌ Authentication with correct credentials: FAILED")
            return False
        
        # Test incorrect credentials
        if not authenticate_user(settings.auth_username, "wrong_password"):
            print("✅ Authentication with wrong credentials: CORRECTLY REJECTED")
        else:
            print("❌ Authentication with wrong credentials: INCORRECTLY ACCEPTED")
            return False
        
        # Test token creation
        token = create_auth_token("admin")
        if token:
            print(f"✅ JWT token creation: SUCCESS")
            print(f"   Token preview: {token[:50]}...")
        else:
            print("❌ JWT token creation: FAILED")
            return False
        
        return True
    except Exception as e:
        print(f"❌ Authentication test failed: {str(e)}")
        return False

def test_config():
    """Test configuration loading"""
    try:
        from app.config import settings
        print("⚙️  Testing configuration...")
        print(f"   App Name: {settings.app_name}")
        print(f"   Version: {settings.version}")
        print(f"   Database URL: {settings.database_url}")
        print(f"   Auth Username: {settings.auth_username}")
        print("✅ Configuration loading: SUCCESS")
        return True
    except Exception as e:
        print(f"❌ Configuration test failed: {str(e)}")
        return False

def test_api_server(base_url="http://localhost:8000"):
    """Test API server (requires server to be running)"""
    try:
        print("🌐 Testing API server...")
        
        # Test health endpoint
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Health endpoint: SUCCESS")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
            return False
        
        # Test login endpoint
        from app.config import settings
        login_data = {
            "username": settings.auth_username, 
            "password": settings.auth_password
        }
        response = requests.post(f"{base_url}/auth/login", json=login_data, timeout=5)
        if response.status_code == 200:
            token_data = response.json()
            print("✅ Login endpoint: SUCCESS")
            print(f"   Token type: {token_data.get('token_type')}")
            
            # Test protected endpoint
            headers = {"Authorization": f"Bearer {token_data['access_token']}"}
            response = requests.get(f"{base_url}/api/protected", headers=headers, timeout=5)
            if response.status_code == 200:
                print("✅ Protected endpoint: SUCCESS")
                print(f"   Response: {response.json()}")
            else:
                print(f"❌ Protected endpoint failed: {response.status_code}")
                return False
        else:
            print(f"❌ Login endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        return True
    except requests.exceptions.ConnectionError:
        print("⚠️  API server not running (start with: uvicorn app.main:app --reload)")
        return False
    except Exception as e:
        print(f"❌ API server test failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("="*80)
    print("🧪 TELKOM CONTRACT EXTRACTOR - SETUP VERIFICATION")
    print("="*80)
    
    tests = [
        ("Configuration", test_config),
        ("Authentication", test_authentication),
        ("Database Connection", test_database_connection),
        ("API Server", test_api_server),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n📋 {test_name} Test:")
        print("-" * 40)
        result = test_func()
        results.append((test_name, result))
        print()
    
    # Summary
    print("="*80)
    print("📊 TEST SUMMARY")
    print("="*80)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:20} {status}")
        if result:
            passed += 1
    
    print(f"\nTests passed: {passed}/{len(tests)}")
    
    if passed == len(tests):
        print("\n🎉 All tests passed! Your setup is ready for development.")
    else:
        print(f"\n⚠️  {len(tests) - passed} test(s) failed. Please check the errors above.")
        
        if not results[2][1]:  # Database test failed
            print("\n💡 To fix database issues:")
            print("   1. Start PostgreSQL: docker-compose up postgres -d")
            print("   2. Wait a few seconds for database to initialize")
            print("   3. Run this test again")
        
        if not results[3][1]:  # API server test failed
            print("\n💡 To test the API server:")
            print("   1. Start the server: uvicorn app.main:app --reload")
            print("   2. Run this test again")

if __name__ == "__main__":
    main()