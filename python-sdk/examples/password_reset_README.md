# Password Reset Implementation Guide

This guide demonstrates how to implement a secure password reset feature using the Claude Code Python SDK. The implementation includes AI-assisted security validation, comprehensive testing, and real-world integration examples.

## 🚀 Quick Start

### Basic Usage

```python
import asyncio
from password_reset_implementation import PasswordResetService

async def main():
    # Initialize service
    service = PasswordResetService(
        secret_key="your-secure-secret-key-here",
        base_url="https://your-app.com"
    )
    
    # Request password reset
    result = await service.request_password_reset("user@example.com")
    print(f"Reset requested: {result['success']}")
    
    # Reset password with token (normally from email)
    token = "token-from-email"
    new_password = "NewSecurePassword123!"
    
    reset_result = await service.reset_password(token, new_password)
    print(f"Password reset: {reset_result['success']}")

asyncio.run(main())
```

### With Claude AI Integration

```python
import asyncio
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions
from password_reset_implementation import PasswordResetService

async def main():
    # Initialize Claude wrapper for AI assistance
    options = ClaudeCliOptions(model="sonnet", verbose=True)
    
    async with ClaudeCliWrapper(options) as claude_wrapper:
        # Initialize service with AI validation
        service = PasswordResetService(
            secret_key="your-secret-key",
            base_url="https://your-app.com",
            claude_wrapper=claude_wrapper
        )
        
        # AI will analyze security aspects and password strength
        result = await service.request_password_reset("user@example.com")

asyncio.run(main())
```

## 🏗️ Architecture Overview

The password reset system consists of several secure components:

### Core Components

1. **PasswordResetTokenManager** - Secure token generation and validation
2. **PasswordHasher** - PBKDF2-based password hashing
3. **EmailTemplateManager** - HTML/text email templates
4. **UserDatabase** - User management and token tracking
5. **PasswordResetService** - Main orchestration service

### Security Features

- **HMAC-signed tokens** with configurable expiration
- **PBKDF2 password hashing** with random salts
- **Timing attack resistance** in token validation
- **No user enumeration** - same response for existing/non-existing users
- **Token reuse prevention** - tokens marked as used after successful reset
- **AI security validation** with Claude integration

## 🔐 Security Implementation

### Token Security

```python
# Tokens are HMAC-signed and time-limited
token_manager = PasswordResetTokenManager(
    secret_key="your-secret-key",
    token_expiry_minutes=60  # 1 hour expiration
)

# Generate secure token
token = token_manager.generate_token(user_id)

# Validate token (raises InvalidTokenError if invalid/expired)
user_id = token_manager.validate_token(token)
```

### Password Hashing

```python
# Secure password hashing with PBKDF2
hasher = PasswordHasher(
    iterations=100000,  # PBKDF2 iterations
    salt_length=32      # Salt length in bytes
)

# Hash password with random salt
password_hash = hasher.hash_password("user_password")

# Verify password
is_valid = hasher.verify_password("user_password", password_hash)
```

### Email Templates

```python
# Render password reset email
email_manager = EmailTemplateManager()

template_vars = {
    'user_name': 'John Doe',
    'reset_url': 'https://app.com/reset?token=abc123',
    'expiry_minutes': 60
}

html_content, text_content = email_manager.render_template(
    'password_reset', template_vars
)
```

## 🌐 Web Framework Integration

### Flask Integration

```python
from flask import Flask, request, jsonify
from password_reset_implementation import PasswordResetService, FlaskIntegration

app = Flask(__name__)

# Initialize password reset service
service = PasswordResetService(
    secret_key=app.config['SECRET_KEY'],
    base_url=app.config['BASE_URL'],
    smtp_config={
        'smtp_server': 'smtp.gmail.com',
        'smtp_port': 587,
        'use_tls': True,
        'username': 'your-email@gmail.com',
        'password': 'your-app-password',
        'from_email': 'noreply@yourapp.com'
    }
)

# Add password reset routes
FlaskIntegration.create_routes(app, service)

if __name__ == '__main__':
    app.run(debug=True)
```

### FastAPI Integration

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from password_reset_implementation import PasswordResetService, FastAPIIntegration

app = FastAPI()

# Initialize service
service = PasswordResetService(
    secret_key="your-secret-key",
    base_url="https://api.yourapp.com"
)

# Add password reset routes
FastAPIIntegration.create_routes(app, service)

# Custom route example
@app.post("/custom-reset")
async def custom_password_reset(email: str, new_password: str, token: str):
    # Custom validation logic
    if len(new_password) < 8:
        raise HTTPException(400, "Password too short")
    
    result = await service.reset_password(token, new_password)
    if not result['success']:
        raise HTTPException(400, result['message'])
    
    return {"message": "Password reset successfully"}
```

## 📧 Email Configuration

### SMTP Configuration

```python
smtp_config = {
    'smtp_server': 'smtp.gmail.com',
    'smtp_port': 587,
    'use_tls': True,
    'username': 'your-email@gmail.com',
    'password': 'your-app-password',  # Use app passwords for Gmail
    'from_email': 'noreply@yourapp.com'
}

