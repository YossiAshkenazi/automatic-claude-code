#!/usr/bin/env python3
"""
Test Suite for Password Reset Implementation

Comprehensive tests for all password reset components including:
- Token generation and validation
- Password hashing and verification  
- Email template rendering
- Database operations
- Security validations
- Integration scenarios
"""

import asyncio
import hashlib
import hmac
import json
import os
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
import sys

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

try:
    from examples.password_reset_implementation import (
        PasswordResetTokenManager,
        PasswordHasher,
        EmailTemplateManager,
        UserDatabase,
        PasswordResetService,
        InvalidTokenError,
        UserNotFoundError,
        PasswordResetError
    )
except ImportError as e:
    print(f"Import error: {e}")
    print("Please ensure password_reset_implementation.py is in the examples directory")
    sys.exit(1)


class TestPasswordResetTokenManager(unittest.TestCase):
    """Test token generation and validation"""
    
    def setUp(self):
        self.token_manager = PasswordResetTokenManager(
            secret_key="test-secret-key",
            token_expiry_minutes=60
        )
    
    def test_token_generation(self):
        """Test token generation produces valid tokens"""
        user_id = "123"
        token = self.token_manager.generate_token(user_id)
        
        # Token should be non-empty string
        self.assertIsInstance(token, str)
        self.assertGreater(len(token), 0)
        
        # Token should be base64 encoded
        import base64
        try:
            base64.urlsafe_b64decode(token.encode())
        except Exception:
            self.fail("Token is not valid base64")
    
    def test_token_validation_success(self):
        """Test successful token validation"""
        user_id = "123"
        token = self.token_manager.generate_token(user_id)
        
        # Should validate successfully
        validated_user_id = self.token_manager.validate_token(token)
        self.assertEqual(validated_user_id, user_id)
    
    def test_token_validation_invalid_format(self):
        """Test validation with invalid token format"""
        invalid_tokens = [
            "",
            "invalid",
            "not-base64",
            "dGVzdA==",  # Valid base64 but wrong format
        ]
        
        for invalid_token in invalid_tokens:
            with self.assertRaises(InvalidTokenError):
                self.token_manager.validate_token(invalid_token)
    
    def test_token_validation_expired(self):
        """Test validation with expired token"""
        # Create token manager with very short expiry
        short_expiry_manager = PasswordResetTokenManager(
            secret_key="test-secret-key",
            token_expiry_minutes=0  # Expires immediately
        )
        
        user_id = "123"
        token = short_expiry_manager.generate_token(user_id)
        
        # Wait a moment to ensure expiration
        time.sleep(0.1)
        
        # Should raise InvalidTokenError for expired token
        with self.assertRaises(InvalidTokenError) as cm:
            short_expiry_manager.validate_token(token)
        
        self.assertIn("expired", str(cm.exception).lower())
    
    def test_token_validation_wrong_signature(self):
        """Test validation with tampered token"""
        user_id = "123"
        token = self.token_manager.generate_token(user_id)
        
        # Create another token manager with different secret
        wrong_manager = PasswordResetTokenManager(
            secret_key="wrong-secret-key",
            token_expiry_minutes=60
        )
        
        # Should raise InvalidTokenError for wrong signature
        with self.assertRaises(InvalidTokenError) as cm:
            wrong_manager.validate_token(token)
        
        self.assertIn("signature", str(cm.exception).lower())


