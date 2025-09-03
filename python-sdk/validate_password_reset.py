#!/usr/bin/env python3
"""
Validation script for password reset implementation

This script validates that the password reset implementation
can be imported and basic functionality works correctly.
"""

import sys
from pathlib import Path

# Add examples directory to path
sys.path.append(str(Path(__file__).parent / "examples"))

def validate_imports():
    """Validate that all classes can be imported"""
    print("🔍 Validating imports...")
    
    try:
        from password_reset_implementation import (
            PasswordResetTokenManager,
            PasswordHasher,
            EmailTemplateManager,
            UserDatabase,
            PasswordResetService,
            InvalidTokenError,
            UserNotFoundError,
            PasswordResetError,
            FlaskIntegration,
            FastAPIIntegration
        )
        print("✅ All imports successful")
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

def validate_token_manager():
    """Validate token manager functionality"""
    print("\n🔐 Validating token manager...")
    
    try:
        from password_reset_implementation import PasswordResetTokenManager, InvalidTokenError
        
        # Create token manager
        manager = PasswordResetTokenManager("test-secret")
        
        # Generate token
        token = manager.generate_token("123")
        print(f"✅ Token generated: {token[:20]}...")
        
        # Validate token
        user_id = manager.validate_token(token)
        print(f"✅ Token validated: user_id={user_id}")
        
        # Test invalid token
        try:
            manager.validate_token("invalid-token")
            print("❌ Invalid token should have failed")
            return False
        except InvalidTokenError:
            print("✅ Invalid token correctly rejected")
        
        return True
        
    except Exception as e:
        print(f"❌ Token manager error: {e}")
        return False

def validate_password_hasher():
    """Validate password hasher functionality"""
    print("\n🔒 Validating password hasher...")
    
    try:
        from password_reset_implementation import PasswordHasher
        
        # Create hasher
        hasher = PasswordHasher(iterations=1000, salt_length=16)  # Lower values for faster testing
        
        # Hash password
        password = "test123"
        password_hash = hasher.hash_password(password)
        print(f"✅ Password hashed: {password_hash[:20]}...")
        
        # Verify correct password
        if hasher.verify_password(password, password_hash):
            print("✅ Correct password verified")
        else:
            print("❌ Correct password verification failed")
            return False
        
        # Verify incorrect password
        if not hasher.verify_password("wrong", password_hash):
            print("✅ Incorrect password correctly rejected")
        else:
            print("❌ Incorrect password should have been rejected")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Password hasher error: {e}")
        return False

def validate_email_manager():
    """Validate email template manager"""
    print("\n📧 Validating email template manager...")
    
    try:
        from password_reset_implementation import EmailTemplateManager
        import tempfile
        import shutil
        
        # Create temporary directory
        temp_dir = Path(tempfile.mkdtemp())
        
        try:
            # Create email manager
            manager = EmailTemplateManager(temp_dir)
            
            # Check templates created
            html_template = temp_dir / "password_reset.html"
            text_template = temp_dir / "password_reset.txt"
            
            if html_template.exists() and text_template.exists():
                print("✅ Default templates created")
            else:
                print("❌ Default templates not created")
                return False
            
            # Test template rendering
            variables = {
                'user_name': 'Test User',
                'reset_url': 'https://example.com/reset?token=abc123',
                'expiry_minutes': 60
            }
            
            html_content, text_content = manager.render_template('password_reset', variables)
            
            if 'Test User' in html_content and 'Test User' in text_content:
                print("✅ Template rendering successful")
            else:
                print("❌ Template rendering failed")
                return False
            
            return True
            
        finally:
            # Clean up temp directory
            shutil.rmtree(temp_dir)
        
    except Exception as e:
        print(f"❌ Email manager error: {e}")
        return False

def validate_database():
    """Validate user database functionality"""
    print("\n🗄️ Validating user database...")
    
    try:
        from password_reset_implementation import UserDatabase, PasswordHasher
        import tempfile
        import os
        
        # Create temporary database
        db_path = tempfile.mktemp(suffix='.db')
        
        try:
            # Create database
            db = UserDatabase(db_path)
            hasher = PasswordHasher(iterations=1000)
            
            # Add test user
            import sqlite3
            password_hash = hasher.hash_password("test123")
            conn = sqlite3.connect(db_path)
            conn.execute("""
                INSERT INTO users (email, password_hash, name) 
                VALUES (?, ?, ?)
            """, ('test@example.com', password_hash, 'Test User'))
            conn.commit()
            conn.close()
            
            # Find user
            user = db.find_user_by_email('test@example.com')
            if user and user['name'] == 'Test User':
                print("✅ User lookup successful")
            else:
                print("❌ User lookup failed")
                return False
            
            # Update password
            new_hash = hasher.hash_password("newtest123")
            db.update_password(user['id'], new_hash)
            
            # Verify update
            updated_user = db.find_user_by_email('test@example.com')
            if updated_user['password_hash'] == new_hash:
                print("✅ Password update successful")
            else:
                print("❌ Password update failed")
                return False
            
            return True
            
        finally:
            # Clean up database
            if os.path.exists(db_path):
                os.unlink(db_path)
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False

def validate_service():
    """Validate password reset service"""
    print("\n🔧 Validating password reset service...")
    
    try:
        from password_reset_implementation import PasswordResetService
        import tempfile
        import os
        
        # Create service
        service = PasswordResetService(
            secret_key="test-secret-key",
            base_url="https://example.com"
        )
        
        # Override database path for testing
        db_path = tempfile.mktemp(suffix='.db')
        from password_reset_implementation import UserDatabase
        service.database = UserDatabase(db_path)
        
        try:
            # Service should be initialized
            if service.token_manager and service.password_hasher and service.email_manager:
                print("✅ Service initialization successful")
            else:
                print("❌ Service initialization failed")
                return False
            
            print("✅ Service validation complete")
            return True
            
        finally:
            # Clean up database
            if os.path.exists(db_path):
                os.unlink(db_path)
        
    except Exception as e:
        print(f"❌ Service error: {e}")
        return False

def main():
    """Run all validations"""
    print("🧪 Password Reset Implementation Validation")
    print("=" * 50)
    
    validations = [
        ("Imports", validate_imports),
        ("Token Manager", validate_token_manager),
        ("Password Hasher", validate_password_hasher),
        ("Email Manager", validate_email_manager),
        ("Database", validate_database),
        ("Service", validate_service)
    ]
    
    results = []
    
    for name, validation_func in validations:
        try:
            result = validation_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name} validation failed with exception: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Validation Summary:")
    
    passed = 0
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} validations passed")
    
    if passed == total:
        print("🎉 All validations successful! Implementation is ready to use.")
        return True
    else:
        print("⚠️ Some validations failed. Please check the implementation.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)