service = PasswordResetService(
    secret_key="your-secret-key",
    base_url="https://yourapp.com",
    smtp_config=smtp_config
)
```

### Custom Email Templates

Create custom templates in the `email_templates` directory:

**password_reset.html:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Reset Your Password</title>
</head>
<body>
    <h1>Hello {user_name}!</h1>
    <p>Click <a href="{reset_url}">here</a> to reset your password.</p>
    <p>This link expires in {expiry_minutes} minutes.</p>
</body>
</html>
```

**password_reset.txt:**
```text
Hello {user_name}!

Reset your password: {reset_url}

This link expires in {expiry_minutes} minutes.
```

## 🗄️ Database Integration

### SQLite (Development)

```python
# Default SQLite setup (automatic)
database = UserDatabase("users.db")

# Create test user
hasher = PasswordHasher()
password_hash = hasher.hash_password("user123")

conn = sqlite3.connect("users.db")
conn.execute("""
    INSERT INTO users (email, password_hash, name) 
    VALUES (?, ?, ?)
""", ('user@example.com', password_hash, 'Test User'))
conn.commit()
conn.close()
```

### PostgreSQL (Production)

```python
import psycopg2

class PostgreSQLUserDatabase:
    def __init__(self, connection_string):
        self.conn_string = connection_string
    
    def find_user_by_email(self, email):
        conn = psycopg2.connect(self.conn_string)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email, password_hash, name FROM users WHERE email = %s",
            (email,)
        )
        user = cursor.fetchone()
        conn.close()
        
        if user:
            return {
                'id': user[0],
                'email': user[1], 
                'password_hash': user[2],
                'name': user[3]
            }
        return None
    
    def update_password(self, user_id, password_hash):
        conn = psycopg2.connect(self.conn_string)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (password_hash, user_id)
        )
        conn.commit()
        conn.close()

# Use with service
service = PasswordResetService(
    secret_key="your-secret-key",
    base_url="https://yourapp.com"
)
service.database = PostgreSQLUserDatabase("postgresql://user:pass@localhost/db")
```

### MongoDB Integration

```python
from pymongo import MongoClient
from bson import ObjectId

class MongoUserDatabase:
    def __init__(self, mongo_uri):
        self.client = MongoClient(mongo_uri)
        self.db = self.client.user_database
        self.users = self.db.users
        self.tokens = self.db.password_reset_tokens
    
    def find_user_by_email(self, email):
        user = self.users.find_one({'email': email})
        if user:
            user['id'] = str(user['_id'])
            return user
        return None
    
    def update_password(self, user_id, password_hash):
        self.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'password_hash': password_hash}}
        )

# Use with service
service.database = MongoUserDatabase("mongodb://localhost:27017")
```

## 🧪 Testing

### Run Test Suite

```bash
# Run all tests
cd python-sdk
python tests/test_password_reset.py

# Run specific test class
python -m unittest tests.test_password_reset.TestPasswordResetTokenManager

# Run with verbose output
python -m unittest tests.test_password_reset -v
```

### Test Categories

1. **Token Security Tests** - Validation, expiration, tampering resistance
2. **Password Hashing Tests** - PBKDF2 implementation, verification
3. **Email Template Tests** - Template rendering, variable substitution
4. **Database Tests** - User operations, token tracking
5. **Integration Tests** - Complete password reset flows
6. **Security Tests** - Timing attacks, entropy validation

### Example Test Output

```
🧪 Running Password Reset Test Suite
==================================================
test_token_generation (test_password_reset.TestPasswordResetTokenManager) ... ok
test_token_validation_success (test_password_reset.TestPasswordResetTokenManager) ... ok
test_password_hashing (test_password_reset.TestPasswordHasher) ... ok
test_password_verification_success (test_password_reset.TestPasswordHasher) ... ok
test_template_rendering (test_password_reset.TestEmailTemplateManager) ... ok
test_complete_password_reset_flow (test_password_reset.TestIntegrationScenarios) ... ok

==================================================
✅ All tests passed!
Tests run: 23
```

## 🚀 Deployment

### Environment Variables

```bash
# Required
SECRET_KEY=your-very-secure-secret-key-here
BASE_URL=https://yourapp.com

# Email configuration
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@yourapp.com

# Database
DATABASE_URL=postgresql://user:pass@localhost/dbname

# Optional
DEBUG=false
TOKEN_EXPIRY_MINUTES=60
```

### Docker Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application
COPY . .

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code

EXPOSE 8000

