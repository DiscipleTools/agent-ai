# Scripts Directory

This directory contains utility scripts for managing the Agent AI Server.

## Available Scripts

### 1. Create Admin User
```bash
npm run create-admin
```
Creates an admin user with full system access.

**Default credentials:**
- Email: `admin@example.com`
- Password: `AdminPassword123`
- Role: `admin`

### 2. Create Regular User
```bash
npm run create-user
```
Creates a regular user with limited access.

**Default credentials:**
- Email: `user@example.com`
- Password: `UserPassword123`
- Role: `user`

### 3. Setup Database
```bash
npm run setup
```
Runs the initial database setup (if available).

## User Roles

### Admin Users
- Can access all system features
- Can manage other users (invite, edit, delete)
- Can view and manage all agents
- Can access admin-only endpoints

### Regular Users
- Can only access agents they've been granted access to
- Cannot manage other users
- Cannot access admin-only features
- Must be invited by an admin user

## Notes

- All scripts will check if users already exist before creating them
- Scripts use the MongoDB connection string from your `.env` file
- Default passwords should be changed after first login in production
- Scripts are safe to run multiple times - they won't create duplicate users

## Environment Variables

Make sure your `.env` file contains:
```env
MONGODB_URI=mongodb://localhost:27017/agent-ai-server
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret
```

## Security

⚠️ **Important**: Change default passwords in production environments!

The default passwords are only for development and testing purposes. 