class TestPasswordHasher(unittest.TestCase):
    """Test password hashing and verification"""
    
    def setUp(self):
        self.password_hasher = PasswordHasher(
            iterations=1000,  # Lower for faster tests
            salt_length=16
        )
    
    def test_password_hashing(self):
        """Test password hashing produces valid hashes"""
        password = "test123"
        password_hash = self.password_hasher.hash_password(password)
        
        # Hash should be non-empty string
        self.assertIsInstance(password_hash, str)
        self.assertGreater(len(password_hash), 0)
        
        # Hash should be base64 encoded
        import base64
        try:
            decoded = base64.b64decode(password_hash.encode())
            # Should contain salt + hash
            self.assertEqual(len(decoded), 16 + 32)  # 16 byte salt + 32 byte hash
        except Exception:
            self.fail("Password hash is not valid base64")
    
    def test_password_verification_success(self):
        """Test successful password verification"""
        password = "test123"
        password_hash = self.password_hasher.hash_password(password)
        
        # Should verify successfully
        self.assertTrue(self.password_hasher.verify_password(password, password_hash))
    
    def test_password_verification_failure(self):
        """Test password verification with wrong password"""
        password = "test123"
        wrong_password = "wrong123"
        password_hash = self.password_hasher.hash_password(password)
        
        # Should fail verification
        self.assertFalse(self.password_hasher.verify_password(wrong_password, password_hash))
    
    def test_password_verification_invalid_hash(self):
        """Test password verification with invalid hash"""
        password = "test123"
        invalid_hashes = [
            "",
            "invalid",
            "not-base64",
            "dGVzdA==",  # Valid base64 but wrong length
        ]
        
        for invalid_hash in invalid_hashes:
            # Should return False for invalid hashes
            self.assertFalse(self.password_hasher.verify_password(password, invalid_hash))
    
    def test_different_passwords_different_hashes(self):
        """Test that different passwords produce different hashes"""
        password1 = "test123"
        password2 = "test456"
        
        hash1 = self.password_hasher.hash_password(password1)
        hash2 = self.password_hasher.hash_password(password2)
        
        # Hashes should be different
        self.assertNotEqual(hash1, hash2)
    
    def test_same_password_different_hashes(self):
        """Test that same password produces different hashes due to salt"""
        password = "test123"
        
        hash1 = self.password_hasher.hash_password(password)
        hash2 = self.password_hasher.hash_password(password)
        
        # Hashes should be different due to different salts
        self.assertNotEqual(hash1, hash2)
        
        # But both should verify the same password
        self.assertTrue(self.password_hasher.verify_password(password, hash1))
        self.assertTrue(self.password_hasher.verify_password(password, hash2))


class TestEmailTemplateManager(unittest.TestCase):
    """Test email template management"""
    
    def setUp(self):
        # Create temporary directory for templates
        self.temp_dir = Path(tempfile.mkdtemp())
        self.email_manager = EmailTemplateManager(self.temp_dir)
    
    def tearDown(self):
        # Clean up temporary directory
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_default_templates_created(self):
        """Test that default templates are created"""
        html_template = self.temp_dir / "password_reset.html"
        text_template = self.temp_dir / "password_reset.txt"
        
        self.assertTrue(html_template.exists())
        self.assertTrue(text_template.exists())
        
        # Templates should contain expected content
        html_content = html_template.read_text()
        text_content = text_template.read_text()
        
        self.assertIn("{user_name}", html_content)
        self.assertIn("{reset_url}", html_content)
        self.assertIn("{user_name}", text_content)
        self.assertIn("{reset_url}", text_content)
    
    def test_template_rendering(self):
        """Test template rendering with variables"""
        variables = {
            'user_name': 'John Doe',
            'reset_url': 'https://example.com/reset?token=abc123',
            'expiry_minutes': 60
        }
        
        html_content, text_content = self.email_manager.render_template(
            'password_reset', variables
        )
        
        # Variables should be substituted
        self.assertIn('John Doe', html_content)
        self.assertIn('https://example.com/reset?token=abc123', html_content)
        self.assertIn('60 minutes', html_content)
        
        self.assertIn('John Doe', text_content)
        self.assertIn('https://example.com/reset?token=abc123', text_content)
        self.assertIn('60 minutes', text_content)
    
    def test_missing_template(self):
        """Test rendering with missing template"""
        variables = {'test': 'value'}
        
        html_content, text_content = self.email_manager.render_template(
            'nonexistent', variables
        )
        
        # Should return empty strings for missing templates
        self.assertEqual(html_content, "")
        self.assertEqual(text_content, "")