CMD ["python", "app.py"]
```

### Production Checklist

- [ ] **Strong secret key** - Use cryptographically random key
- [ ] **HTTPS only** - Never send tokens over HTTP
- [ ] **Rate limiting** - Limit password reset requests per IP/user
- [ ] **Email delivery** - Configure reliable SMTP service
- [ ] **Database backup** - Regular backups of user data
- [ ] **Monitor tokens** - Log and monitor password reset usage
- [ ] **Security headers** - Implement proper security headers
- [ ] **Input validation** - Validate all user inputs
- [ ] **Error handling** - Don't leak sensitive information in errors

## 🔧 Configuration Options

### Service Configuration

```python
service = PasswordResetService(
    secret_key="your-secret-key",           # HMAC signing key
    base_url="https://yourapp.com",         # Base URL for reset links
    smtp_config={                          # Email configuration
        'smtp_server': 'smtp.gmail.com',
        'smtp_port': 587,
        'use_tls': True,
        'username': 'email@gmail.com',
        'password': 'app-password'
    },
    claude_wrapper=claude_wrapper          # Optional Claude integration
)

# Token manager configuration
service.token_manager.token_expiry_minutes = 30  # 30 minute expiry

# Password hasher configuration  
service.password_hasher.iterations = 200000      # Higher security
service.password_hasher.salt_length = 64         # Longer salt
```

### Advanced Configuration

```python
# Custom token validation
class CustomTokenManager(PasswordResetTokenManager):
    def validate_token(self, token):
        user_id = super().validate_token(token)
        
        # Add custom validation logic
        if self.is_user_locked(user_id):
            raise InvalidTokenError("User account is locked")
        
        return user_id

# Custom password requirements
class CustomPasswordHasher(PasswordHasher):
    def hash_password(self, password):
        # Validate password strength
        if len(password) < 12:
            raise ValueError("Password must be at least 12 characters")
        
        return super().hash_password(password)

# Use custom components
service.token_manager = CustomTokenManager("secret-key")
service.password_hasher = CustomPasswordHasher()
```

## 🤖 Claude AI Integration Features

### Security Analysis

The Claude integration provides:

1. **Token entropy analysis** - Validates token randomness
2. **URL structure validation** - Checks for potential security issues
3. **Password strength assessment** - AI-powered password analysis
4. **Security vulnerability detection** - Identifies potential weaknesses

### Example Claude Analysis

```python
async def analyze_security():
    service = PasswordResetService(
        secret_key="test-key",
        base_url="https://example.com",
        claude_wrapper=claude_wrapper
    )
    
    # Claude will analyze the password reset request
    result = await service.request_password_reset("user@example.com")
    
    # Claude provides security feedback in logs
    # Example output:
    # "Token entropy appears sufficient (256+ bits)"
    # "Reset URL structure follows security best practices"
    # "No timing attack vulnerabilities detected"
```

## 📱 Frontend Integration

### React Integration

```javascript
// Password reset request
const requestPasswordReset = async (email) => {
  const response = await fetch('/api/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  const result = await response.json();
  if (result.success) {
    showMessage('Password reset link sent to your email');
  }
};

// Password reset form
const ResetPasswordForm = () => {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const response = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: password })
    });
    
    const result = await response.json();
    setMessage(result.message);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="password" 
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        required 
      />
      <button type="submit">Reset Password</button>
      {message && <p>{message}</p>}
    </form>
  );
};
```

### Vue.js Integration

```javascript
// Vue component
export default {
  data() {
    return {
      email: '',
      token: '',
      newPassword: '',
      message: ''
    }
  },
  methods: {
    async requestReset() {
      try {
        const response = await fetch('/api/request-password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this.email })
        });
        
        const result = await response.json();
        this.message = result.message;
      } catch (error) {
        this.message = 'An error occurred';
      }
    },
    
    async resetPassword() {
      try {
        const response = await fetch('/api/reset-password', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            token: this.token, 
            new_password: this.newPassword 
          })
        });
        
        const result = await response.json();
        this.message = result.message;
        
        if (result.success) {
          this.$router.push('/login');
        }
      } catch (error) {
        this.message = 'An error occurred';
      }
    }
  }
}
```

## 🛠️ Troubleshooting

### Common Issues

1. **Token Invalid Error**
   ```
   Solution: Check token expiration time and secret key consistency
   ```

2. **Email Not Sending**
   ```
   Solution: Verify SMTP configuration and credentials
   ```

3. **Claude Integration Fails**
   ```
   Solution: Ensure Claude CLI is installed and authenticated
   ```

4. **Database Connection Error**
   ```
   Solution: Check database credentials and connectivity
   ```

### Debug Mode

```python
import os
os.environ['DEBUG'] = '1'

# Debug mode returns tokens in API responses (development only!)
result = await service.request_password_reset("user@example.com")
token = result.get('debug_info', {}).get('token')
```

### Logging

```python
import logging

# Enable debug logging
logging.getLogger().setLevel(logging.DEBUG)

# Custom logger
logger = logging.getLogger('password_reset')
logger.info('Password reset requested for user@example.com')
```

## 📚 Additional Resources

- [OWASP Password Reset Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [Claude Code CLI Documentation](https://docs.anthropic.com/claude/docs)
- [PBKDF2 Security Considerations](https://tools.ietf.org/html/rfc2898)
- [Email Security Best Practices](https://tools.ietf.org/html/rfc3207)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Run the test suite
5. Submit a pull request

## 📄 License

This implementation is provided as an example under the MIT license. See LICENSE file for details.

---

*Built with security in mind using the Claude Code Python SDK*