#!/usr/bin/env python3
"""
Password Reset Implementation using Claude Code SDK

This example demonstrates how to implement a complete password reset system
using the Claude Code SDK for AI-assisted development and validation.

Features:
- Secure token generation and validation
- Email template system
- Password hashing utilities
- Database integration patterns
- Web framework integration examples
- Comprehensive security validation
"""

import asyncio
import hashlib
import hmac
import json
import secrets
import sqlite3
import smtplib
import time
from datetime import datetime, timedelta
from email.mime.text import MimeText, MimeMultipart
from pathlib import Path
from typing import Dict, Optional, Tuple, Any
from urllib.parse import urlencode
import sys
import os

# Add parent directory to path for SDK imports
sys.path.append(str(Path(__file__).parent.parent))

try:
    from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions
except ImportError:
    print("Warning: Claude CLI wrapper not available. Using mock implementation.")
    ClaudeCliWrapper = None
    ClaudeCliOptions = None


class PasswordResetError(Exception):
    """Base exception for password reset operations"""
    pass


class InvalidTokenError(PasswordResetError):
    """Raised when password reset token is invalid or expired"""
    pass


class UserNotFoundError(PasswordResetError):
    """Raised when user is not found"""
    pass


class PasswordResetTokenManager:
    """
    Secure token manager for password reset operations
    
    Uses cryptographically secure tokens with HMAC validation
    and configurable expiration times.
    """
    
    def __init__(self, secret_key: str, token_expiry_minutes: int = 60):
        self.secret_key = secret_key.encode()
        self.token_expiry_minutes = token_expiry_minutes
    
    def generate_token(self, user_id: str) -> str:
        """
        Generate a secure password reset token
        
        Token format: base64(user_id:timestamp:hmac_signature)
        """
        timestamp = int(time.time())
        payload = f"{user_id}:{timestamp}"
        
        # Create HMAC signature
        signature = hmac.new(
            self.secret_key,
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Combine payload and signature
        token_data = f"{payload}:{signature}"
        
        # Base64 encode for URL safety
        import base64
        return base64.urlsafe_b64encode(token_data.encode()).decode()
    
    def validate_token(self, token: str) -> str:
        """
        Validate password reset token and return user_id
        
        Returns:
            str: User ID if token is valid
            
        Raises:
            InvalidTokenError: If token is invalid or expired
        """
        try:
            import base64
            # Decode token
            token_data = base64.urlsafe_b64decode(token.encode()).decode()
            user_id, timestamp_str, signature = token_data.split(':')
            timestamp = int(timestamp_str)
            
            # Verify signature
            payload = f"{user_id}:{timestamp}"
            expected_signature = hmac.new(
                self.secret_key,
                payload.encode(),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                raise InvalidTokenError("Token signature invalid")
            
            # Check expiration
            expiry_time = timestamp + (self.token_expiry_minutes * 60)
            if time.time() > expiry_time:
                raise InvalidTokenError("Token has expired")
            
            return user_id
            
        except (ValueError, KeyError) as e:
            raise InvalidTokenError(f"Invalid token format: {e}")


class PasswordHasher:
    """
    Secure password hashing utilities using PBKDF2
    
    Provides secure password hashing and verification with
    configurable iterations and salt length.
    """
    
    def __init__(self, iterations: int = 100000, salt_length: int = 32):
        self.iterations = iterations
        self.salt_length = salt_length
    
    def hash_password(self, password: str) -> str:
        """
        Hash password with salt using PBKDF2
        
        Returns:
            str: Base64 encoded salt:hash combination
        """
        # Generate random salt
        salt = secrets.token_bytes(self.salt_length)
        
        # Hash password with salt
        password_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode(),
            salt,
            self.iterations
        )
        
        # Combine salt and hash for storage
        import base64
        combined = salt + password_hash
        return base64.b64encode(combined).decode()
    
    def verify_password(self, password: str, stored_hash: str) -> bool:
        """
        Verify password against stored hash
        
        Args:
            password: Plain text password to verify
            stored_hash: Previously hashed password
            
        Returns:
            bool: True if password matches
        """
        try:
            import base64
            # Decode stored hash
            combined = base64.b64decode(stored_hash.encode())
            salt = combined[:self.salt_length]
            stored_password_hash = combined[self.salt_length:]
            
            # Hash provided password with same salt
            password_hash = hashlib.pbkdf2_hmac(
                'sha256',
                password.encode(),
                salt,
                self.iterations
            )
            
            # Compare hashes
            return hmac.compare_digest(password_hash, stored_password_hash)
            
        except Exception:
            return False


class EmailTemplateManager:
    """
    Email template manager for password reset notifications
    
    Supports multiple templates with variable substitution
    and HTML/text versions.
    """
    
    def __init__(self, templates_dir: Optional[Path] = None):
        self.templates_dir = templates_dir or Path(__file__).parent / "email_templates"
        self.templates_dir.mkdir(exist_ok=True)
        self._create_default_templates()
    
    def _create_default_templates(self):
        """Create default email templates"""
        # HTML template
        html_template = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Password Reset</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
        .header { text-align: center; margin-bottom: 30px; }
        .button { display: inline-block; padding: 12px 24px; background: #007cba; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Reset Request</h1>
        </div>
        <p>Hello {user_name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center;">
            <a href="{reset_url}" class="button">Reset Password</a>
        </div>
        <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
        <p>This link will expire in {expiry_minutes} minutes for security purposes.</p>
        <div class="footer">
            <p>If you're having trouble clicking the button, copy and paste this URL into your browser:</p>
            <p>{reset_url}</p>
        </div>
    </div>
</body>
</html>
        """
        
        # Text template
        text_template = """
Password Reset Request

Hello {user_name},

We received a request to reset your password. Click the link below to create a new password:

{reset_url}

If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

This link will expire in {expiry_minutes} minutes for security purposes.

If you're having trouble with the link, copy and paste this URL into your browser:
{reset_url}
        """
        
        # Write templates to files
        (self.templates_dir / "password_reset.html").write_text(html_template.strip())
        (self.templates_dir / "password_reset.txt").write_text(text_template.strip())
    
    def render_template(self, template_name: str, variables: Dict[str, Any]) -> Tuple[str, str]:
        """
        Render email template with variables
        
        Returns:
            Tuple[str, str]: (html_content, text_content)
        """
        html_path = self.templates_dir / f"{template_name}.html"
        text_path = self.templates_dir / f"{template_name}.txt"
        
        html_content = ""
        text_content = ""
        
        if html_path.exists():
            html_content = html_path.read_text().format(**variables)
        
        if text_path.exists():
            text_content = text_path.read_text().format(**variables)
        
        return html_content, text_content


class UserDatabase:
    """
    Simple SQLite-based user database for demonstration
    
    In production, replace with your actual database system
    (PostgreSQL, MySQL, MongoDB, etc.)
    """
    
    def __init__(self, db_path: str = "users.db"):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """Initialize database tables"""
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                used_at TIMESTAMP NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        conn.commit()
        conn.close()
    
    def find_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Find user by email address"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        )
        user = cursor.fetchone()
        conn.close()
        
        return dict(user) if user else None
    
    def update_password(self, user_id: int, password_hash: str):
        """Update user password"""
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (password_hash, user_id)
        )
        conn.commit()
        conn.close()
    
    def log_token_usage(self, user_id: int, token_hash: str):
        """Log password reset token usage"""
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "INSERT INTO password_reset_tokens (user_id, token_hash) VALUES (?, ?)",
            (user_id, token_hash)
        )
        conn.commit()
        conn.close()
    
    def mark_token_used(self, token_hash: str):
        """Mark token as used"""
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token_hash = ?",
            (token_hash,)
        )
        conn.commit()
        conn.close()


class PasswordResetService:
    """
    Complete password reset service
    
    Orchestrates all components for secure password reset functionality
    """
    
    def __init__(
        self,
        secret_key: str,
        base_url: str,
        smtp_config: Optional[Dict[str, Any]] = None,
        claude_wrapper: Optional[ClaudeCliWrapper] = None
    ):
        self.token_manager = PasswordResetTokenManager(secret_key)
        self.password_hasher = PasswordHasher()
        self.email_manager = EmailTemplateManager()
        self.database = UserDatabase()
        self.base_url = base_url.rstrip('/')
        self.smtp_config = smtp_config or {}
        self.claude_wrapper = claude_wrapper
    
    async def request_password_reset(self, email: str) -> Dict[str, Any]:
        """
        Process password reset request
        
        Args:
            email: User email address
            
        Returns:
            Dict with status and message
        """
        # Find user
        user = self.database.find_user_by_email(email)
        if not user:
            # Don't reveal if user exists - security best practice
            return {
                "success": True,
                "message": "If an account with this email exists, a password reset link has been sent."
            }
        
        # Generate reset token
        token = self.token_manager.generate_token(str(user['id']))
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # Log token generation
        self.database.log_token_usage(user['id'], token_hash)
        
        # Create reset URL
        reset_url = f"{self.base_url}/reset-password?token={token}"
        
        # Render email template
        template_vars = {
            'user_name': user['name'],
            'reset_url': reset_url,
            'expiry_minutes': self.token_manager.token_expiry_minutes
        }
        html_content, text_content = self.email_manager.render_template(
            'password_reset', template_vars
        )
        
        # Send email (if SMTP configured)
        if self.smtp_config:
            await self._send_reset_email(email, html_content, text_content)
        
        # Use Claude for security validation if available
        if self.claude_wrapper:
            await self._validate_with_claude(email, token, reset_url)
        
        return {
            "success": True,
            "message": "If an account with this email exists, a password reset link has been sent.",
            "debug_info": {
                "token": token,
                "reset_url": reset_url
            } if os.getenv('DEBUG') else {}
        }
    
    async def reset_password(self, token: str, new_password: str) -> Dict[str, Any]:
        """
        Reset user password with token
        
        Args:
            token: Password reset token
            new_password: New password
            
        Returns:
            Dict with status and message
        """
        try:
            # Validate token
            user_id = self.token_manager.validate_token(token)
            
            # Validate password strength with Claude if available
            if self.claude_wrapper:
                password_analysis = await self._analyze_password_with_claude(new_password)
                if not password_analysis.get('is_strong', True):
                    return {
                        "success": False,
                        "message": f"Password is not strong enough: {password_analysis.get('feedback', 'Please choose a stronger password')}"
                    }
            
            # Hash new password
            password_hash = self.password_hasher.hash_password(new_password)
            
            # Update password in database
            self.database.update_password(int(user_id), password_hash)
            
            # Mark token as used
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            self.database.mark_token_used(token_hash)
            
            return {
                "success": True,
                "message": "Password has been reset successfully"
            }
            
        except InvalidTokenError as e:
            return {
                "success": False,
                "message": str(e)
            }
        except Exception as e:
            return {
                "success": False,
                "message": "An error occurred while resetting password"
            }
    
    async def _send_reset_email(self, email: str, html_content: str, text_content: str):
        """Send password reset email"""
        if not self.smtp_config:
            return
        
        try:
            msg = MimeMultipart('alternative')
            msg['Subject'] = 'Password Reset Request'
            msg['From'] = self.smtp_config.get('from_email')
            msg['To'] = email
            
            # Add text and HTML parts
            text_part = MimeText(text_content, 'plain')
            html_part = MimeText(html_content, 'html')
            
            msg.attach(text_part)
            msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(self.smtp_config['smtp_server'], self.smtp_config['smtp_port']) as server:
                if self.smtp_config.get('use_tls'):
                    server.starttls()
                
                if self.smtp_config.get('username'):
                    server.login(self.smtp_config['username'], self.smtp_config['password'])
                
                server.send_message(msg)
        
        except Exception as e:
            print(f"Failed to send email: {e}")
    
    async def _validate_with_claude(self, email: str, token: str, reset_url: str):
        """Use Claude to validate security aspects"""
        if not self.claude_wrapper:
            return
        
        validation_prompt = f"""
        Please analyze this password reset implementation for security vulnerabilities:
        
        Email: {email}
        Token length: {len(token)}
        Reset URL: {reset_url}
        
        Check for:
        1. Token entropy and security
        2. URL structure safety
        3. Potential timing attacks
        4. Information disclosure issues
        
        Provide a brief security assessment.
        """
        
        try:
            async for message in self.claude_wrapper.execute(validation_prompt):
                if hasattr(message, 'type') and message.type == 'result':
                    print(f"Claude Security Assessment: {message.content}")
        except Exception as e:
            print(f"Claude validation error: {e}")
    
    async def _analyze_password_with_claude(self, password: str) -> Dict[str, Any]:
        """Analyze password strength with Claude"""
        if not self.claude_wrapper:
            return {"is_strong": True}
        
        analysis_prompt = f"""
        Analyze this password for strength (don't log the actual password):
        - Length: {len(password)}
        - Has uppercase: {'Yes' if any(c.isupper() for c in password) else 'No'}
        - Has lowercase: {'Yes' if any(c.islower() for c in password) else 'No'}
        - Has numbers: {'Yes' if any(c.isdigit() for c in password) else 'No'}
        - Has special chars: {'Yes' if any(not c.isalnum() for c in password) else 'No'}
        
        Return JSON with:
        {{"is_strong": true/false, "feedback": "specific feedback"}}
        """
        
        try:
            async for message in self.claude_wrapper.execute(analysis_prompt):
                if hasattr(message, 'type') and message.type == 'result':
                    try:
                        return json.loads(message.content)
                    except json.JSONDecodeError:
                        return {"is_strong": True}
        except Exception:
            pass
        
        return {"is_strong": True}


# Web Framework Integration Examples

class FlaskIntegration:
    """Flask web framework integration example"""
    
    @staticmethod
    def create_routes(app, password_reset_service: PasswordResetService):
        """Add password reset routes to Flask app"""
        
        @app.route('/request-password-reset', methods=['POST'])
        async def request_reset():
            try:
                from flask import request, jsonify
                data = request.get_json()
                email = data.get('email')
                
                if not email:
                    return jsonify({'error': 'Email is required'}), 400
                
                result = await password_reset_service.request_password_reset(email)
                return jsonify(result)
            
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        
        @app.route('/reset-password', methods=['POST'])
        async def reset_password():
            try:
                from flask import request, jsonify
                data = request.get_json()
                token = data.get('token')
                new_password = data.get('new_password')
                
                if not token or not new_password:
                    return jsonify({'error': 'Token and new password are required'}), 400
                
                result = await password_reset_service.reset_password(token, new_password)
                return jsonify(result)
            
            except Exception as e:
                return jsonify({'error': str(e)}), 500


class FastAPIIntegration:
    """FastAPI web framework integration example"""
    
    @staticmethod
    def create_routes(app, password_reset_service: PasswordResetService):
        """Add password reset routes to FastAPI app"""
        
        from pydantic import BaseModel
        
        class PasswordResetRequest(BaseModel):
            email: str
        
        class PasswordResetConfirm(BaseModel):
            token: str
            new_password: str
        
        @app.post('/request-password-reset')
        async def request_reset(request: PasswordResetRequest):
            result = await password_reset_service.request_password_reset(request.email)
            return result
        
        @app.post('/reset-password')
        async def reset_password(request: PasswordResetConfirm):
            result = await password_reset_service.reset_password(request.token, request.new_password)
            return result


# Demo and Testing Functions

async def demo_password_reset():
    """Demonstrate password reset functionality"""
    
    print("🔐 Password Reset Implementation Demo")
    print("=" * 50)
    
    # Initialize service
    service = PasswordResetService(
        secret_key="your-secret-key-here",
        base_url="https://your-app.com"
    )
    
    # Create test user (in production, this would be done via registration)
    conn = sqlite3.connect("users.db")
    hasher = PasswordHasher()
    test_password_hash = hasher.hash_password("test123")
    
    conn.execute("""
        INSERT OR REPLACE INTO users (id, email, password_hash, name) 
        VALUES (1, 'test@example.com', ?, 'Test User')
    """, (test_password_hash,))
    conn.commit()
    conn.close()
    
    # Demo 1: Request password reset
    print("\n1. Requesting password reset...")
    reset_result = await service.request_password_reset("test@example.com")
    print(f"Result: {reset_result}")
    
    # Extract token from debug info (in production, user gets this via email)
    token = reset_result.get('debug_info', {}).get('token')
    
    if token:
        print(f"\n2. Generated token: {token[:20]}...")
        
        # Demo 3: Reset password
        print("\n3. Resetting password with token...")
        new_password = "NewSecurePassword123!"
        password_result = await service.reset_password(token, new_password)
        print(f"Result: {password_result}")
        
        # Demo 4: Verify new password works
        print("\n4. Verifying new password...")
        user = service.database.find_user_by_email("test@example.com")
        password_valid = service.password_hasher.verify_password(new_password, user['password_hash'])
        print(f"Password verification: {'✅ Success' if password_valid else '❌ Failed'}")
    
    print("\n✨ Demo completed!")


async def demo_with_claude():
    """Demonstrate password reset with Claude integration"""
    
    if not ClaudeCliWrapper:
        print("Claude CLI wrapper not available for enhanced demo")
        await demo_password_reset()
        return
    
    print("🤖 Password Reset with Claude AI Integration")
    print("=" * 50)
    
    # Initialize Claude wrapper
    options = ClaudeCliOptions(
        model="sonnet",
        timeout=60,
        verbose=True
    )
    
    async with ClaudeCliWrapper(options) as claude_wrapper:
        # Initialize service with Claude
        service = PasswordResetService(
            secret_key="your-secret-key-here",
            base_url="https://your-app.com",
            claude_wrapper=claude_wrapper
        )
        
        # Demo with Claude security analysis
        print("\n🔍 Requesting password reset with Claude security analysis...")
        result = await service.request_password_reset("test@example.com")
        print(f"Result: {result}")


if __name__ == "__main__":
    print("Password Reset Implementation Example")
    print("Choose demo mode:")
    print("1. Basic demo (no Claude)")
    print("2. Enhanced demo with Claude AI")
    
    try:
        choice = input("Enter choice (1 or 2): ").strip()
        
        if choice == "2":
            asyncio.run(demo_with_claude())
        else:
            asyncio.run(demo_password_reset())
    
    except KeyboardInterrupt:
        print("\n\nDemo interrupted by user")
    except Exception as e:
        print(f"\n\nDemo error: {e}")