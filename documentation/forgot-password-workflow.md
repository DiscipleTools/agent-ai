# Forgot Password Workflow

This document describes the implementation of the forgot password functionality in the Agent AI Server.

## Overview

The forgot password workflow allows users to reset their password by:
1. Requesting a password reset via email
2. Receiving a secure reset link via email
3. Setting a new password using the reset link

## Implementation Details

### Backend API Endpoints

#### 1. Forgot Password Request
- **Endpoint**: `POST /api/auth/forgot-password`
- **Purpose**: Generates a password reset token and sends reset email
- **Request Body**: `{ "email": "user@example.com" }`
- **Response**: Always returns success to prevent email enumeration
- **Security**: Token expires in 24 hours

#### 2. Validate Reset Token
- **Endpoint**: `GET /api/auth/validate-reset-token?token=<token>`
- **Purpose**: Validates if a reset token is valid and not expired
- **Response**: Returns user info if valid, error if invalid/expired

#### 3. Reset Password
- **Endpoint**: `POST /api/auth/reset-password`
- **Purpose**: Sets new password using reset token
- **Request Body**: `{ "token": "<token>", "password": "<new-password>" }`
- **Security**: Token is consumed after use

### Frontend Pages

#### 1. Forgot Password Page (`/forgot-password`)
- Form to enter email address
- Sends reset request to backend
- Shows success/error messages
- Link back to login page

#### 2. Reset Password Page (`/reset-password?token=<token>`)
- Validates token on page load
- Form to enter new password and confirmation
- Shows invalid token message if token is invalid/expired
- Redirects to login after successful reset

### Security Features

1. **Email Enumeration Protection**: Always returns success message regardless of email existence
2. **Token Security**: 
   - 32-byte random tokens
   - SHA-256 hashed in database
   - 24-hour expiration
   - Single-use (consumed after reset)
3. **CSRF Protection**: Endpoints excluded from CSRF checks (public endpoints)
4. **Input Sanitization**: All inputs sanitized using utility functions
5. **Rate Limiting**: Can be added via middleware if needed

### Email Templates

The system uses HTML and text email templates located in:
- `server/templates/email/password-reset.html`
- `server/templates/email/password-reset.txt`

Templates include:
- Security warnings about link expiration
- Instructions for users who didn't request reset
- Professional styling and branding

### Database Schema

The User model includes password reset fields:
```javascript
passwordResetToken: String (hashed)
passwordResetExpires: Date
```

### Usage Flow

1. User clicks "Forgot your password?" on login page
2. User enters email on forgot password page
3. System generates reset token and sends email
4. User clicks link in email (goes to reset password page)
5. System validates token and shows reset form
6. User enters new password and submits
7. System updates password and redirects to login

### Error Handling

- Invalid/expired tokens show appropriate error messages
- Email sending failures don't break the request flow
- All errors are sanitized before display
- Graceful fallbacks for missing email configuration

### Testing

The workflow can be tested using:
1. Create a test user in the database
2. Request password reset for the test user
3. Check email (or server logs for email sending)
4. Use the reset link to set a new password
5. Verify login works with new password

### Configuration

Email configuration is required in settings for the workflow to function:
- SMTP server settings
- From email and name
- Email service must be enabled

If email is not configured, the system will log warnings but not fail the request. 