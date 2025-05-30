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

### 4. Fix Agent Permissions (Migration)
```bash
npm run fix-agent-permissions
```
**Purpose**: Fixes agent permissions for existing agents created before the permission system was implemented.

**What it does:**
- Finds all agents in the database
- Grants creators access to their own agents (if they don't already have it)
- Skips admin users (they have access to all agents)
- Safe to run multiple times

**When to use:**
- After upgrading to a version with the agent permission fix
- If users report that agents they created are not showing in their list
- As a one-time migration after implementing the permission system

**Output:**
- Shows progress for each agent processed
- Reports how many permissions were updated
- Safe to run - won't duplicate permissions

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

## Agent Permissions

### How It Works
- When a user creates an agent, they're automatically granted access to it
- Admin users have access to all agents regardless of the `agentAccess` array
- Regular users only see agents listed in their `agentAccess` array
- The permission system was added to ensure users can manage their own agents

### Troubleshooting
If a user can't see an agent they created:
1. Check if the agent was created before the permission fix
2. Run the `fix-agent-permissions` migration script
3. Verify the user's `agentAccess` array includes the agent ID

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