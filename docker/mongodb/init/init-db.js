// MongoDB initialization script for agent-ai-server

// Switch to the agent-ai-server database
db = db.getSiblingDB('agent-ai-server');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "createdAt": 1 });

db.agents.createIndex({ "name": 1 });
db.agents.createIndex({ "userId": 1 });
db.agents.createIndex({ "status": 1 });
db.agents.createIndex({ "createdAt": 1 });

db.conversations.createIndex({ "agentId": 1 });
db.conversations.createIndex({ "userId": 1 });
db.conversations.createIndex({ "createdAt": 1 });

db.documents.createIndex({ "agentId": 1 });
db.documents.createIndex({ "userId": 1 });
db.documents.createIndex({ "type": 1 });
db.documents.createIndex({ "createdAt": 1 });

// Create compound indexes for common queries
db.agents.createIndex({ "userId": 1, "status": 1 });
db.conversations.createIndex({ "agentId": 1, "createdAt": -1 });
db.documents.createIndex({ "agentId": 1, "type": 1 });

print('Database initialized successfully with indexes'); 