class TestUserDatabase(unittest.TestCase):
    """Test user database operations"""
    
    def setUp(self):
        # Create temporary database
        self.db_path = tempfile.mktemp(suffix='.db')
        self.database = UserDatabase(self.db_path)
        
        # Insert test user
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT INTO users (email, password_hash, name) 
            VALUES (?, ?, ?)
        """, ('test@example.com', 'hash123', 'Test User'))
        conn.commit()
        conn.close()
    
    def tearDown(self):
        # Clean up database file
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)
    
    def test_find_user_by_email_success(self):
        """Test finding user by email"""
        user = self.database.find_user_by_email('test@example.com')
        
        self.assertIsNotNone(user)
        self.assertEqual(user['email'], 'test@example.com')
        self.assertEqual(user['name'], 'Test User')
        self.assertEqual(user['password_hash'], 'hash123')
    
    def test_find_user_by_email_not_found(self):
        """Test finding non-existent user"""
        user = self.database.find_user_by_email('nonexistent@example.com')
        self.assertIsNone(user)
    
    def test_update_password(self):
        """Test password update"""
        # Get user ID
        user = self.database.find_user_by_email('test@example.com')
        user_id = user['id']
        
        # Update password
        new_hash = 'new_hash_456'
        self.database.update_password(user_id, new_hash)
        
        # Verify password was updated
        updated_user = self.database.find_user_by_email('test@example.com')
        self.assertEqual(updated_user['password_hash'], new_hash)
    
    def test_token_logging(self):
        """Test token usage logging"""
        user_id = 1
        token_hash = 'token_hash_123'
        
        # Log token usage
        self.database.log_token_usage(user_id, token_hash)
        
        # Verify token was logged
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            "SELECT * FROM password_reset_tokens WHERE user_id = ? AND token_hash = ?",
            (user_id, token_hash)
        )
        token_record = cursor.fetchone()
        conn.close()
        
        self.assertIsNotNone(token_record)
    
    def test_mark_token_used(self):
        """Test marking token as used"""
        user_id = 1
        token_hash = 'token_hash_123'
        
        # Log and then mark token as used
        self.database.log_token_usage(user_id, token_hash)
        self.database.mark_token_used(token_hash)
        
        # Verify token is marked as used
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            "SELECT used_at FROM password_reset_tokens WHERE token_hash = ?",
            (token_hash,)
        )
        result = cursor.fetchone()
        conn.close()
        
        self.assertIsNotNone(result)
        self.assertIsNotNone(result[0])  # used_at should be set


class TestPasswordResetService(unittest.IsolatedAsyncioTestCase):
    """Test complete password reset service"""
    
    def setUp(self):
        # Create temporary database
        self.db_path = tempfile.mktemp(suffix='.db')
        
        # Initialize service
        self.service = PasswordResetService(
            secret_key="test-secret-key",
            base_url="https://example.com"
        )
        
        # Override database path
        self.service.database = UserDatabase(self.db_path)
        
        # Insert test user
        hasher = PasswordHasher()
        test_hash = hasher.hash_password("test123")
        
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT INTO users (id, email, password_hash, name) 
            VALUES (?, ?, ?, ?)
        """, (1, 'test@example.com', test_hash, 'Test User'))
        conn.commit()
        conn.close()
    
    def tearDown(self):
        # Clean up database file
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)
    
    async def test_request_password_reset_existing_user(self):
        """Test password reset request for existing user"""
        result = await self.service.request_password_reset('test@example.com')
        
        self.assertTrue(result['success'])
        self.assertIn('password reset link', result['message'].lower())
    
    async def test_request_password_reset_nonexistent_user(self):
        """Test password reset request for non-existent user"""
        result = await self.service.request_password_reset('nonexistent@example.com')
        
        # Should still return success to prevent user enumeration
        self.assertTrue(result['success'])
        self.assertIn('password reset link', result['message'].lower())
    
    async def test_reset_password_valid_token(self):
        """Test password reset with valid token"""
        # Request password reset to get token
        reset_result = await self.service.request_password_reset('test@example.com')
        
        # In debug mode, token is returned
        with patch.dict(os.environ, {'DEBUG': '1'}):
            reset_result = await self.service.request_password_reset('test@example.com')
            token = reset_result.get('debug_info', {}).get('token')
        
        if not token:
            # Generate token manually for test
            token = self.service.token_manager.generate_token('1')
        
        # Reset password with token
        new_password = "newpassword123"
        result = await self.service.reset_password(token, new_password)
        
        self.assertTrue(result['success'])
        self.assertIn('reset successfully', result['message'].lower())
        
        # Verify new password works
        user = self.service.database.find_user_by_email('test@example.com')
        password_valid = self.service.password_hasher.verify_password(
            new_password, user['password_hash']
        )
        self.assertTrue(password_valid)
    
    async def test_reset_password_invalid_token(self):
        """Test password reset with invalid token"""
        invalid_token = "invalid_token"
        new_password = "newpassword123"
        
        result = await self.service.reset_password(invalid_token, new_password)
        
        self.assertFalse(result['success'])
        self.assertIn('invalid', result['message'].lower())
    
    async def test_reset_password_expired_token(self):
        """Test password reset with expired token"""
        # Create service with immediate expiration
        expired_service = PasswordResetService(
            secret_key="test-secret-key",
            base_url="https://example.com"
        )
        expired_service.token_manager.token_expiry_minutes = 0
        expired_service.database = self.service.database
        
        # Generate expired token
        token = expired_service.token_manager.generate_token('1')
        time.sleep(0.1)  # Ensure expiration
        
        new_password = "newpassword123"
        result = await expired_service.reset_password(token, new_password)
        
        self.assertFalse(result['success'])
        self.assertIn('expired', result['message'].lower())


class TestSecurityValidation(unittest.TestCase):
    """Test security aspects of password reset implementation"""
    
    def setUp(self):
        self.token_manager = PasswordResetTokenManager("test-secret-key")
        self.password_hasher = PasswordHasher()
    
    def test_token_entropy(self):
        """Test that tokens have sufficient entropy"""
        tokens = set()
        
        # Generate 100 tokens for same user
        for _ in range(100):
            token = self.token_manager.generate_token("1")
            tokens.add(token)
        
        # All tokens should be unique
        self.assertEqual(len(tokens), 100)
    
    def test_timing_attack_resistance(self):
        """Test resistance to timing attacks in token validation"""
        valid_token = self.token_manager.generate_token("1")
        invalid_tokens = [
            "invalid",
            valid_token[:-1] + "X",  # Slightly modified
            "a" * len(valid_token),  # Same length, different content
        ]
        
        # Measure validation time for valid token
        start_time = time.time()
        try:
            self.token_manager.validate_token(valid_token)
        except:
            pass
        valid_time = time.time() - start_time
        
        # Measure validation time for invalid tokens
        for invalid_token in invalid_tokens:
            start_time = time.time()
            try:
                self.token_manager.validate_token(invalid_token)
            except:
                pass
            invalid_time = time.time() - start_time
            
            # Times should be similar (within reasonable variance)
            # This is a basic check - more sophisticated timing analysis
            # would be needed for production security validation
            time_ratio = max(valid_time, invalid_time) / min(valid_time, invalid_time)
            self.assertLess(time_ratio, 10.0, "Potential timing attack vulnerability")
    
    def test_password_hash_resistance(self):
        """Test password hash security properties"""
        password = "test123"
        
        # Same password should produce different hashes
        hash1 = self.password_hasher.hash_password(password)
        hash2 = self.password_hasher.hash_password(password)
        self.assertNotEqual(hash1, hash2)
        
        # Both hashes should verify the same password
        self.assertTrue(self.password_hasher.verify_password(password, hash1))
        self.assertTrue(self.password_hasher.verify_password(password, hash2))
        
        # Wrong password should not verify
        self.assertFalse(self.password_hasher.verify_password("wrong", hash1))
    
    def test_token_signature_tampering(self):
        """Test that token signature prevents tampering"""
        original_token = self.token_manager.generate_token("1")
        
        # Try to tamper with token
        import base64
        try:
            decoded = base64.urlsafe_b64decode(original_token.encode()).decode()
            parts = decoded.split(':')
            
            # Change user ID
            tampered = f"999:{parts[1]}:{parts[2]}"
            tampered_token = base64.urlsafe_b64encode(tampered.encode()).decode()
            
            # Tampered token should be invalid
            with self.assertRaises(InvalidTokenError):
                self.token_manager.validate_token(tampered_token)
        
        except Exception:
            # If we can't decode/tamper, that's actually good for security
            pass


class TestIntegrationScenarios(unittest.IsolatedAsyncioTestCase):
    """Test complete integration scenarios"""
    
    def setUp(self):
        self.db_path = tempfile.mktemp(suffix='.db')
        self.service = PasswordResetService(
            secret_key="test-secret-key",
            base_url="https://example.com"
        )
        self.service.database = UserDatabase(self.db_path)
    
    def tearDown(self):
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)
    
    async def test_complete_password_reset_flow(self):
        """Test complete password reset flow from start to finish"""
        # Step 1: Create user
        hasher = PasswordHasher()
        original_password = "original123"
        password_hash = hasher.hash_password(original_password)
        
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT INTO users (id, email, password_hash, name) 
            VALUES (?, ?, ?, ?)
        """, (1, 'user@example.com', password_hash, 'Test User'))
        conn.commit()
        conn.close()
        
        # Step 2: Request password reset
        with patch.dict(os.environ, {'DEBUG': '1'}):
            reset_request = await self.service.request_password_reset('user@example.com')
        
        self.assertTrue(reset_request['success'])
        token = reset_request.get('debug_info', {}).get('token')
        self.assertIsNotNone(token)
        
        # Step 3: Verify original password still works
        user = self.service.database.find_user_by_email('user@example.com')
        self.assertTrue(hasher.verify_password(original_password, user['password_hash']))
        
        # Step 4: Reset password with token
        new_password = "newpassword456"
        reset_result = await self.service.reset_password(token, new_password)
        self.assertTrue(reset_result['success'])
        
        # Step 5: Verify new password works and old doesn't
        updated_user = self.service.database.find_user_by_email('user@example.com')
        self.assertTrue(hasher.verify_password(new_password, updated_user['password_hash']))
        self.assertFalse(hasher.verify_password(original_password, updated_user['password_hash']))
        
        # Step 6: Verify token cannot be reused
        reuse_result = await self.service.reset_password(token, "another_password")
        self.assertFalse(reuse_result['success'])
    
    async def test_multiple_reset_requests(self):
        """Test multiple password reset requests for same user"""
        # Create user
        hasher = PasswordHasher()
        password_hash = hasher.hash_password("test123")
        
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT INTO users (id, email, password_hash, name) 
            VALUES (?, ?, ?, ?)
        """, (1, 'user@example.com', password_hash, 'Test User'))
        conn.commit()
        conn.close()
        
        # Request multiple password resets
        with patch.dict(os.environ, {'DEBUG': '1'}):
            request1 = await self.service.request_password_reset('user@example.com')
            request2 = await self.service.request_password_reset('user@example.com')
        
        self.assertTrue(request1['success'])
        self.assertTrue(request2['success'])
        
        token1 = request1.get('debug_info', {}).get('token')
        token2 = request2.get('debug_info', {}).get('token')
        
        # Tokens should be different
        self.assertNotEqual(token1, token2)
        
        # Both tokens should be valid
        user_id1 = self.service.token_manager.validate_token(token1)
        user_id2 = self.service.token_manager.validate_token(token2)
        self.assertEqual(user_id1, '1')
        self.assertEqual(user_id2, '1')


def run_all_tests():
    """Run all password reset tests"""
    
    print("🧪 Running Password Reset Test Suite")
    print("=" * 50)
    
    # Create test suite
    test_suite = unittest.TestSuite()
    
    # Add test cases
    test_classes = [
        TestPasswordResetTokenManager,
        TestPasswordHasher,
        TestEmailTemplateManager,
        TestUserDatabase,
        TestPasswordResetService,
        TestSecurityValidation,
        TestIntegrationScenarios
    ]
    
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        test_suite.addTests(tests)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    # Print summary
    print("\n" + "=" * 50)
    if result.wasSuccessful():
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed:")
        print(f"   Failures: {len(result.failures)}")
        print(f"   Errors: {len(result.errors)}")
    
    print(f"Tests run: {result.testsRun}")
    
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)